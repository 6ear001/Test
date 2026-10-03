<?php
declare(strict_types=1);

namespace Erp;

/** Lagerbewegungen. Jede Bestandsänderung läuft über Stock::move() und hinterlässt einen Eintrag im Bewegungsprotokoll. */
final class Stock
{
    public static function onHand(Db $db, int $tenantId, int $productId): float
    {
        return (float) $db->val('SELECT COALESCE(SUM(qty), 0) FROM stock_levels WHERE tenant_id = ? AND product_id = ?', [$tenantId, $productId], 0);
    }

    /**
     * Bucht eine Bestandsänderung ($m['delta'] > 0 Zugang, < 0 Abgang). Negative Bestände werden abgelehnt,
     * solange sie in den Einstellungen nicht erlaubt sind.
     */
    public static function move(Ctx $c, array $m): void
    {
        $db = $c->db;
        $t = $c->tenantId;
        $delta = r3($m['delta']);
        if (abs($delta) < 1e-6) return;
        if (!$db->get('SELECT id FROM warehouses WHERE id = ? AND tenant_id = ?', [$m['warehouse_id'], $t])) throw conflict('Lager nicht gefunden');
        $db->insertIgnore('stock_levels', ['tenant_id' => $t, 'product_id' => $m['product_id'], 'warehouse_id' => $m['warehouse_id'], 'qty' => 0]);
        $cur = (float) $db->val('SELECT qty FROM stock_levels WHERE product_id = ? AND warehouse_id = ? AND tenant_id = ?' . $db->forUpdate(), [$m['product_id'], $m['warehouse_id'], $t]);
        $next = r3($cur + $delta);
        if ($next < -1e-6 && !$c->settings()['allow_negative_stock']) {
            $p = $db->get('SELECT name, sku FROM products WHERE id = ? AND tenant_id = ?', [$m['product_id'], $t]);
            throw conflict(sprintf('Nicht genug Bestand für %s %s: vorhanden %s, benötigt %s', $p['sku'] ?? '', $p['name'] ?? '', rtrim(rtrim(number_format($cur, 3, ',', ''), '0'), ','), rtrim(rtrim(number_format(-$delta, 3, ',', ''), '0'), ',')));
        }
        $db->run('UPDATE stock_levels SET qty = ? WHERE product_id = ? AND warehouse_id = ? AND tenant_id = ?', [$next, $m['product_id'], $m['warehouse_id'], $t]);
        $db->insert('stock_movements', [
            'tenant_id' => $t, 'product_id' => $m['product_id'], 'warehouse_id' => $m['warehouse_id'], 'delta' => $delta, 'kind' => $m['kind'],
            'ref_type' => $m['ref_type'] ?? null, 'ref_id' => $m['ref_id'] ?? null, 'ref_number' => $m['ref_number'] ?? null,
            'note' => isset($m['note']) ? mb_substr((string) $m['note'], 0, 300) : null, 'unit_cost_cents' => $m['unit_cost'] ?? null, 'user_id' => $c->userId(),
        ]);
    }

    /** Gleitender Durchschnittspreis nach einem Wareneingang ($qtyBefore = Bestand vor dem Zugang). */
    public static function applyReceiptCost(Db $db, int $tenantId, int $productId, float $qty, int $costCents, float $qtyBefore): void
    {
        $avg0 = (int) $db->val('SELECT avg_cost_cents FROM products WHERE id = ? AND tenant_id = ?', [$productId, $tenantId], 0);
        $base = max($qtyBefore, 0.0);
        $avg = $base + $qty > 0 ? (int) round(($base * $avg0 + $qty * $costCents) / ($base + $qty)) : $costCents;
        $db->run('UPDATE products SET avg_cost_cents = ?, cost_cents = ? WHERE id = ? AND tenant_id = ?', [$avg, $costCents, $productId, $tenantId]);
    }

    /** Reserviert: Rest offener Kundenaufträge, der noch nicht geliefert ist. */
    public static function reserved(Db $db, int $tenantId, int $productId): float
    {
        return (float) $db->val(
            "SELECT COALESCE(SUM(l.qty - l.qty_delivered), 0) FROM document_lines l JOIN documents d ON d.id = l.document_id
              WHERE l.tenant_id = ? AND l.product_id = ? AND d.type = 'order' AND d.status IN ('open','partial')",
            [$tenantId, $productId], 0,
        );
    }
    /** Bestellt, aber noch nicht eingegangen. */
    public static function onOrder(Db $db, int $tenantId, int $productId): float
    {
        return (float) $db->val(
            "SELECT COALESCE(SUM(l.qty - l.qty_received), 0) FROM po_lines l JOIN purchase_orders p ON p.id = l.po_id
              WHERE l.tenant_id = ? AND l.product_id = ? AND p.status IN ('ordered','partial')",
            [$tenantId, $productId], 0,
        );
    }
}
