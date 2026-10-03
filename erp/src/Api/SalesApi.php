<?php
declare(strict_types=1);

namespace Erp\Api;

use Erp\{Accounting, Ctx, Payments, Router, Stock};
use function Erp\{add_days, audit, bad, cast_rows, conflict, forbidden, like, limit_of, line_net, next_number, not_found, r3, roundc, today, totals, vdate, vint, vnum, voneof, vstr, vtax};
use const Erp\PLANS as PLAN_LIST;

/**
 * Verkauf: Angebot → Auftrag → Lieferschein → Rechnung → Zahlung, dazu Gutschriften.
 * Die Rechnung wird erst beim „Ausstellen“ nummeriert und gebucht; bis dahin ist sie ein änderbarer Entwurf.
 */
final class SalesApi
{
    private const KINDS = ['quotes' => 'quote', 'orders' => 'order', 'deliveries' => 'delivery', 'invoices' => 'invoice', 'credit-notes' => 'credit_note'];
    private const PREFIX = ['quote' => 'AN', 'order' => 'AB', 'delivery' => 'LS', 'invoice' => 'RE', 'credit_note' => 'GS'];
    private const STATUS = [
        'quote' => ['draft', 'sent', 'accepted', 'rejected', 'converted'],
        'order' => ['open', 'partial', 'delivered', 'completed', 'cancelled'],
        'delivery' => ['delivered', 'cancelled'],
        'invoice' => ['draft', 'open', 'partial', 'paid', 'cancelled'],
        'credit_note' => ['issued'],
    ];
    private const EPS = 1e-6;

    private static function type(Ctx $c): string
    {
        return self::KINDS[$c->params['kind'] ?? ''] ?? throw not_found('Belegart');
    }

    public static function address(array $cust): string
    {
        $lines = array_filter([$cust['name'] ?? '', $cust['street'] ?? '', trim(($cust['zip'] ?? '') . ' ' . ($cust['city'] ?? '')), ($cust['country'] ?? 'DE') !== 'DE' ? $cust['country'] : '']);
        return implode("\n", $lines);
    }

    private static function customer(Ctx $c, int $id): array
    {
        return $c->db->get('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [$id, $c->tenantId]) ?? throw bad('Kunde nicht gefunden');
    }
    private static function doc(Ctx $c, int $id, ?string $type = null): array
    {
        $sql = 'SELECT * FROM documents WHERE id = ? AND tenant_id = ?' . ($type ? ' AND type = ?' : '');
        return $c->db->get($sql, $type ? [$id, $c->tenantId, $type] : [$id, $c->tenantId]) ?? throw not_found('Beleg');
    }
    private static function quota(Ctx $c): void
    {
        $plan = PLAN_LIST[$c->user['plan']] ?? PLAN_LIST['starter'];
        $n = (int) $c->db->val("SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND type IN ('quote','order','invoice') AND created_at >= ?", [$c->tenantId, date('Y-m') . '-01 00:00:00']);
        if ($n >= $plan['docs_per_month']) throw conflict("Ihr Tarif {$plan['label']} erlaubt {$plan['docs_per_month']} Belege pro Monat. Bitte Tarif wechseln.");
    }

    /** Prüft Positionen und berechnet Netto-Beträge. */
    private static function lines(Ctx $c, $raw): array
    {
        if (!is_array($raw) || !$raw) throw bad('Der Beleg braucht mindestens eine Position');
        if (count($raw) > 200) throw bad('Zu viele Positionen (höchstens 200)');
        $out = [];
        foreach (array_values($raw) as $i => $l) {
            if (!is_array($l)) throw bad('Position ist ungültig');
            $pid = vint($l, 'product_id', 'Artikel', 0);
            $p = null;
            if ($pid) $p = $c->db->get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [$pid, $c->tenantId]) ?? throw bad('Artikel nicht gefunden');
            $desc = vstr($l, 'description', 'Beschreibung', 500) ?? ($p['name'] ?? null);
            if ($desc === null) throw bad('Jede Position braucht eine Beschreibung');
            $qty = r3(vnum($l, 'qty', 'Menge', 0.001, 1e7, true));
            $price = array_key_exists('price_cents', $l) && $l['price_cents'] !== '' ? vint($l, 'price_cents', 'Preis', 0) : (int) ($p['price_cents'] ?? 0);
            $disc = vnum($l, 'discount_pct', 'Rabatt', 0, 100);
            $tax = vtax($l['tax_rate'] ?? ($p['tax_rate'] ?? 19));
            $out[] = ['product_id' => $pid ?: null, 'sku' => $p['sku'] ?? null, 'description' => $desc, 'qty' => $qty, 'unit' => vstr($l, 'unit', 'Einheit', 12) ?? ($p['unit'] ?? 'Stk'),
                'price_cents' => $price, 'discount_pct' => $disc, 'tax_rate' => $tax, 'net_cents' => line_net($qty, $price, $disc), 'position' => $i + 1];
        }
        return $out;
    }
    private static function storeLines(Ctx $c, int $docId, array $lines, bool $zeroTotals = false): void
    {
        foreach ($lines as $l) {
            $c->db->insert('document_lines', ['tenant_id' => $c->tenantId, 'document_id' => $docId] + array_intersect_key($l, array_flip(['position', 'product_id', 'sku', 'description', 'qty', 'unit', 'price_cents', 'discount_pct', 'tax_rate', 'net_cents', 'qty_delivered', 'qty_invoiced', 'qty_credited', 'parent_line_id', 'stock_issued'])));
        }
        $t = $zeroTotals ? ['net_cents' => 0, 'tax_cents' => 0, 'gross_cents' => 0] : totals($lines);
        $c->db->run('UPDATE documents SET net_cents = ?, tax_cents = ?, gross_cents = ? WHERE id = ? AND tenant_id = ?', [$t['net_cents'], $t['tax_cents'], $t['gross_cents'], $docId, $c->tenantId]);
    }
    private static function dbLines(Ctx $c, int $docId): array
    {
        return $c->db->all('SELECT l.*, COALESCE(p.track_stock, 0) AS track_stock FROM document_lines l LEFT JOIN products p ON p.id = l.product_id WHERE l.document_id = ? AND l.tenant_id = ? ORDER BY l.position, l.id', [$docId, $c->tenantId]);
    }

    /** Auftragsstatus aus Liefer- und Rechnungsmengen ableiten. */
    private static function refreshOrder(Ctx $c, int $orderId): void
    {
        $o = self::doc($c, $orderId, 'order');
        if ($o['status'] === 'cancelled') return;
        $hasStock = false; $allDelivered = true; $anyProgress = false; $allInvoiced = true;
        foreach (self::dbLines($c, $orderId) as $l) {
            $track = (int) $l['track_stock'] === 1;
            $hasStock = $hasStock || $track;
            if ($track && (float) $l['qty_delivered'] < (float) $l['qty'] - self::EPS) $allDelivered = false;
            if ((float) $l['qty_invoiced'] < (float) $l['qty'] - self::EPS) $allInvoiced = false;
            if (($track && (float) $l['qty_delivered'] > self::EPS) || (float) $l['qty_invoiced'] > self::EPS) $anyProgress = true;
        }
        $status = ($allInvoiced && $allDelivered) ? 'completed' : (($hasStock && $allDelivered) ? 'delivered' : ($anyProgress ? 'partial' : 'open'));
        $c->db->run('UPDATE documents SET status = ? WHERE id = ? AND tenant_id = ?', [$status, $orderId, $c->tenantId]);
    }

    private static function load(Ctx $c, int $id, ?string $type): array
    {
        $d = self::doc($c, $id, $type);
        $d['lines'] = self::dbLines($c, (int) $id);
        $d['customer'] = $c->db->get('SELECT id, number, name, email, phone, vat_id, payment_days, street, zip, city, country FROM customers WHERE id = ? AND tenant_id = ?', [$d['customer_id'], $c->tenantId]);
        $d['parent'] = $d['parent_id'] ? $c->db->get('SELECT id, type, number FROM documents WHERE id = ? AND tenant_id = ?', [$d['parent_id'], $c->tenantId]) : null;
        $d['children'] = $c->db->all('SELECT id, type, number, status, date, gross_cents FROM documents WHERE tenant_id = ? AND parent_id = ? ORDER BY id', [$c->tenantId, $id]);
        $d['payments'] = $d['type'] === 'invoice' ? $c->db->all('SELECT p.id, p.date, p.amount_cents, p.method, p.reference, p.reversed, a.number AS account_number, a.name AS account_name FROM payments p JOIN accounts a ON a.id = p.account_id WHERE p.tenant_id = ? AND p.ref_type = \'invoice\' AND p.ref_id = ? ORDER BY p.id', [$c->tenantId, $id]) : [];
        $d['shipments'] = $d['type'] === 'delivery' ? $c->db->all('SELECT id, number, status, tracking_no, carrier_id FROM shipments WHERE tenant_id = ? AND delivery_id = ?', [$c->tenantId, $id]) : [];
        $d['totals'] = totals($d['lines']);
        $d['open_cents'] = $d['type'] === 'invoice' ? (int) $d['gross_cents'] - (int) $d['paid_cents'] - (int) $d['credited_cents'] : null;
        return $d;
    }

    private static function createDoc(Ctx $c, string $type, array $b, ?array $fromLines = null): int
    {
        self::quota($c);
        $cust = self::customer($c, vint($b, 'customer_id', 'Kunde', 1, 2000000000, true));
        if ($cust['status'] === 'inactive') throw conflict('Der Kunde ist inaktiv.');
        $date = vdate($b, 'date', 'Datum', false, today());
        $lines = $fromLines ?? self::lines($c, $b['lines'] ?? null);
        $wh = vint($b, 'warehouse_id', 'Lager', 0);
        if ($wh && !$c->db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ?', [$wh, $c->tenantId])) throw bad('Lager nicht gefunden');
        $bill = vstr($b, 'bill_to', 'Rechnungsadresse', 500) ?? self::address($cust);
        $id = $c->db->insert('documents', [
            'tenant_id' => $c->tenantId, 'type' => $type, 'number' => in_array($type, ['invoice', 'credit_note'], true) ? null : next_number($c->db, $c->tenantId, self::PREFIX[$type], $date),
            'status' => $type === 'quote' ? 'draft' : ($type === 'order' ? 'open' : 'draft'), 'customer_id' => $cust['id'], 'parent_id' => isset($b['parent_id']) ? (int) $b['parent_id'] : null,
            'date' => $date, 'valid_until' => $type === 'quote' ? vdate($b, 'valid_until', 'Gültig bis', false, add_days($date, 30)) : null,
            'reference' => vstr($b, 'reference', 'Referenz', 200), 'notes' => vstr($b, 'notes', 'Bemerkung', 2000), 'bill_to' => $bill,
            'ship_to' => vstr($b, 'ship_to', 'Lieferadresse', 500) ?? $bill, 'warehouse_id' => $wh ?: null, 'created_by' => $c->userId(),
        ]);
        self::storeLines($c, $id, $lines);
        return $id;
    }

    private static function editable(array $d): bool
    {
        return match ($d['type']) {
            'quote' => in_array($d['status'], ['draft', 'sent'], true),
            'order' => $d['status'] === 'open',
            'invoice' => $d['status'] === 'draft',
            default => false,
        };
    }

    public static function register(Router $r): void
    {
        $r->get('/sales/:kind', 'sales:r', function (Ctx $c) {
            $type = self::type($c);
            $where = ['d.tenant_id = ?', 'd.type = ?'];
            $p = [$c->tenantId, $type];
            if ($s = $c->q('status')) { $where[] = 'd.status = ?'; $p[] = $s; }
            if ($cid = (int) $c->q('customer_id', '0')) { $where[] = 'd.customer_id = ?'; $p[] = $cid; }
            if ($f = $c->q('from')) { $where[] = 'd.date >= ?'; $p[] = $f; }
            if ($t = $c->q('to')) { $where[] = 'd.date <= ?'; $p[] = $t; }
            if ($q = $c->q('q')) { $where[] = '(d.number LIKE ? OR c.name LIKE ? OR d.reference LIKE ?)'; array_push($p, like($q), like($q), like($q)); }
            if ($c->q('overdue') === '1') { $where[] = "d.status IN ('open','partial') AND d.due_date < ?"; $p[] = today(); }
            $limit = limit_of($c->q('limit'), 200, 1000);
            $rows = $c->db->all('SELECT d.id, d.type, d.number, d.status, d.date, d.due_date, d.valid_until, d.reference, d.customer_id, c.name AS customer, d.net_cents, d.tax_cents, d.gross_cents, d.paid_cents, d.credited_cents, d.parent_id,
                    (SELECT x.number FROM documents x WHERE x.id = d.parent_id) AS parent_number
                    FROM documents d JOIN customers c ON c.id = d.customer_id WHERE ' . implode(' AND ', $where) . " ORDER BY d.date DESC, d.id DESC LIMIT $limit", $p);
            return ['rows' => $rows];
        });
        $r->get('/sales/:kind/:id', 'sales:r', fn(Ctx $c) => self::load($c, $c->id(), self::type($c)));

        $r->post('/sales/:kind', 'sales:w', function (Ctx $c) {
            $type = self::type($c);
            if (!in_array($type, ['quote', 'order', 'invoice'], true)) throw bad('Dieser Beleg wird aus einem anderen Beleg erzeugt.');
            $id = self::createDoc($c, $type, $c->body);
            audit($c, $type, $id, 'create');
            return ['id' => $id];
        });
        $r->put('/sales/:kind/:id', 'sales:w', function (Ctx $c) {
            $d = self::doc($c, $c->id(), self::type($c));
            if (!self::editable($d)) throw conflict('Dieser Beleg kann nicht mehr geändert werden.');
            if ($d['type'] === 'order' && (int) $c->db->val('SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND parent_id = ?', [$c->tenantId, $d['id']])) throw conflict('Zum Auftrag gibt es bereits Folgebelege.');
            $cust = self::customer($c, vint($c->body, 'customer_id', 'Kunde', 1, 2000000000, true));
            $lines = self::lines($c, $c->body['lines'] ?? null);
            $date = vdate($c->body, 'date', 'Datum', false, $d['date']);
            $wh = vint($c->body, 'warehouse_id', 'Lager', 0);
            if ($wh && !$c->db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ?', [$wh, $c->tenantId])) throw bad('Lager nicht gefunden');
            $bill = vstr($c->body, 'bill_to', 'Rechnungsadresse', 500) ?? self::address($cust);
            $c->db->update('documents', $c->tenantId, (int) $d['id'], [
                'customer_id' => $cust['id'], 'date' => $date, 'valid_until' => $d['type'] === 'quote' ? vdate($c->body, 'valid_until', 'Gültig bis', false, add_days($date, 30)) : null,
                'reference' => vstr($c->body, 'reference', 'Referenz', 200), 'notes' => vstr($c->body, 'notes', 'Bemerkung', 2000), 'bill_to' => $bill,
                'ship_to' => vstr($c->body, 'ship_to', 'Lieferadresse', 500) ?? $bill, 'warehouse_id' => $wh ?: null,
            ]);
            $c->db->run('DELETE FROM document_lines WHERE document_id = ? AND tenant_id = ?', [$d['id'], $c->tenantId]);
            self::storeLines($c, (int) $d['id'], $lines);
            audit($c, $d['type'], (int) $d['id'], 'update');
            return ['ok' => true];
        });
        $r->delete('/sales/:kind/:id', 'sales:w', function (Ctx $c) {
            $d = self::doc($c, $c->id(), self::type($c));
            if (!self::editable($d)) throw conflict('Dieser Beleg kann nicht gelöscht werden. Bitte stornieren bzw. gutschreiben.');
            if ($d['type'] === 'order' && (int) $c->db->val('SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND parent_id = ?', [$c->tenantId, $d['id']])) throw conflict('Zum Auftrag gibt es bereits Folgebelege.');
            if ($d['type'] === 'invoice' && $d['parent_id']) {
                foreach ($c->db->all('SELECT parent_line_id, qty FROM document_lines WHERE document_id = ? AND tenant_id = ? AND parent_line_id IS NOT NULL', [$d['id'], $c->tenantId]) as $l) {
                    $c->db->run('UPDATE document_lines SET qty_invoiced = qty_invoiced - ? WHERE id = ? AND tenant_id = ?', [(float) $l['qty'], $l['parent_line_id'], $c->tenantId]);
                }
                self::refreshOrder($c, (int) $d['parent_id']);
            }
            if ($d['type'] === 'order' && $d['parent_id']) $c->db->run("UPDATE documents SET status = 'accepted' WHERE id = ? AND tenant_id = ? AND type = 'quote'", [$d['parent_id'], $c->tenantId]);
            $c->db->run('DELETE FROM document_lines WHERE document_id = ? AND tenant_id = ?', [$d['id'], $c->tenantId]);
            $c->db->run('DELETE FROM documents WHERE id = ? AND tenant_id = ?', [$d['id'], $c->tenantId]);
            audit($c, $d['type'], (int) $d['id'], 'delete', $d['number']);
            return ['ok' => true];
        });

        // ----- Angebot -----
        $r->post('/sales/quotes/:id/status', 'sales:w', function (Ctx $c) {
            $d = self::doc($c, $c->id(), 'quote');
            if ($d['status'] === 'converted') throw conflict('Das Angebot wurde bereits in einen Auftrag übernommen.');
            $s = voneof($c->body['status'] ?? '', ['draft', 'sent', 'accepted', 'rejected'], 'Status');
            $c->db->run('UPDATE documents SET status = ? WHERE id = ? AND tenant_id = ?', [$s, $d['id'], $c->tenantId]);
            return ['ok' => true];
        });
        $r->post('/sales/quotes/:id/convert', 'sales:w', function (Ctx $c) {
            $q = self::doc($c, $c->id(), 'quote');
            if (in_array($q['status'], ['converted', 'rejected'], true)) throw conflict('Dieses Angebot kann nicht mehr in einen Auftrag übernommen werden.');
            $lines = [];
            foreach (self::dbLines($c, (int) $q['id']) as $l) $lines[] = array_intersect_key($l, array_flip(['position', 'product_id', 'sku', 'description', 'qty', 'unit', 'price_cents', 'discount_pct', 'tax_rate', 'net_cents']));
            $id = self::createDoc($c, 'order', ['customer_id' => $q['customer_id'], 'reference' => $q['reference'] ?: 'Angebot ' . $q['number'], 'notes' => $q['notes'], 'bill_to' => $q['bill_to'], 'ship_to' => $q['ship_to'], 'parent_id' => $q['id']], $lines);
            $c->db->run("UPDATE documents SET status = 'converted' WHERE id = ? AND tenant_id = ?", [$q['id'], $c->tenantId]);
            audit($c, 'order', $id, 'create', 'aus Angebot ' . $q['number']);
            return ['id' => $id];
        });

        // ----- Auftrag -----
        $r->post('/sales/orders/:id/cancel', 'sales:w', function (Ctx $c) {
            $o = self::doc($c, $c->id(), 'order');
            if ($o['status'] === 'cancelled') throw conflict('Der Auftrag ist bereits storniert.');
            if ((int) $c->db->val('SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND parent_id = ? AND status <> \'cancelled\'', [$c->tenantId, $o['id']])) throw conflict('Es gibt bereits Lieferscheine oder Rechnungen zu diesem Auftrag.');
            $c->db->run("UPDATE documents SET status = 'cancelled' WHERE id = ? AND tenant_id = ?", [$o['id'], $c->tenantId]);
            audit($c, 'order', (int) $o['id'], 'cancel', $o['number']);
            return ['ok' => true];
        });
        $r->post('/sales/orders/:id/deliver', 'stock:w', function (Ctx $c) {
            $o = self::doc($c, $c->id(), 'order');
            if (!in_array($o['status'], ['open', 'partial'], true)) throw conflict('Zu diesem Auftrag kann nicht (mehr) geliefert werden.');
            $wid = vint($c->body, 'warehouse_id', 'Lager', 1, 2000000000, true);
            if (!$c->db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ? AND active = 1', [$wid, $c->tenantId])) throw bad('Lager nicht gefunden');
            $byId = [];
            foreach (self::dbLines($c, (int) $o['id']) as $l) $byId[(int) $l['id']] = $l;
            $pick = [];
            foreach (($c->body['lines'] ?? []) as $x) {
                $lid = (int) ($x['line_id'] ?? 0);
                $qty = r3((float) ($x['qty'] ?? 0));
                if ($qty <= 0) continue;
                $l = $byId[$lid] ?? throw bad('Position gehört nicht zum Auftrag');
                if ((int) $l['track_stock'] !== 1) throw bad('Für Positionen ohne Bestandsführung wird kein Lieferschein erstellt.');
                $open = r3((float) $l['qty'] - (float) $l['qty_delivered']);
                if ($qty > $open + self::EPS) throw conflict("Es sind nur noch $open offen: {$l['description']}");
                $pick[] = [$l, $qty];
            }
            if (!$pick) throw bad('Bitte mindestens eine Menge zum Liefern angeben.');
            $cust = self::customer($c, (int) $o['customer_id']);
            $did = $c->db->insert('documents', ['tenant_id' => $c->tenantId, 'type' => 'delivery', 'number' => next_number($c->db, $c->tenantId, 'LS'), 'status' => 'delivered', 'customer_id' => $o['customer_id'], 'parent_id' => $o['id'], 'date' => vdate($c->body, 'date', 'Datum', false, today()), 'reference' => $o['number'], 'bill_to' => $o['bill_to'], 'ship_to' => $o['ship_to'] ?: self::address($cust), 'warehouse_id' => $wid, 'created_by' => $c->userId()]);
            $dnum = (string) $c->db->val('SELECT number FROM documents WHERE id = ?', [$did]);
            $pos = 1;
            foreach ($pick as [$l, $qty]) {
                $c->db->insert('document_lines', ['tenant_id' => $c->tenantId, 'document_id' => $did, 'position' => $pos++, 'product_id' => $l['product_id'], 'sku' => $l['sku'], 'description' => $l['description'], 'qty' => $qty, 'unit' => $l['unit'], 'price_cents' => $l['price_cents'], 'discount_pct' => $l['discount_pct'], 'tax_rate' => $l['tax_rate'], 'net_cents' => 0, 'parent_line_id' => $l['id'], 'stock_issued' => 1, 'qty_delivered' => $qty]);
                Stock::move($c, ['product_id' => (int) $l['product_id'], 'warehouse_id' => $wid, 'delta' => -$qty, 'kind' => 'issue', 'ref_type' => 'delivery', 'ref_id' => $did, 'ref_number' => $dnum, 'unit_cost' => (int) $c->db->val('SELECT avg_cost_cents FROM products WHERE id = ?', [$l['product_id']], 0)]);
                $c->db->run('UPDATE document_lines SET qty_delivered = qty_delivered + ? WHERE id = ? AND tenant_id = ?', [$qty, $l['id'], $c->tenantId]);
            }
            self::refreshOrder($c, (int) $o['id']);
            $shipment = null;
            if (!empty($c->body['create_shipment'])) $shipment = LogisticsApi::createForDelivery($c, $did, $c->body);
            audit($c, 'delivery', $did, 'create', "$dnum zu {$o['number']}");
            return ['id' => $did, 'number' => $dnum, 'shipment_id' => $shipment];
        });
        $r->post('/sales/orders/:id/invoice', 'sales:w', function (Ctx $c) {
            $o = self::doc($c, $c->id(), 'order');
            if (in_array($o['status'], ['cancelled', 'completed'], true)) throw conflict('Der Auftrag ist bereits abgeschlossen oder storniert.');
            $new = [];
            $bill = [];
            foreach (self::dbLines($c, (int) $o['id']) as $l) {
                $track = (int) $l['track_stock'] === 1;
                $qty = r3(($track ? (float) $l['qty_delivered'] : (float) $l['qty']) - (float) $l['qty_invoiced']);
                if ($qty <= self::EPS) continue;
                $new[] = ['product_id' => $l['product_id'], 'sku' => $l['sku'], 'description' => $l['description'], 'qty' => $qty, 'unit' => $l['unit'], 'price_cents' => (int) $l['price_cents'], 'discount_pct' => (float) $l['discount_pct'], 'tax_rate' => (float) $l['tax_rate'], 'net_cents' => line_net($qty, (int) $l['price_cents'], (float) $l['discount_pct']), 'position' => count($new) + 1, 'parent_line_id' => (int) $l['id']];
                $bill[] = [$l, $qty, $track];
            }
            if (!$new) throw conflict('Es gibt nichts abzurechnen. Bitte zuerst liefern.');
            $id = self::createDoc($c, 'invoice', ['customer_id' => $o['customer_id'], 'reference' => 'Auftrag ' . $o['number'], 'bill_to' => $o['bill_to'], 'ship_to' => $o['ship_to'], 'parent_id' => $o['id'], 'notes' => $o['notes']], $new);
            foreach ($bill as [$l, $qty, $track]) {
                $c->db->run('UPDATE document_lines SET qty_invoiced = qty_invoiced + ?' . ($track ? '' : ', qty_delivered = qty_delivered + ?') . ' WHERE id = ? AND tenant_id = ?', $track ? [$qty, $l['id'], $c->tenantId] : [$qty, $qty, $l['id'], $c->tenantId]);
            }
            self::refreshOrder($c, (int) $o['id']);
            audit($c, 'invoice', $id, 'create', 'Entwurf aus ' . $o['number']);
            return ['id' => $id];
        });
        $r->post('/sales/deliveries/:id/cancel', 'stock:w', function (Ctx $c) {
            $d = self::doc($c, $c->id(), 'delivery');
            if ($d['status'] !== 'delivered') throw conflict('Der Lieferschein ist bereits storniert.');
            if ((int) $c->db->val("SELECT COUNT(*) FROM shipments WHERE tenant_id = ? AND delivery_id = ? AND status NOT IN ('planned','packed')", [$c->tenantId, $d['id']])) throw conflict('Die Sendung ist bereits unterwegs. Bitte zuerst in der Logistik klären.');
            foreach (self::dbLines($c, (int) $d['id']) as $l) {
                $ol = $c->db->get('SELECT * FROM document_lines WHERE id = ? AND tenant_id = ?', [$l['parent_line_id'], $c->tenantId]);
                if ($ol && (float) $ol['qty_delivered'] - (float) $l['qty'] < (float) $ol['qty_invoiced'] - self::EPS) throw conflict('Die gelieferte Menge wurde schon in Rechnung gestellt.');
            }
            foreach (self::dbLines($c, (int) $d['id']) as $l) {
                Stock::move($c, ['product_id' => (int) $l['product_id'], 'warehouse_id' => (int) $d['warehouse_id'], 'delta' => (float) $l['qty'], 'kind' => 'return', 'ref_type' => 'delivery', 'ref_id' => (int) $d['id'], 'ref_number' => $d['number'], 'note' => 'Lieferschein storniert']);
                $c->db->run('UPDATE document_lines SET qty_delivered = qty_delivered - ? WHERE id = ? AND tenant_id = ?', [(float) $l['qty'], $l['parent_line_id'], $c->tenantId]);
            }
            $c->db->run("UPDATE documents SET status = 'cancelled' WHERE id = ? AND tenant_id = ?", [$d['id'], $c->tenantId]);
            $c->db->run("UPDATE shipments SET status = 'cancelled' WHERE tenant_id = ? AND delivery_id = ?", [$c->tenantId, $d['id']]);
            if ($d['parent_id']) self::refreshOrder($c, (int) $d['parent_id']);
            audit($c, 'delivery', (int) $d['id'], 'cancel', $d['number']);
            return ['ok' => true];
        });

        // ----- Rechnung -----
        $r->post('/sales/invoices/:id/issue', 'sales:w', function (Ctx $c) {
            $d = self::doc($c, $c->id(), 'invoice');
            if ($d['status'] !== 'draft') throw conflict('Die Rechnung wurde bereits ausgestellt.');
            $lines = self::dbLines($c, (int) $d['id']);
            if (!$lines) throw bad('Die Rechnung hat keine Positionen.');
            $cust = self::customer($c, (int) $d['customer_id']);
            $date = vdate($c->body, 'date', 'Rechnungsdatum', false, $d['date'] ?: today());
            $tot = totals($lines);
            if ($tot['gross_cents'] <= 0) throw bad('Eine Rechnung braucht einen Betrag größer 0. Für Erstattungen bitte eine Gutschrift erstellen.');
            $due = vdate($c->body, 'due_date', 'Fällig am', false, add_days($date, (int) $cust['payment_days']));
            $number = next_number($c->db, $c->tenantId, 'RE', $date);
            // Direktrechnung ohne Auftrag: Ware wird mit der Rechnung aus dem Lager genommen
            if (!$d['parent_id']) {
                $needs = array_filter($lines, fn($l) => (int) $l['track_stock'] === 1);
                if ($needs) {
                    if (!$d['warehouse_id']) throw bad('Bitte das Lager für den Warenausgang wählen.');
                    foreach ($needs as $l) {
                        Stock::move($c, ['product_id' => (int) $l['product_id'], 'warehouse_id' => (int) $d['warehouse_id'], 'delta' => -(float) $l['qty'], 'kind' => 'issue', 'ref_type' => 'invoice', 'ref_id' => (int) $d['id'], 'ref_number' => $number, 'unit_cost' => (int) $c->db->val('SELECT avg_cost_cents FROM products WHERE id = ?', [$l['product_id']], 0)]);
                        $c->db->run('UPDATE document_lines SET stock_issued = 1 WHERE id = ? AND tenant_id = ?', [$l['id'], $c->tenantId]);
                    }
                }
            }
            $pl = [['account_id' => (int) $cust['account_id'], 'debit' => $tot['gross_cents'], 'text' => $number]];
            foreach ($tot['byRate'] as $g) {
                $k = Accounting::taxSuffix($g['rate']);
                $pl[] = ['account_id' => Accounting::sys($c->db, $c->tenantId, "rev_$k"), 'credit' => $g['net_cents'], 'text' => "Erlöse {$g['rate']} %"];
                if ($g['tax_cents'] > 0) $pl[] = ['account_id' => Accounting::sys($c->db, $c->tenantId, "vat_out_$k"), 'credit' => $g['tax_cents'], 'text' => "USt {$g['rate']} %"];
            }
            $entry = Accounting::post($c, ['date' => $date, 'text' => "Rechnung $number {$cust['name']}", 'source' => 'invoice', 'ref_type' => 'invoice', 'ref_id' => (int) $d['id'], 'lines' => $pl]);
            $c->db->run("UPDATE documents SET number = ?, status = 'open', date = ?, due_date = ?, journal_entry_id = ?, issued_at = ? WHERE id = ? AND tenant_id = ?", [$number, $date, $due, $entry['id'], date('Y-m-d H:i:s'), $d['id'], $c->tenantId]);
            audit($c, 'invoice', (int) $d['id'], 'issue', $number);
            return ['number' => $number];
        });
        $r->post('/sales/invoices/:id/payments', 'accounting:w', function (Ctx $c) {
            $inv = self::doc($c, $c->id(), 'invoice');
            return ['id' => Payments::recordCustomer($c, $inv, $c->body)];
        });
        $r->post('/sales/invoices/:id/credit-note', 'sales:w', function (Ctx $c) {
            $inv = self::doc($c, $c->id(), 'invoice');
            if ($inv['status'] === 'draft') throw conflict('Entwürfe können einfach gelöscht werden.');
            if ($inv['status'] === 'cancelled') throw conflict('Die Rechnung ist bereits vollständig gutgeschrieben.');
            $cust = self::customer($c, (int) $inv['customer_id']);
            $byId = [];
            foreach (self::dbLines($c, (int) $inv['id']) as $l) $byId[(int) $l['id']] = $l;
            $rows = $c->body['lines'] ?? null;
            if (!$rows) {   // ohne Angabe: alles Restliche gutschreiben
                $rows = [];
                foreach ($byId as $l) if ((float) $l['qty'] - (float) $l['qty_credited'] > self::EPS) $rows[] = ['line_id' => $l['id'], 'qty' => r3((float) $l['qty'] - (float) $l['qty_credited'])];
            }
            $new = [];
            $picked = [];
            foreach ($rows as $x) {
                $l = $byId[(int) ($x['line_id'] ?? 0)] ?? throw bad('Position gehört nicht zur Rechnung');
                $qty = r3((float) ($x['qty'] ?? 0));
                if ($qty <= 0) continue;
                $open = r3((float) $l['qty'] - (float) $l['qty_credited']);
                if ($qty > $open + self::EPS) throw conflict("Es können höchstens $open gutgeschrieben werden: {$l['description']}");
                $new[] = ['product_id' => $l['product_id'], 'sku' => $l['sku'], 'description' => $l['description'], 'qty' => $qty, 'unit' => $l['unit'], 'price_cents' => (int) $l['price_cents'], 'discount_pct' => (float) $l['discount_pct'], 'tax_rate' => (float) $l['tax_rate'], 'net_cents' => line_net($qty, (int) $l['price_cents'], (float) $l['discount_pct']), 'position' => count($new) + 1, 'parent_line_id' => (int) $l['id']];
                $picked[] = [$l, $qty];
            }
            if (!$new) throw bad('Bitte mindestens eine Position gutschreiben.');
            $date = vdate($c->body, 'date', 'Datum', false, today());
            $tot = totals($new);
            if ($tot['gross_cents'] > (int) $inv['gross_cents'] - (int) $inv['credited_cents']) throw conflict('Die Gutschrift übersteigt den noch nicht gutgeschriebenen Rechnungsbetrag.');
            $number = next_number($c->db, $c->tenantId, 'GS', $date);
            $reason = vstr($c->body, 'reason', 'Grund', 300);
            $gid = $c->db->insert('documents', ['tenant_id' => $c->tenantId, 'type' => 'credit_note', 'number' => $number, 'status' => 'issued', 'customer_id' => $inv['customer_id'], 'parent_id' => $inv['id'], 'date' => $date, 'reference' => 'zu Rechnung ' . $inv['number'], 'notes' => $reason, 'bill_to' => $inv['bill_to'], 'ship_to' => $inv['ship_to'], 'created_by' => $c->userId(), 'issued_at' => date('Y-m-d H:i:s')]);
            self::storeLines($c, $gid, $new);
            $pl = [['account_id' => (int) $cust['account_id'], 'credit' => $tot['gross_cents'], 'text' => $number]];
            foreach ($tot['byRate'] as $g) {
                $k = Accounting::taxSuffix($g['rate']);
                $pl[] = ['account_id' => Accounting::sys($c->db, $c->tenantId, "rev_$k"), 'debit' => $g['net_cents'], 'text' => "Erlösminderung {$g['rate']} %"];
                if ($g['tax_cents'] > 0) $pl[] = ['account_id' => Accounting::sys($c->db, $c->tenantId, "vat_out_$k"), 'debit' => $g['tax_cents'], 'text' => "USt {$g['rate']} %"];
            }
            $entry = Accounting::post($c, ['date' => $date, 'text' => "Gutschrift $number zu {$inv['number']} {$cust['name']}", 'source' => 'credit_note', 'ref_type' => 'credit_note', 'ref_id' => $gid, 'lines' => $pl]);
            $c->db->run('UPDATE documents SET journal_entry_id = ? WHERE id = ? AND tenant_id = ?', [$entry['id'], $gid, $c->tenantId]);
            $restock = vint($c->body, 'restock_warehouse_id', 'Lager', 0);
            foreach ($picked as [$l, $qty]) {
                $c->db->run('UPDATE document_lines SET qty_credited = qty_credited + ? WHERE id = ? AND tenant_id = ?', [$qty, $l['id'], $c->tenantId]);
                if ($restock && (int) $l['track_stock'] === 1) Stock::move($c, ['product_id' => (int) $l['product_id'], 'warehouse_id' => $restock, 'delta' => $qty, 'kind' => 'return', 'ref_type' => 'credit_note', 'ref_id' => $gid, 'ref_number' => $number, 'note' => 'Retoure']);
            }
            $credited = (int) $inv['credited_cents'] + $tot['gross_cents'];
            $c->db->run('UPDATE documents SET credited_cents = ?, status = ? WHERE id = ? AND tenant_id = ?', [$credited, Payments::invoiceStatus((int) $inv['gross_cents'], (int) $inv['paid_cents'], $credited), $inv['id'], $c->tenantId]);
            audit($c, 'credit_note', $gid, 'create', "$number zu {$inv['number']}");
            return ['id' => $gid, 'number' => $number];
        });

        $r->post('/payments/:id/reverse', 'accounting:w', function (Ctx $c) {
            Payments::reverse($c, $c->id());
            return ['ok' => true];
        });
    }
}
