<?php
declare(strict_types=1);

namespace Erp\Api;

use Erp\{Ctx, Router, Stock};
use function Erp\{audit, bad, cast_row, cast_rows, conflict, like, limit_of, next_number, not_found, r3, vint, vnum, vstr, vtax};

/** Artikel, Lager, Bestände, Umlagerung, Korrekturen, Inventur und Nachbestell-Vorschläge. */
final class CatalogApi
{
    private static function product(Ctx $c, ?int $id = null): array
    {
        $b = $c->body;
        $sku = vstr($b, 'sku', 'Artikelnummer', 40, true);
        $dup = $c->db->get('SELECT id FROM products WHERE tenant_id = ? AND sku = ?' . ($id ? ' AND id <> ?' : ''), $id ? [$c->tenantId, $sku, $id] : [$c->tenantId, $sku]);
        if ($dup) throw conflict('Diese Artikelnummer gibt es schon.');
        $supplier = vint($b, 'supplier_id', 'Lieferant', 0);
        if ($supplier && !$c->db->get('SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?', [$supplier, $c->tenantId])) throw bad('Lieferant nicht gefunden');
        return [
            'sku' => $sku, 'name' => vstr($b, 'name', 'Bezeichnung', 200, true), 'description' => vstr($b, 'description', 'Beschreibung', 2000),
            'category' => vstr($b, 'category', 'Kategorie', 100), 'unit' => vstr($b, 'unit', 'Einheit', 12) ?? 'Stk',
            'price_cents' => vint($b, 'price_cents', 'Verkaufspreis', 0), 'cost_cents' => vint($b, 'cost_cents', 'Einkaufspreis', 0),
            'tax_rate' => vtax($b['tax_rate'] ?? 19), 'track_stock' => !empty($b['track_stock']) ? 1 : 0,
            'min_stock' => vnum($b, 'min_stock', 'Mindestbestand', 0), 'reorder_qty' => vnum($b, 'reorder_qty', 'Nachbestellmenge', 0),
            'supplier_id' => $supplier ?: null, 'barcode' => vstr($b, 'barcode', 'Barcode', 60), 'weight_g' => vint($b, 'weight_g', 'Gewicht', 0),
            'active' => array_key_exists('active', $b) ? ($b['active'] ? 1 : 0) : 1,
        ];
    }

    public static function register(Router $r): void
    {
        // ----- Artikel -----
        $r->get('/products', 'sales:r', function (Ctx $c) {
            $where = ['p.tenant_id = ?'];
            $p = [$c->tenantId];
            if ($q = $c->q('q')) { $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)'; array_push($p, like($q), like($q), like($q)); }
            if ($cat = $c->q('category')) { $where[] = 'p.category = ?'; $p[] = $cat; }
            if ($c->q('active') === '1') $where[] = 'p.active = 1';
            $limit = limit_of($c->q('limit'), 200, 1000);
            $w = implode(' AND ', $where);
            $rows = cast_rows($c->db->all(
                "SELECT p.*,
                   (SELECT COALESCE(SUM(s.qty), 0) FROM stock_levels s WHERE s.product_id = p.id) AS on_hand,
                   (SELECT COALESCE(SUM(l.qty - l.qty_delivered), 0) FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE l.tenant_id = p.tenant_id AND l.product_id = p.id AND d.type = 'order' AND d.status IN ('open','partial')) AS reserved
                  FROM products p WHERE $w ORDER BY p.name LIMIT $limit", $p), [], ['on_hand', 'reserved']);
            if ($c->q('low') === '1') $rows = array_values(array_filter($rows, fn($x) => $x['track_stock'] && $x['min_stock'] > 0 && $x['on_hand'] - $x['reserved'] <= $x['min_stock']));
            $cats = $c->db->all('SELECT DISTINCT category FROM products WHERE tenant_id = ? AND category IS NOT NULL ORDER BY category', [$c->tenantId]);
            return ['rows' => $rows, 'categories' => array_column($cats, 'category')];
        });
        $r->post('/products', 'stock:w', function (Ctx $c) {
            $row = self::product($c);
            $id = $c->db->insert('products', ['tenant_id' => $c->tenantId, 'avg_cost_cents' => $row['cost_cents']] + $row);
            audit($c, 'product', $id, 'create', $row['sku']);
            return ['id' => $id];
        });
        $r->get('/products/:id', 'sales:r', function (Ctx $c) {
            $p = $c->db->get('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Artikel');
            $levels = cast_rows($c->db->all('SELECT w.id AS warehouse_id, w.name AS warehouse, COALESCE(s.qty, 0) AS qty, s.bin FROM warehouses w LEFT JOIN stock_levels s ON s.warehouse_id = w.id AND s.product_id = ? WHERE w.tenant_id = ? AND w.active = 1 ORDER BY w.name', [$p['id'], $c->tenantId]), [], ['qty']);
            $moves = $c->db->all('SELECT m.id, m.ts, m.delta, m.kind, m.ref_type, m.ref_id, m.ref_number, m.note, w.name AS warehouse FROM stock_movements m JOIN warehouses w ON w.id = m.warehouse_id WHERE m.tenant_id = ? AND m.product_id = ? ORDER BY m.id DESC LIMIT 50', [$c->tenantId, $p['id']]);
            return ['item' => $p, 'levels' => $levels, 'movements' => $moves, 'on_hand' => Stock::onHand($c->db, $c->tenantId, (int) $p['id']),
                'reserved' => Stock::reserved($c->db, $c->tenantId, (int) $p['id']), 'on_order' => Stock::onOrder($c->db, $c->tenantId, (int) $p['id'])];
        });
        $r->put('/products/:id', 'stock:w', function (Ctx $c) {
            $old = $c->db->get('SELECT id FROM products WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Artikel');
            $row = self::product($c, (int) $old['id']);
            $c->db->update('products', $c->tenantId, (int) $old['id'], $row);
            audit($c, 'product', (int) $old['id'], 'update', $row['sku']);
            return ['ok' => true];
        });
        $r->delete('/products/:id', 'stock:w', function (Ctx $c) {
            $p = $c->db->get('SELECT id, sku FROM products WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Artikel');
            $used = (int) $c->db->val('SELECT (SELECT COUNT(*) FROM document_lines WHERE tenant_id = ? AND product_id = ?) + (SELECT COUNT(*) FROM po_lines WHERE tenant_id = ? AND product_id = ?) + (SELECT COUNT(*) FROM stock_movements WHERE tenant_id = ? AND product_id = ?)', [$c->tenantId, $p['id'], $c->tenantId, $p['id'], $c->tenantId, $p['id']]);
            if ($used) throw conflict('Der Artikel wird bereits verwendet. Bitte stattdessen deaktivieren.');
            $c->db->run('DELETE FROM stock_levels WHERE product_id = ? AND tenant_id = ?', [$p['id'], $c->tenantId]);
            $c->db->run('DELETE FROM products WHERE id = ? AND tenant_id = ?', [$p['id'], $c->tenantId]);
            audit($c, 'product', (int) $p['id'], 'delete', $p['sku']);
            return ['ok' => true];
        });

        // ----- Lager (Standorte) -----
        $r->get('/warehouses', 'stock:r', fn(Ctx $c) => ['rows' => $c->db->all('SELECT * FROM warehouses WHERE tenant_id = ? ORDER BY is_default DESC, name', [$c->tenantId])]);
        $wh = function (Ctx $c, ?int $id) {
            $code = strtoupper(vstr($c->body, 'code', 'Kürzel', 20, true));
            if ($c->db->get('SELECT id FROM warehouses WHERE tenant_id = ? AND code = ?' . ($id ? ' AND id <> ?' : ''), $id ? [$c->tenantId, $code, $id] : [$c->tenantId, $code])) throw conflict('Dieses Kürzel gibt es schon.');
            return ['name' => vstr($c->body, 'name', 'Name', 120, true), 'code' => $code, 'address' => vstr($c->body, 'address', 'Adresse', 300), 'active' => array_key_exists('active', $c->body) ? ($c->body['active'] ? 1 : 0) : 1];
        };
        $r->post('/warehouses', 'stock:w', function (Ctx $c) use ($wh) {
            $row = $wh($c, null);
            $first = !(int) $c->db->val('SELECT COUNT(*) FROM warehouses WHERE tenant_id = ?', [$c->tenantId]);
            return ['id' => $c->db->insert('warehouses', ['tenant_id' => $c->tenantId, 'is_default' => $first ? 1 : 0] + $row)];
        });
        $r->put('/warehouses/:id', 'stock:w', function (Ctx $c) use ($wh) {
            $w = $c->db->get('SELECT * FROM warehouses WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Lager');
            $row = $wh($c, (int) $w['id']);
            if (!$row['active'] && (int) $w['is_default']) throw conflict('Das Standardlager kann nicht deaktiviert werden.');
            if (!$row['active'] && (float) $c->db->val('SELECT COALESCE(SUM(ABS(qty)), 0) FROM stock_levels WHERE warehouse_id = ? AND tenant_id = ?', [$w['id'], $c->tenantId]) > 0) throw conflict('Das Lager enthält noch Bestand.');
            if (!empty($c->body['is_default'])) {
                $c->db->run('UPDATE warehouses SET is_default = 0 WHERE tenant_id = ?', [$c->tenantId]);
                $row['is_default'] = 1;
            }
            $c->db->update('warehouses', $c->tenantId, (int) $w['id'], $row);
            return ['ok' => true];
        });

        // ----- Bestände -----
        $r->get('/stock', 'stock:r', function (Ctx $c) {
            $t = $c->tenantId;
            $whs = $c->db->all('SELECT id, name, code FROM warehouses WHERE tenant_id = ? AND active = 1 ORDER BY is_default DESC, name', [$t]);
            $where = ['p.tenant_id = ?', 'p.track_stock = 1', 'p.active = 1'];
            $p = [$t];
            if ($q = $c->q('q')) { $where[] = '(p.name LIKE ? OR p.sku LIKE ?)'; array_push($p, like($q), like($q)); }
            $products = cast_rows($c->db->all('SELECT p.id, p.sku, p.name, p.unit, p.min_stock, p.reorder_qty, p.avg_cost_cents, p.supplier_id FROM products p WHERE ' . implode(' AND ', $where) . ' ORDER BY p.name LIMIT 1000', $p), [], ['min_stock', 'reorder_qty']);
            $levels = [];
            foreach ($c->db->all('SELECT product_id, warehouse_id, qty, bin FROM stock_levels WHERE tenant_id = ?', [$t]) as $l) $levels[(int) $l['product_id']][(int) $l['warehouse_id']] = ['qty' => (float) $l['qty'], 'bin' => $l['bin']];
            $reserved = [];
            foreach ($c->db->all("SELECT l.product_id, SUM(l.qty - l.qty_delivered) AS q FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE l.tenant_id = ? AND d.type = 'order' AND d.status IN ('open','partial') AND l.product_id IS NOT NULL GROUP BY l.product_id", [$t]) as $x) $reserved[(int) $x['product_id']] = (float) $x['q'];
            $ordered = [];
            foreach ($c->db->all("SELECT l.product_id, SUM(l.qty - l.qty_received) AS q FROM po_lines l JOIN purchase_orders o ON o.id = l.po_id WHERE l.tenant_id = ? AND o.status IN ('ordered','partial') AND l.product_id IS NOT NULL GROUP BY l.product_id", [$t]) as $x) $ordered[(int) $x['product_id']] = (float) $x['q'];
            $rows = [];
            $totalValue = 0;
            foreach ($products as $pr) {
                $lv = $levels[(int) $pr['id']] ?? [];
                $total = array_sum(array_column($lv, 'qty'));
                $res = $reserved[(int) $pr['id']] ?? 0.0;
                $value = (int) round($total * (int) $pr['avg_cost_cents']);
                $totalValue += max($value, 0);
                $rows[] = $pr + ['levels' => (object) $lv, 'total' => r3($total), 'reserved' => r3($res), 'available' => r3($total - $res), 'on_order' => r3($ordered[(int) $pr['id']] ?? 0), 'value_cents' => $value,
                    'low' => $pr['min_stock'] > 0 && ($total - $res) <= $pr['min_stock']];
            }
            if ($c->q('low') === '1') $rows = array_values(array_filter($rows, fn($x) => $x['low']));
            return ['warehouses' => $whs, 'rows' => $rows, 'value_cents' => $totalValue];
        });
        $r->get('/stock/movements', 'stock:r', function (Ctx $c) {
            $where = ['m.tenant_id = ?'];
            $p = [$c->tenantId];
            if ($pid = (int) $c->q('product_id', '0')) { $where[] = 'm.product_id = ?'; $p[] = $pid; }
            if ($wid = (int) $c->q('warehouse_id', '0')) { $where[] = 'm.warehouse_id = ?'; $p[] = $wid; }
            $limit = limit_of($c->q('limit'), 100, 500);
            return ['rows' => $c->db->all('SELECT m.id, m.ts, m.delta, m.kind, m.ref_type, m.ref_id, m.ref_number, m.note, m.unit_cost_cents, m.product_id, p.sku, p.name AS product, w.name AS warehouse FROM stock_movements m JOIN products p ON p.id = m.product_id JOIN warehouses w ON w.id = m.warehouse_id WHERE ' . implode(' AND ', $where) . " ORDER BY m.id DESC LIMIT $limit", $p)];
        });
        $r->post('/stock/adjust', 'stock:w', function (Ctx $c) {
            $pid = vint($c->body, 'product_id', 'Artikel', 1, 2000000000, true);
            $wid = vint($c->body, 'warehouse_id', 'Lager', 1, 2000000000, true);
            $p = $c->db->get('SELECT id, track_stock, avg_cost_cents FROM products WHERE id = ? AND tenant_id = ?', [$pid, $c->tenantId]) ?? throw not_found('Artikel');
            if (!(int) $p['track_stock']) throw bad('Für diesen Artikel wird kein Bestand geführt.');
            $reason = vstr($c->body, 'reason', 'Grund', 300, true);
            $cur = (float) $c->db->val('SELECT qty FROM stock_levels WHERE product_id = ? AND warehouse_id = ? AND tenant_id = ?', [$pid, $wid, $c->tenantId], 0);
            if (isset($c->body['counted']) && $c->body['counted'] !== '') $delta = r3(vnum($c->body, 'counted', 'Gezählte Menge', 0, 1e9) - $cur);
            else $delta = r3(vnum($c->body, 'delta', 'Änderung', -1e9, 1e9, true));
            if ($delta == 0) throw bad('Es gibt nichts zu ändern.');
            Stock::move($c, ['product_id' => $pid, 'warehouse_id' => $wid, 'delta' => $delta, 'kind' => 'adjustment', 'note' => $reason, 'unit_cost' => (int) $p['avg_cost_cents']]);
            audit($c, 'stock', $pid, 'adjust', "$delta: $reason");
            return ['delta' => $delta];
        });
        $r->post('/stock/transfer', 'stock:w', function (Ctx $c) {
            $pid = vint($c->body, 'product_id', 'Artikel', 1, 2000000000, true);
            $from = vint($c->body, 'from_warehouse_id', 'Von Lager', 1, 2000000000, true);
            $to = vint($c->body, 'to_warehouse_id', 'Nach Lager', 1, 2000000000, true);
            $qty = vnum($c->body, 'qty', 'Menge', 0.001, 1e9, true);
            if ($from === $to) throw bad('Quell- und Ziellager müssen verschieden sein.');
            $p = $c->db->get('SELECT id, track_stock FROM products WHERE id = ? AND tenant_id = ?', [$pid, $c->tenantId]) ?? throw not_found('Artikel');
            if (!(int) $p['track_stock']) throw bad('Für diesen Artikel wird kein Bestand geführt.');
            $note = vstr($c->body, 'note', 'Notiz', 300);
            Stock::move($c, ['product_id' => $pid, 'warehouse_id' => $from, 'delta' => -$qty, 'kind' => 'transfer_out', 'note' => $note]);
            Stock::move($c, ['product_id' => $pid, 'warehouse_id' => $to, 'delta' => $qty, 'kind' => 'transfer_in', 'note' => $note]);
            return ['ok' => true];
        });
        $r->put('/stock/bin', 'stock:w', function (Ctx $c) {
            $pid = vint($c->body, 'product_id', 'Artikel', 1, 2000000000, true);
            $wid = vint($c->body, 'warehouse_id', 'Lager', 1, 2000000000, true);
            $c->db->get('SELECT id FROM products WHERE id = ? AND tenant_id = ?', [$pid, $c->tenantId]) ?? throw not_found('Artikel');
            $c->db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ?', [$wid, $c->tenantId]) ?? throw not_found('Lager');
            $c->db->insertIgnore('stock_levels', ['tenant_id' => $c->tenantId, 'product_id' => $pid, 'warehouse_id' => $wid, 'qty' => 0]);
            $c->db->run('UPDATE stock_levels SET bin = ? WHERE product_id = ? AND warehouse_id = ? AND tenant_id = ?', [vstr($c->body, 'bin', 'Lagerplatz', 40), $pid, $wid, $c->tenantId]);
            return ['ok' => true];
        });

        // ----- Inventur -----
        $r->get('/inventory', 'stock:r', fn(Ctx $c) => ['rows' => cast_rows($c->db->all(
            'SELECT i.id, i.number, i.status, i.created_at, i.finished_at, w.name AS warehouse,
                    (SELECT COUNT(*) FROM inventory_count_lines l WHERE l.count_id = i.id) AS lines,
                    (SELECT COUNT(*) FROM inventory_count_lines l WHERE l.count_id = i.id AND l.counted IS NOT NULL) AS counted
               FROM inventory_counts i JOIN warehouses w ON w.id = i.warehouse_id WHERE i.tenant_id = ? ORDER BY i.id DESC LIMIT 100', [$c->tenantId]), ['lines', 'counted'])]);
        $r->post('/inventory', 'stock:w', function (Ctx $c) {
            $wid = vint($c->body, 'warehouse_id', 'Lager', 1, 2000000000, true);
            $c->db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ?', [$wid, $c->tenantId]) ?? throw not_found('Lager');
            if ($c->db->get("SELECT id FROM inventory_counts WHERE tenant_id = ? AND warehouse_id = ? AND status = 'open'", [$c->tenantId, $wid])) throw conflict('Für dieses Lager läuft bereits eine Inventur.');
            $id = $c->db->insert('inventory_counts', ['tenant_id' => $c->tenantId, 'number' => next_number($c->db, $c->tenantId, 'INV'), 'warehouse_id' => $wid, 'status' => 'open', 'user_id' => $c->userId()]);
            foreach ($c->db->all('SELECT p.id, COALESCE(s.qty, 0) AS qty FROM products p LEFT JOIN stock_levels s ON s.product_id = p.id AND s.warehouse_id = ? WHERE p.tenant_id = ? AND p.track_stock = 1 AND p.active = 1 ORDER BY p.name', [$wid, $c->tenantId]) as $row) {
                $c->db->insert('inventory_count_lines', ['tenant_id' => $c->tenantId, 'count_id' => $id, 'product_id' => $row['id'], 'expected' => (float) $row['qty']]);
            }
            return ['id' => $id];
        });
        $r->get('/inventory/:id', 'stock:r', function (Ctx $c) {
            $i = $c->db->get('SELECT i.*, w.name AS warehouse FROM inventory_counts i JOIN warehouses w ON w.id = i.warehouse_id WHERE i.id = ? AND i.tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Inventur');
            return ['item' => $i, 'lines' => $c->db->all('SELECT l.id, l.product_id, l.expected, l.counted, p.sku, p.name, p.unit FROM inventory_count_lines l JOIN products p ON p.id = l.product_id WHERE l.count_id = ? AND l.tenant_id = ? ORDER BY p.name', [$i['id'], $c->tenantId])];
        });
        $r->put('/inventory/:id', 'stock:w', function (Ctx $c) {
            $i = $c->db->get('SELECT id, status FROM inventory_counts WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Inventur');
            if ($i['status'] !== 'open') throw conflict('Die Inventur ist bereits abgeschlossen.');
            foreach (($c->body['lines'] ?? []) as $l) {
                if (!is_array($l)) continue;
                $counted = ($l['counted'] ?? '') === '' || $l['counted'] === null ? null : vnum($l, 'counted', 'Gezählte Menge', 0, 1e9);
                $c->db->run('UPDATE inventory_count_lines SET counted = ? WHERE id = ? AND count_id = ? AND tenant_id = ?', [$counted, (int) ($l['id'] ?? 0), $i['id'], $c->tenantId]);
            }
            return ['ok' => true];
        });
        $r->post('/inventory/:id/finish', 'stock:w', function (Ctx $c) {
            $i = $c->db->get('SELECT * FROM inventory_counts WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Inventur');
            if ($i['status'] !== 'open') throw conflict('Die Inventur ist bereits abgeschlossen.');
            $posted = 0;
            foreach ($c->db->all('SELECT l.product_id, l.counted, p.avg_cost_cents FROM inventory_count_lines l JOIN products p ON p.id = l.product_id WHERE l.count_id = ? AND l.tenant_id = ? AND l.counted IS NOT NULL', [$i['id'], $c->tenantId]) as $l) {
                $cur = (float) $c->db->val('SELECT qty FROM stock_levels WHERE product_id = ? AND warehouse_id = ? AND tenant_id = ?', [$l['product_id'], $i['warehouse_id'], $c->tenantId], 0);
                $delta = r3((float) $l['counted'] - $cur);
                if ($delta != 0) {
                    Stock::move($c, ['product_id' => (int) $l['product_id'], 'warehouse_id' => (int) $i['warehouse_id'], 'delta' => $delta, 'kind' => 'inventory', 'ref_type' => 'inventory', 'ref_id' => (int) $i['id'], 'ref_number' => $i['number'], 'note' => 'Inventurdifferenz', 'unit_cost' => (int) $l['avg_cost_cents']]);
                    $posted++;
                }
            }
            $c->db->run("UPDATE inventory_counts SET status = 'done', finished_at = ? WHERE id = ? AND tenant_id = ?", [date('Y-m-d H:i:s'), $i['id'], $c->tenantId]);
            audit($c, 'inventory', (int) $i['id'], 'finish', "$posted Differenzen gebucht");
            return ['differences' => $posted];
        });
        $r->delete('/inventory/:id', 'stock:w', function (Ctx $c) {
            $i = $c->db->get('SELECT id, status FROM inventory_counts WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Inventur');
            if ($i['status'] !== 'open') throw conflict('Abgeschlossene Inventuren bleiben zur Nachvollziehbarkeit erhalten.');
            $c->db->run('DELETE FROM inventory_count_lines WHERE count_id = ? AND tenant_id = ?', [$i['id'], $c->tenantId]);
            $c->db->run('DELETE FROM inventory_counts WHERE id = ? AND tenant_id = ?', [$i['id'], $c->tenantId]);
            return ['ok' => true];
        });
    }
}
