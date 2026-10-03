<?php
declare(strict_types=1);

namespace Erp\Api;

use Erp\{Ctx, Router};
use function Erp\{audit, bad, cast_rows, conflict, like, limit_of, next_number, not_found, today, vdate, vint, voneof, vstr};

/** Logistik: Frachtführer, Sendungen (ausgehend zu Kunden, eingehend von Lieferanten), Sendungsverfolgung mit Statusverlauf. */
final class LogisticsApi
{
    private const STATUS = ['planned', 'packed', 'shipped', 'in_transit', 'delivered', 'problem', 'cancelled'];

    private static function carrierUrl($v): ?string
    {
        $v = is_string($v) ? trim($v) : '';
        if ($v === '') return null;
        if (!preg_match('#^https://[^\s]+$#i', $v) || !str_contains($v, '{tracking}') || strlen($v) > 300) throw bad('Der Tracking-Link muss mit https:// beginnen und {tracking} enthalten.');
        return $v;
    }

    /** Legt zu einem Lieferschein eine Sendung an (wird auch beim Liefern aus dem Auftrag genutzt). */
    public static function createForDelivery(Ctx $c, int $deliveryId, array $b): int
    {
        $d = $c->db->get("SELECT d.*, cu.name AS customer FROM documents d JOIN customers cu ON cu.id = d.customer_id WHERE d.id = ? AND d.tenant_id = ? AND d.type = 'delivery'", [$deliveryId, $c->tenantId]) ?? throw not_found('Lieferschein');
        $carrier = vint($b, 'carrier_id', 'Frachtführer', 0);
        if ($carrier && !$c->db->get('SELECT id FROM carriers WHERE id = ? AND tenant_id = ? AND active = 1', [$carrier, $c->tenantId])) throw bad('Frachtführer nicht gefunden');
        $weight = (int) $c->db->val('SELECT COALESCE(SUM(p.weight_g * l.qty), 0) FROM document_lines l JOIN products p ON p.id = l.product_id WHERE l.document_id = ? AND l.tenant_id = ?', [$deliveryId, $c->tenantId], 0);
        $id = $c->db->insert('shipments', ['tenant_id' => $c->tenantId, 'number' => next_number($c->db, $c->tenantId, 'SE'), 'direction' => 'outbound', 'delivery_id' => $deliveryId,
            'party_name' => $d['customer'], 'address' => $d['ship_to'], 'carrier_id' => $carrier ?: null, 'tracking_no' => vstr($b, 'tracking_no', 'Sendungsnummer', 80),
            'status' => 'planned', 'packages' => max(1, vint($b, 'packages', 'Pakete', 1, 9999, false, 1)), 'weight_g' => $weight]);
        $c->db->insert('shipment_events', ['tenant_id' => $c->tenantId, 'shipment_id' => $id, 'status' => 'planned', 'note' => 'Sendung angelegt zu ' . $d['number'], 'user_name' => $c->user['name']]);
        return $id;
    }

    private static function row(Ctx $c, int $id): array
    {
        return $c->db->get('SELECT s.*, ca.name AS carrier, ca.tracking_url FROM shipments s LEFT JOIN carriers ca ON ca.id = s.carrier_id WHERE s.id = ? AND s.tenant_id = ?', [$id, $c->tenantId]) ?? throw not_found('Sendung');
    }
    private static function decorate(array $s): array
    {
        $s['track_link'] = ($s['tracking_url'] ?? null) && ($s['tracking_no'] ?? null) ? str_replace('{tracking}', rawurlencode((string) $s['tracking_no']), $s['tracking_url']) : null;
        $s['late'] = $s['eta'] && $s['eta'] < today() && in_array($s['status'], ['planned', 'packed', 'shipped', 'in_transit'], true);
        unset($s['tracking_url']);
        return $s;
    }

    public static function register(Router $r): void
    {
        // ----- Frachtführer -----
        $r->get('/logistics/carriers', 'logistics:r', fn(Ctx $c) => ['rows' => $c->db->all('SELECT id, name, tracking_url, active FROM carriers WHERE tenant_id = ? ORDER BY active DESC, name', [$c->tenantId])]);
        $r->post('/logistics/carriers', 'logistics:w', fn(Ctx $c) => ['id' => $c->db->insert('carriers', ['tenant_id' => $c->tenantId, 'name' => vstr($c->body, 'name', 'Name', 100, true), 'tracking_url' => self::carrierUrl($c->body['tracking_url'] ?? null), 'active' => 1])]);
        $r->put('/logistics/carriers/:id', 'logistics:w', function (Ctx $c) {
            $c->db->get('SELECT id FROM carriers WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Frachtführer');
            $c->db->update('carriers', $c->tenantId, $c->id(), ['name' => vstr($c->body, 'name', 'Name', 100, true), 'tracking_url' => self::carrierUrl($c->body['tracking_url'] ?? null), 'active' => array_key_exists('active', $c->body) ? ($c->body['active'] ? 1 : 0) : 1]);
            return ['ok' => true];
        });

        // ----- Sendungen -----
        $r->get('/logistics/shipments', 'logistics:r', function (Ctx $c) {
            $where = ['s.tenant_id = ?'];
            $p = [$c->tenantId];
            if ($st = $c->q('status')) {
                if ($st === 'active') $where[] = "s.status IN ('planned','packed','shipped','in_transit','problem')";
                else { $where[] = 's.status = ?'; $p[] = $st; }
            }
            if ($dir = $c->q('direction')) { $where[] = 's.direction = ?'; $p[] = $dir; }
            if ($q = $c->q('q')) { $where[] = '(s.number LIKE ? OR s.party_name LIKE ? OR s.tracking_no LIKE ?)'; array_push($p, like($q), like($q), like($q)); }
            $limit = limit_of($c->q('limit'), 200, 1000);
            $rows = $c->db->all('SELECT s.*, ca.name AS carrier, ca.tracking_url, d.number AS delivery_number, o.number AS po_number FROM shipments s LEFT JOIN carriers ca ON ca.id = s.carrier_id LEFT JOIN documents d ON d.id = s.delivery_id LEFT JOIN purchase_orders o ON o.id = s.po_id WHERE ' . implode(' AND ', $where) . " ORDER BY s.id DESC LIMIT $limit", $p);
            $counts = [];
            foreach ($c->db->all('SELECT status, COUNT(*) AS n FROM shipments WHERE tenant_id = ? GROUP BY status', [$c->tenantId]) as $x) $counts[$x['status']] = (int) $x['n'];
            return ['rows' => array_map([self::class, 'decorate'], $rows), 'counts' => (object) $counts];
        });
        $r->get('/logistics/shipments/:id', 'logistics:r', function (Ctx $c) {
            $s = self::decorate(self::row($c, $c->id()));
            $s['events'] = $c->db->all('SELECT ts, status, note, user_name FROM shipment_events WHERE tenant_id = ? AND shipment_id = ? ORDER BY id', [$c->tenantId, $s['id']]);
            $s['delivery'] = $s['delivery_id'] ? $c->db->get('SELECT id, number FROM documents WHERE id = ? AND tenant_id = ?', [$s['delivery_id'], $c->tenantId]) : null;
            $s['po'] = $s['po_id'] ? $c->db->get('SELECT id, number FROM purchase_orders WHERE id = ? AND tenant_id = ?', [$s['po_id'], $c->tenantId]) : null;
            return $s;
        });
        $r->post('/logistics/shipments', 'logistics:w', function (Ctx $c) {
            $b = $c->body;
            $dir = voneof($b['direction'] ?? 'outbound', ['outbound', 'inbound'], 'Richtung');
            if ($dir === 'outbound' && !empty($b['delivery_id'])) {
                $id = self::createForDelivery($c, vint($b, 'delivery_id', 'Lieferschein', 1), $b);
            } else {
                $carrier = vint($b, 'carrier_id', 'Frachtführer', 0);
                if ($carrier && !$c->db->get('SELECT id FROM carriers WHERE id = ? AND tenant_id = ?', [$carrier, $c->tenantId])) throw bad('Frachtführer nicht gefunden');
                $poId = vint($b, 'po_id', 'Bestellung', 0);
                $party = vstr($b, 'party_name', 'Empfänger/Absender', 200);
                if ($poId) {
                    $po = $c->db->get('SELECT o.id, s.name FROM purchase_orders o JOIN suppliers s ON s.id = o.supplier_id WHERE o.id = ? AND o.tenant_id = ?', [$poId, $c->tenantId]) ?? throw bad('Bestellung nicht gefunden');
                    $party ??= $po['name'];
                }
                if (!$party) throw bad('Empfänger bzw. Absender fehlt');
                $id = $c->db->insert('shipments', ['tenant_id' => $c->tenantId, 'number' => next_number($c->db, $c->tenantId, 'SE'), 'direction' => $dir, 'po_id' => $poId ?: null, 'party_name' => $party,
                    'address' => vstr($b, 'address', 'Adresse', 500), 'carrier_id' => $carrier ?: null, 'tracking_no' => vstr($b, 'tracking_no', 'Sendungsnummer', 80), 'status' => $dir === 'inbound' ? 'shipped' : 'planned',
                    'packages' => vint($b, 'packages', 'Pakete', 1, 9999, false, 1), 'weight_g' => vint($b, 'weight_g', 'Gewicht', 0), 'notes' => vstr($b, 'notes', 'Notizen', 500)]);
                $c->db->insert('shipment_events', ['tenant_id' => $c->tenantId, 'shipment_id' => $id, 'status' => $dir === 'inbound' ? 'shipped' : 'planned', 'note' => 'Sendung angelegt', 'user_name' => $c->user['name']]);
            }
            $row = [];
            foreach (['ship_date' => 'Versanddatum', 'eta' => 'Voraussichtliche Ankunft'] as $k => $label) if (!empty($b[$k])) $row[$k] = vdate($b, $k, $label);
            if (isset($b['cost_cents'])) $row['cost_cents'] = vint($b, 'cost_cents', 'Frachtkosten', 0);
            if (isset($b['weight_g']) && $b['weight_g'] !== '') $row['weight_g'] = vint($b, 'weight_g', 'Gewicht', 0);
            if (isset($b['notes'])) $row['notes'] = vstr($b, 'notes', 'Notizen', 500);
            $c->db->update('shipments', $c->tenantId, $id, $row);
            audit($c, 'shipment', $id, 'create');
            return ['id' => $id];
        });
        $r->put('/logistics/shipments/:id', 'logistics:w', function (Ctx $c) {
            $s = self::row($c, $c->id());
            $b = $c->body;
            $carrier = vint($b, 'carrier_id', 'Frachtführer', 0);
            if ($carrier && !$c->db->get('SELECT id FROM carriers WHERE id = ? AND tenant_id = ?', [$carrier, $c->tenantId])) throw bad('Frachtführer nicht gefunden');
            $c->db->update('shipments', $c->tenantId, (int) $s['id'], [
                'carrier_id' => $carrier ?: null, 'tracking_no' => vstr($b, 'tracking_no', 'Sendungsnummer', 80), 'ship_date' => vdate($b, 'ship_date', 'Versanddatum'), 'eta' => vdate($b, 'eta', 'Voraussichtliche Ankunft'),
                'packages' => vint($b, 'packages', 'Pakete', 1, 9999, false, 1), 'weight_g' => vint($b, 'weight_g', 'Gewicht', 0), 'cost_cents' => vint($b, 'cost_cents', 'Frachtkosten', 0), 'notes' => vstr($b, 'notes', 'Notizen', 500),
                'address' => vstr($b, 'address', 'Adresse', 500) ?? $s['address'],
            ]);
            return ['ok' => true];
        });
        $r->post('/logistics/shipments/:id/status', 'logistics:w', function (Ctx $c) {
            $s = self::row($c, $c->id());
            $new = voneof($c->body['status'] ?? '', self::STATUS, 'Status');
            if ($s['status'] === 'cancelled') throw conflict('Die Sendung ist storniert.');
            if ($s['status'] === 'delivered' && $new !== 'problem') throw conflict('Die Sendung wurde bereits zugestellt.');
            $row = ['status' => $new];
            if ($new === 'shipped' && !$s['ship_date']) $row['ship_date'] = today();
            if ($new === 'delivered') $row['delivered_at'] = date('Y-m-d H:i:s');
            $c->db->update('shipments', $c->tenantId, (int) $s['id'], $row);
            $c->db->insert('shipment_events', ['tenant_id' => $c->tenantId, 'shipment_id' => $s['id'], 'status' => $new, 'note' => vstr($c->body, 'note', 'Notiz', 300), 'user_name' => $c->user['name']]);
            return ['ok' => true];
        });
    }
}
