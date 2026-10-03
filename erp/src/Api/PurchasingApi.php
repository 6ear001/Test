<?php
declare(strict_types=1);

namespace Erp\Api;

use Erp\{Accounting, Ctx, Payments, Router, Stock};
use function Erp\{add_days, audit, bad, cast_rows, conflict, like, limit_of, line_net, next_number, not_found, r3, today, totals, vdate, vint, vnum, vstr, vtax};

/** Einkauf: Bestellung → Wareneingang → Eingangsrechnung → Zahlung, dazu Nachbestell-Vorschläge. */
final class PurchasingApi
{
    private const EPS = 1e-6;

    private static function supplier(Ctx $c, int $id): array
    {
        return $c->db->get('SELECT * FROM suppliers WHERE id = ? AND tenant_id = ?', [$id, $c->tenantId]) ?? throw bad('Lieferant nicht gefunden');
    }
    private static function po(Ctx $c, int $id): array
    {
        return $c->db->get('SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?', [$id, $c->tenantId]) ?? throw not_found('Bestellung');
    }
    private static function poLines(Ctx $c, int $poId): array
    {
        return $c->db->all('SELECT l.*, COALESCE(p.track_stock, 0) AS track_stock FROM po_lines l LEFT JOIN products p ON p.id = l.product_id WHERE l.po_id = ? AND l.tenant_id = ? ORDER BY l.position, l.id', [$poId, $c->tenantId]);
    }

    private static function lines(Ctx $c, $raw): array
    {
        if (!is_array($raw) || !$raw) throw bad('Die Bestellung braucht mindestens eine Position');
        if (count($raw) > 200) throw bad('Zu viele Positionen (höchstens 200)');
        $out = [];
        foreach (array_values($raw) as $i => $l) {
            $pid = vint($l, 'product_id', 'Artikel', 0);
            $p = $pid ? ($c->db->get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [$pid, $c->tenantId]) ?? throw bad('Artikel nicht gefunden')) : null;
            $desc = vstr($l, 'description', 'Beschreibung', 500) ?? ($p['name'] ?? null) ?? throw bad('Jede Position braucht eine Beschreibung');
            $qty = r3(vnum($l, 'qty', 'Menge', 0.001, 1e7, true));
            $cost = array_key_exists('cost_cents', $l) && $l['cost_cents'] !== '' ? vint($l, 'cost_cents', 'Einkaufspreis', 0) : (int) ($p['cost_cents'] ?? 0);
            $tax = vtax($l['tax_rate'] ?? ($p['tax_rate'] ?? 19));
            $out[] = ['position' => $i + 1, 'product_id' => $pid ?: null, 'sku' => $p['sku'] ?? null, 'description' => $desc, 'qty' => $qty, 'unit' => vstr($l, 'unit', 'Einheit', 12) ?? ($p['unit'] ?? 'Stk'), 'cost_cents' => $cost, 'tax_rate' => $tax, 'net_cents' => line_net($qty, $cost)];
        }
        return $out;
    }
    private static function storeLines(Ctx $c, int $poId, array $lines): void
    {
        foreach ($lines as $l) $c->db->insert('po_lines', ['tenant_id' => $c->tenantId, 'po_id' => $poId] + $l);
        $t = totals($lines);
        $c->db->run('UPDATE purchase_orders SET net_cents = ?, tax_cents = ?, gross_cents = ? WHERE id = ? AND tenant_id = ?', [$t['net_cents'], $t['tax_cents'], $t['gross_cents'], $poId, $c->tenantId]);
    }
    public static function createPo(Ctx $c, array $b, ?array $lines = null): int
    {
        $s = self::supplier($c, vint($b, 'supplier_id', 'Lieferant', 1, 2000000000, true));
        $date = vdate($b, 'date', 'Datum', false, today());
        $wh = vint($b, 'warehouse_id', 'Lager', 0) ?: (int) $c->db->val('SELECT id FROM warehouses WHERE tenant_id = ? AND is_default = 1', [$c->tenantId], 0);
        if ($wh && !$c->db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ?', [$wh, $c->tenantId])) throw bad('Lager nicht gefunden');
        $id = $c->db->insert('purchase_orders', ['tenant_id' => $c->tenantId, 'number' => next_number($c->db, $c->tenantId, 'BE', $date), 'supplier_id' => $s['id'], 'status' => 'draft', 'date' => $date,
            'expected_date' => vdate($b, 'expected_date', 'Liefertermin', false, add_days($date, (int) $s['lead_days'])), 'warehouse_id' => $wh ?: null, 'reference' => vstr($b, 'reference', 'Referenz', 200), 'notes' => vstr($b, 'notes', 'Bemerkung', 2000), 'created_by' => $c->userId()]);
        self::storeLines($c, $id, $lines ?? self::lines($c, $b['lines'] ?? null));
        return $id;
    }
    private static function refreshPo(Ctx $c, int $poId): void
    {
        $po = self::po($c, $poId);
        if (in_array($po['status'], ['draft', 'cancelled'], true)) return;
        $allRecv = true; $anyRecv = false; $allInv = true;
        foreach (self::poLines($c, $poId) as $l) {
            if ((float) $l['qty_received'] < (float) $l['qty'] - self::EPS) $allRecv = false;
            if ((float) $l['qty_received'] > self::EPS) $anyRecv = true;
            if ((float) $l['qty_invoiced'] < (float) $l['qty'] - self::EPS) $allInv = false;
        }
        $status = ($allRecv && $allInv) ? 'completed' : ($allRecv ? 'received' : ($anyRecv ? 'partial' : 'ordered'));
        $c->db->run('UPDATE purchase_orders SET status = ? WHERE id = ? AND tenant_id = ?', [$status, $poId, $c->tenantId]);
    }

    public static function register(Router $r): void
    {
        // ----- Bestellungen -----
        $r->get('/purchasing/orders', 'purchasing:r', function (Ctx $c) {
            $where = ['o.tenant_id = ?'];
            $p = [$c->tenantId];
            if ($s = $c->q('status')) { $where[] = 'o.status = ?'; $p[] = $s; }
            if ($sid = (int) $c->q('supplier_id', '0')) { $where[] = 'o.supplier_id = ?'; $p[] = $sid; }
            if ($q = $c->q('q')) { $where[] = '(o.number LIKE ? OR s.name LIKE ? OR o.reference LIKE ?)'; array_push($p, like($q), like($q), like($q)); }
            $limit = limit_of($c->q('limit'), 200, 1000);
            return ['rows' => $c->db->all('SELECT o.id, o.number, o.status, o.date, o.expected_date, o.reference, o.supplier_id, s.name AS supplier, o.net_cents, o.gross_cents FROM purchase_orders o JOIN suppliers s ON s.id = o.supplier_id WHERE ' . implode(' AND ', $where) . " ORDER BY o.date DESC, o.id DESC LIMIT $limit", $p)];
        });
        $r->get('/purchasing/orders/:id', 'purchasing:r', function (Ctx $c) {
            $o = self::po($c, $c->id());
            $o['lines'] = self::poLines($c, (int) $o['id']);
            $o['supplier'] = $c->db->get('SELECT id, number, name, email, phone, street, zip, city, country, payment_days FROM suppliers WHERE id = ? AND tenant_id = ?', [$o['supplier_id'], $c->tenantId]);
            $o['receipts'] = $c->db->all('SELECT id, number, date, warehouse_id FROM goods_receipts WHERE tenant_id = ? AND po_id = ? ORDER BY id', [$c->tenantId, $o['id']]);
            $o['invoices'] = $c->db->all('SELECT id, number, supplier_ref, status, gross_cents, paid_cents FROM supplier_invoices WHERE tenant_id = ? AND po_id = ? ORDER BY id', [$c->tenantId, $o['id']]);
            $o['shipments'] = $c->db->all('SELECT id, number, status, tracking_no FROM shipments WHERE tenant_id = ? AND po_id = ?', [$c->tenantId, $o['id']]);
            $o['totals'] = totals($o['lines'] ? array_map(fn($l) => ['net_cents' => $l['net_cents'], 'tax_rate' => $l['tax_rate']], $o['lines']) : []);
            return $o;
        });
        $r->post('/purchasing/orders', 'purchasing:w', function (Ctx $c) {
            $id = self::createPo($c, $c->body);
            audit($c, 'purchase_order', $id, 'create');
            return ['id' => $id];
        });
        $r->put('/purchasing/orders/:id', 'purchasing:w', function (Ctx $c) {
            $o = self::po($c, $c->id());
            if ($o['status'] !== 'draft') throw conflict('Nur Entwürfe können geändert werden.');
            $s = self::supplier($c, vint($c->body, 'supplier_id', 'Lieferant', 1, 2000000000, true));
            $lines = self::lines($c, $c->body['lines'] ?? null);
            $date = vdate($c->body, 'date', 'Datum', false, $o['date']);
            $wh = vint($c->body, 'warehouse_id', 'Lager', 0);
            if ($wh && !$c->db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ?', [$wh, $c->tenantId])) throw bad('Lager nicht gefunden');
            $c->db->update('purchase_orders', $c->tenantId, (int) $o['id'], ['supplier_id' => $s['id'], 'date' => $date, 'expected_date' => vdate($c->body, 'expected_date', 'Liefertermin', false, add_days($date, (int) $s['lead_days'])), 'warehouse_id' => $wh ?: null, 'reference' => vstr($c->body, 'reference', 'Referenz', 200), 'notes' => vstr($c->body, 'notes', 'Bemerkung', 2000)]);
            $c->db->run('DELETE FROM po_lines WHERE po_id = ? AND tenant_id = ?', [$o['id'], $c->tenantId]);
            self::storeLines($c, (int) $o['id'], $lines);
            return ['ok' => true];
        });
        $r->delete('/purchasing/orders/:id', 'purchasing:w', function (Ctx $c) {
            $o = self::po($c, $c->id());
            if ($o['status'] !== 'draft') throw conflict('Nur Entwürfe können gelöscht werden. Bestellte Aufträge bitte stornieren.');
            $c->db->run('DELETE FROM po_lines WHERE po_id = ? AND tenant_id = ?', [$o['id'], $c->tenantId]);
            $c->db->run('DELETE FROM purchase_orders WHERE id = ? AND tenant_id = ?', [$o['id'], $c->tenantId]);
            audit($c, 'purchase_order', (int) $o['id'], 'delete', $o['number']);
            return ['ok' => true];
        });
        $r->post('/purchasing/orders/:id/order', 'purchasing:w', function (Ctx $c) {
            $o = self::po($c, $c->id());
            if ($o['status'] !== 'draft') throw conflict('Die Bestellung wurde bereits aufgegeben.');
            $c->db->run("UPDATE purchase_orders SET status = 'ordered' WHERE id = ? AND tenant_id = ?", [$o['id'], $c->tenantId]);
            audit($c, 'purchase_order', (int) $o['id'], 'order', $o['number']);
            return ['ok' => true];
        });
        $r->post('/purchasing/orders/:id/cancel', 'purchasing:w', function (Ctx $c) {
            $o = self::po($c, $c->id());
            if (in_array($o['status'], ['cancelled', 'completed'], true)) throw conflict('Die Bestellung ist bereits abgeschlossen oder storniert.');
            $hasMoves = (int) $c->db->val('SELECT (SELECT COUNT(*) FROM goods_receipts WHERE tenant_id = ? AND po_id = ?) + (SELECT COUNT(*) FROM supplier_invoices WHERE tenant_id = ? AND po_id = ? AND status <> \'cancelled\')', [$c->tenantId, $o['id'], $c->tenantId, $o['id']]);
            if ($hasMoves) throw conflict('Es gibt bereits Wareneingänge oder Rechnungen zu dieser Bestellung.');
            $c->db->run("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ? AND tenant_id = ?", [$o['id'], $c->tenantId]);
            audit($c, 'purchase_order', (int) $o['id'], 'cancel', $o['number']);
            return ['ok' => true];
        });
        $r->post('/purchasing/orders/:id/receive', 'stock:w', function (Ctx $c) {
            $o = self::po($c, $c->id());
            if (!in_array($o['status'], ['ordered', 'partial'], true)) throw conflict('Zu dieser Bestellung kann kein Wareneingang gebucht werden.');
            $wid = vint($c->body, 'warehouse_id', 'Lager', 1, 2000000000, true);
            if (!$c->db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ? AND active = 1', [$wid, $c->tenantId])) throw bad('Lager nicht gefunden');
            $byId = [];
            foreach (self::poLines($c, (int) $o['id']) as $l) $byId[(int) $l['id']] = $l;
            $pick = [];
            foreach (($c->body['lines'] ?? []) as $x) {
                $qty = r3((float) ($x['qty'] ?? 0));
                if ($qty <= 0) continue;
                $l = $byId[(int) ($x['line_id'] ?? 0)] ?? throw bad('Position gehört nicht zur Bestellung');
                $open = r3((float) $l['qty'] - (float) $l['qty_received']);
                if ($qty > $open + self::EPS) throw conflict("Es sind nur noch $open offen: {$l['description']}");
                $cost = isset($x['cost_cents']) && $x['cost_cents'] !== '' ? vint($x, 'cost_cents', 'Einkaufspreis', 0) : (int) $l['cost_cents'];
                $pick[] = [$l, $qty, $cost];
            }
            if (!$pick) throw bad('Bitte mindestens eine Menge angeben.');
            $date = vdate($c->body, 'date', 'Datum', false, today());
            $num = next_number($c->db, $c->tenantId, 'WE', $date);
            $rid = $c->db->insert('goods_receipts', ['tenant_id' => $c->tenantId, 'number' => $num, 'po_id' => $o['id'], 'supplier_id' => $o['supplier_id'], 'warehouse_id' => $wid, 'date' => $date, 'note' => vstr($c->body, 'note', 'Notiz', 300), 'user_id' => $c->userId()]);
            foreach ($pick as [$l, $qty, $cost]) {
                $c->db->insert('goods_receipt_lines', ['tenant_id' => $c->tenantId, 'receipt_id' => $rid, 'po_line_id' => $l['id'], 'product_id' => $l['product_id'], 'description' => $l['description'], 'qty' => $qty, 'cost_cents' => $cost]);
                if ($l['product_id'] && (int) $l['track_stock'] === 1) {
                    $before = Stock::onHand($c->db, $c->tenantId, (int) $l['product_id']);
                    Stock::move($c, ['product_id' => (int) $l['product_id'], 'warehouse_id' => $wid, 'delta' => $qty, 'kind' => 'receipt', 'ref_type' => 'goods_receipt', 'ref_id' => $rid, 'ref_number' => $num, 'unit_cost' => $cost]);
                    Stock::applyReceiptCost($c->db, $c->tenantId, (int) $l['product_id'], $qty, $cost, $before);
                }
                $c->db->run('UPDATE po_lines SET qty_received = qty_received + ? WHERE id = ? AND tenant_id = ?', [$qty, $l['id'], $c->tenantId]);
            }
            self::refreshPo($c, (int) $o['id']);
            audit($c, 'goods_receipt', $rid, 'create', "$num zu {$o['number']}");
            return ['id' => $rid, 'number' => $num];
        });
        $r->get('/purchasing/receipts', 'purchasing:r', fn(Ctx $c) => ['rows' => $c->db->all('SELECT g.id, g.number, g.date, g.po_id, o.number AS po_number, s.name AS supplier, w.name AS warehouse, (SELECT COUNT(*) FROM goods_receipt_lines l WHERE l.receipt_id = g.id) AS lines FROM goods_receipts g JOIN suppliers s ON s.id = g.supplier_id JOIN warehouses w ON w.id = g.warehouse_id LEFT JOIN purchase_orders o ON o.id = g.po_id WHERE g.tenant_id = ? ORDER BY g.id DESC LIMIT 300', [$c->tenantId])]);
        $r->get('/purchasing/receipts/:id', 'purchasing:r', function (Ctx $c) {
            $g = $c->db->get('SELECT g.*, s.name AS supplier, w.name AS warehouse, o.number AS po_number FROM goods_receipts g JOIN suppliers s ON s.id = g.supplier_id JOIN warehouses w ON w.id = g.warehouse_id LEFT JOIN purchase_orders o ON o.id = g.po_id WHERE g.id = ? AND g.tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Wareneingang');
            $g['lines'] = $c->db->all('SELECT l.*, p.sku FROM goods_receipt_lines l LEFT JOIN products p ON p.id = l.product_id WHERE l.receipt_id = ? AND l.tenant_id = ?', [$g['id'], $c->tenantId]);
            return $g;
        });

        // ----- Eingangsrechnungen -----
        $r->get('/purchasing/invoices', 'purchasing:r', function (Ctx $c) {
            $where = ['i.tenant_id = ?'];
            $p = [$c->tenantId];
            if ($s = $c->q('status')) { $where[] = 'i.status = ?'; $p[] = $s; }
            if ($sid = (int) $c->q('supplier_id', '0')) { $where[] = 'i.supplier_id = ?'; $p[] = $sid; }
            if ($q = $c->q('q')) { $where[] = '(i.number LIKE ? OR i.supplier_ref LIKE ? OR s.name LIKE ?)'; array_push($p, like($q), like($q), like($q)); }
            if ($c->q('overdue') === '1') { $where[] = "i.status IN ('open','partial') AND i.due_date < ?"; $p[] = today(); }
            $limit = limit_of($c->q('limit'), 200, 1000);
            return ['rows' => $c->db->all('SELECT i.id, i.number, i.supplier_ref, i.status, i.date, i.due_date, i.supplier_id, s.name AS supplier, i.net_cents, i.tax_cents, i.gross_cents, i.paid_cents FROM supplier_invoices i JOIN suppliers s ON s.id = i.supplier_id WHERE ' . implode(' AND ', $where) . " ORDER BY i.date DESC, i.id DESC LIMIT $limit", $p)];
        });
        $r->get('/purchasing/invoices/:id', 'purchasing:r', function (Ctx $c) {
            $i = $c->db->get('SELECT * FROM supplier_invoices WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Eingangsrechnung');
            $i['lines'] = $c->db->all('SELECT l.*, a.number AS account_number, a.name AS account_name FROM supplier_invoice_lines l JOIN accounts a ON a.id = l.account_id WHERE l.invoice_id = ? AND l.tenant_id = ? ORDER BY l.id', [$i['id'], $c->tenantId]);
            $i['supplier'] = $c->db->get('SELECT id, number, name, iban, bic FROM suppliers WHERE id = ? AND tenant_id = ?', [$i['supplier_id'], $c->tenantId]);
            $i['po'] = $i['po_id'] ? $c->db->get('SELECT id, number FROM purchase_orders WHERE id = ? AND tenant_id = ?', [$i['po_id'], $c->tenantId]) : null;
            $i['payments'] = $c->db->all('SELECT p.id, p.date, p.amount_cents, p.method, p.reference, p.reversed, a.number AS account_number, a.name AS account_name FROM payments p JOIN accounts a ON a.id = p.account_id WHERE p.tenant_id = ? AND p.ref_type = \'supplier_invoice\' AND p.ref_id = ? ORDER BY p.id', [$c->tenantId, $i['id']]);
            $i['open_cents'] = (int) $i['gross_cents'] - (int) $i['paid_cents'];
            return $i;
        });
        $r->post('/purchasing/invoices', 'purchasing:w', function (Ctx $c) {
            $s = self::supplier($c, vint($c->body, 'supplier_id', 'Lieferant', 1, 2000000000, true));
            $ref = vstr($c->body, 'supplier_ref', 'Rechnungsnummer des Lieferanten', 80, true);
            if ($c->db->get('SELECT id FROM supplier_invoices WHERE tenant_id = ? AND supplier_id = ? AND supplier_ref = ? AND status <> \'cancelled\'', [$c->tenantId, $s['id'], $ref])) throw conflict('Diese Rechnung wurde für den Lieferanten schon erfasst.');
            $date = vdate($c->body, 'date', 'Rechnungsdatum', false, today());
            $due = vdate($c->body, 'due_date', 'Fällig am', false, add_days($date, (int) $s['payment_days']));
            $poId = vint($c->body, 'po_id', 'Bestellung', 0);
            if ($poId) {
                $po = self::po($c, $poId);
                if ((int) $po['supplier_id'] !== (int) $s['id']) throw bad('Die Bestellung gehört zu einem anderen Lieferanten.');
            }
            $raw = $c->body['lines'] ?? null;
            if (!is_array($raw) || !$raw) throw bad('Bitte mindestens eine Position erfassen.');
            $lines = [];
            foreach ($raw as $l) {
                $tax = vtax($l['tax_rate'] ?? 19);
                $net = vint($l, 'net_cents', 'Nettobetrag', 0, 2000000000, true);
                $acc = vint($l, 'account_id', 'Konto', 0);
                if (!$acc) $acc = Accounting::sys($c->db, $c->tenantId, 'goods_' . Accounting::taxSuffix($tax));
                if (!$c->db->get("SELECT id FROM accounts WHERE id = ? AND tenant_id = ? AND kind = 'general' AND type IN ('expense','asset') AND active = 1", [$acc, $c->tenantId])) throw bad('Bitte ein Aufwands- oder Anlagenkonto wählen.');
                $plid = vint($l, 'po_line_id', 'Bestellposition', 0);
                $qty = r3(vnum($l, 'qty', 'Menge', 0, 1e7, false, 1));
                if ($plid) {
                    $pl = $c->db->get('SELECT * FROM po_lines WHERE id = ? AND tenant_id = ? AND po_id = ?', [$plid, $c->tenantId, $poId]) ?? throw bad('Bestellposition gehört nicht zur Bestellung');
                    if ($qty > (float) $pl['qty'] - (float) $pl['qty_invoiced'] + self::EPS) throw conflict("Es kann höchstens die bestellte Restmenge abgerechnet werden: {$pl['description']}");
                }
                $lines[] = ['description' => vstr($l, 'description', 'Beschreibung', 500, true), 'qty' => $qty, 'net_cents' => $net, 'tax_rate' => $tax, 'account_id' => $acc, 'po_line_id' => $plid ?: null];
            }
            $tot = totals($lines);
            if ($tot['gross_cents'] <= 0) throw bad('Der Rechnungsbetrag muss größer 0 sein.');
            $number = next_number($c->db, $c->tenantId, 'ER', $date);
            $id = $c->db->insert('supplier_invoices', ['tenant_id' => $c->tenantId, 'number' => $number, 'supplier_id' => $s['id'], 'po_id' => $poId ?: null, 'supplier_ref' => $ref, 'date' => $date, 'due_date' => $due, 'net_cents' => $tot['net_cents'], 'tax_cents' => $tot['tax_cents'], 'gross_cents' => $tot['gross_cents'], 'status' => 'open', 'note' => vstr($c->body, 'note', 'Notiz', 300), 'created_by' => $c->userId()]);
            $pl = [['account_id' => (int) $s['account_id'], 'credit' => $tot['gross_cents'], 'text' => $ref]];
            foreach ($lines as $l) {
                $c->db->insert('supplier_invoice_lines', ['tenant_id' => $c->tenantId, 'invoice_id' => $id] + $l);
                $pl[] = ['account_id' => $l['account_id'], 'debit' => $l['net_cents'], 'text' => $l['description']];
                if ($l['po_line_id']) $c->db->run('UPDATE po_lines SET qty_invoiced = qty_invoiced + ? WHERE id = ? AND tenant_id = ?', [$l['qty'], $l['po_line_id'], $c->tenantId]);
            }
            foreach ($tot['byRate'] as $g) if ($g['tax_cents'] > 0) $pl[] = ['account_id' => Accounting::sys($c->db, $c->tenantId, 'vat_in_' . Accounting::taxSuffix($g['rate'])), 'debit' => $g['tax_cents'], 'text' => "Vorsteuer {$g['rate']} %"];
            $entry = Accounting::post($c, ['date' => $date, 'text' => "Eingangsrechnung $number {$s['name']} ($ref)", 'source' => 'supplier_invoice', 'ref_type' => 'supplier_invoice', 'ref_id' => $id, 'lines' => $pl]);
            $c->db->run('UPDATE supplier_invoices SET journal_entry_id = ? WHERE id = ? AND tenant_id = ?', [$entry['id'], $id, $c->tenantId]);
            if ($poId) self::refreshPo($c, $poId);
            audit($c, 'supplier_invoice', $id, 'create', "$number $ref");
            return ['id' => $id, 'number' => $number];
        });
        $r->post('/purchasing/invoices/:id/payments', 'accounting:w', function (Ctx $c) {
            $i = $c->db->get('SELECT * FROM supplier_invoices WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Eingangsrechnung');
            return ['id' => Payments::recordSupplier($c, $i, $c->body)];
        });
        $r->post('/purchasing/invoices/:id/cancel', 'purchasing:w', function (Ctx $c) {
            $i = $c->db->get('SELECT * FROM supplier_invoices WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Eingangsrechnung');
            if ($i['status'] === 'cancelled') throw conflict('Die Rechnung ist bereits storniert.');
            if ((int) $i['paid_cents'] > 0) throw conflict('Es wurden bereits Zahlungen gebucht. Bitte zuerst die Zahlungen stornieren.');
            Accounting::reverseForDocument($c, (int) $i['journal_entry_id'], "Storno Eingangsrechnung {$i['number']}");
            foreach ($c->db->all('SELECT po_line_id, qty FROM supplier_invoice_lines WHERE invoice_id = ? AND tenant_id = ? AND po_line_id IS NOT NULL', [$i['id'], $c->tenantId]) as $l) {
                $c->db->run('UPDATE po_lines SET qty_invoiced = qty_invoiced - ? WHERE id = ? AND tenant_id = ?', [(float) $l['qty'], $l['po_line_id'], $c->tenantId]);
            }
            $c->db->run("UPDATE supplier_invoices SET status = 'cancelled' WHERE id = ? AND tenant_id = ?", [$i['id'], $c->tenantId]);
            if ($i['po_id']) self::refreshPo($c, (int) $i['po_id']);
            audit($c, 'supplier_invoice', (int) $i['id'], 'cancel', $i['number']);
            return ['ok' => true];
        });

        // ----- Nachbestell-Vorschläge -----
        $r->get('/purchasing/reorder', 'purchasing:r', function (Ctx $c) {
            $t = $c->tenantId;
            $rows = [];
            $products = $c->db->all('SELECT p.id, p.sku, p.name, p.unit, p.min_stock, p.reorder_qty, p.cost_cents, p.supplier_id, s.name AS supplier FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.tenant_id = ? AND p.track_stock = 1 AND p.active = 1 AND p.min_stock > 0 ORDER BY p.name', [$t]);
            foreach ($products as $p) {
                $hand = Stock::onHand($c->db, $t, (int) $p['id']);
                $res = Stock::reserved($c->db, $t, (int) $p['id']);
                $ord = Stock::onOrder($c->db, $t, (int) $p['id']);
                $avail = $hand - $res + $ord;
                if ($avail > (float) $p['min_stock'] + self::EPS) continue;
                $target = (float) $p['reorder_qty'] > 0 ? (float) $p['min_stock'] + (float) $p['reorder_qty'] : (float) $p['min_stock'] * 2;
                $rows[] = $p + ['on_hand' => r3($hand), 'reserved' => r3($res), 'on_order' => r3($ord), 'available' => r3($avail), 'suggest_qty' => max(1.0, ceil($target - $avail))];
            }
            return ['rows' => $rows];
        });
        $r->post('/purchasing/reorder/create', 'purchasing:w', function (Ctx $c) {
            $bySupplier = [];
            foreach (($c->body['items'] ?? []) as $it) {
                $p = $c->db->get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [vint($it, 'product_id', 'Artikel', 1, 2000000000, true), $c->tenantId]) ?? throw bad('Artikel nicht gefunden');
                if (!$p['supplier_id']) throw bad("Für {$p['name']} ist kein Lieferant hinterlegt.");
                $qty = r3(vnum($it, 'qty', 'Menge', 0.001, 1e7, true));
                $bySupplier[(int) $p['supplier_id']][] = ['product_id' => (int) $p['id'], 'qty' => $qty, 'cost_cents' => (int) $p['cost_cents']];
            }
            if (!$bySupplier) throw bad('Keine Artikel ausgewählt.');
            $ids = [];
            foreach ($bySupplier as $sid => $items) $ids[] = self::createPo($c, ['supplier_id' => $sid, 'notes' => 'Aus Nachbestell-Vorschlag', 'lines' => $items]);
            return ['ids' => $ids];
        });
    }
}
