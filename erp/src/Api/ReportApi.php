<?php
declare(strict_types=1);

namespace Erp\Api;

use Erp\{Accounting, Ctx, Router, Stock};
use function Erp\{bad, can, cast_row, cast_rows, is_date, today, voneof};

/** Dashboard und Auswertungen. */
final class ReportApi
{
    private static function range(Ctx $c, string $defFrom, string $defTo): array
    {
        $from = $c->q('from', $defFrom);
        $to = $c->q('to', $defTo);
        if (!is_date($from) || !is_date($to)) throw bad('Datum ist ungültig');
        return [$from, $to];
    }

    public static function register(Router $r): void
    {
        $r->get('/reports/dashboard', 'auth', function (Ctx $c) {
            $t = $c->tenantId;
            $role = $c->user['role'];
            $db = $c->db;
            $today = today();
            $month = substr($today, 0, 7);
            $year = substr($today, 0, 4);
            $out = ['today' => $today, 'name' => $c->user['name']];
            $rev = "(CASE WHEN type = 'invoice' THEN net_cents ELSE -net_cents END)";
            $revWhere = "tenant_id = ? AND ((type = 'invoice' AND status <> 'draft') OR type = 'credit_note')";
            if (can($role, 'sales:r')) {
                $out['revenue_month_cents'] = (int) $db->val("SELECT COALESCE(SUM($rev), 0) FROM documents WHERE $revWhere AND SUBSTR(date, 1, 7) = ?", [$t, $month], 0);
                $out['revenue_year_cents'] = (int) $db->val("SELECT COALESCE(SUM($rev), 0) FROM documents WHERE $revWhere AND SUBSTR(date, 1, 4) = ?", [$t, $year], 0);
                $start = date('Y-m', strtotime('first day of -11 months')) . '-01';
                $series = [];
                for ($i = 11; $i >= 0; $i--) $series[date('Y-m', strtotime("first day of -$i months"))] = 0;
                foreach ($db->all("SELECT SUBSTR(date, 1, 7) AS m, SUM($rev) AS s FROM documents WHERE $revWhere AND date >= ? GROUP BY SUBSTR(date, 1, 7)", [$t, $start]) as $x) if (isset($series[$x['m']])) $series[$x['m']] = (int) $x['s'];
                $out['revenue_series'] = array_map(fn($m, $v) => ['month' => $m, 'cents' => $v], array_keys($series), array_values($series));
                $o = cast_row($db->get("SELECT COUNT(*) AS n, COALESCE(SUM(net_cents), 0) AS v FROM documents WHERE tenant_id = ? AND type = 'order' AND status IN ('open','partial','delivered')", [$t]), ['n', 'v']);
                $out['open_orders'] = ['count' => $o['n'], 'net_cents' => $o['v']];
                $out['open_quotes'] = (int) $db->val("SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND type = 'quote' AND status IN ('draft','sent','accepted')", [$t], 0);
                $out['draft_invoices'] = (int) $db->val("SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND type = 'invoice' AND status = 'draft'", [$t], 0);
                $out['receivables_cents'] = (int) $db->val("SELECT COALESCE(SUM(gross_cents - paid_cents - credited_cents), 0) FROM documents WHERE tenant_id = ? AND type = 'invoice' AND status IN ('open','partial')", [$t], 0);
                $out['receivables_overdue_cents'] = (int) $db->val("SELECT COALESCE(SUM(gross_cents - paid_cents - credited_cents), 0) FROM documents WHERE tenant_id = ? AND type = 'invoice' AND status IN ('open','partial') AND due_date < ?", [$t, $today], 0);
                $out['top_customers'] = cast_rows($db->all("SELECT c.id, c.name, SUM(CASE WHEN d.type = 'invoice' THEN d.net_cents ELSE -d.net_cents END) AS cents FROM documents d JOIN customers c ON c.id = d.customer_id WHERE d.tenant_id = ? AND ((d.type = 'invoice' AND d.status <> 'draft') OR d.type = 'credit_note') AND SUBSTR(d.date, 1, 4) = ? GROUP BY c.id, c.name ORDER BY cents DESC LIMIT 5", [$t, $year]), ['cents']);
                $out['top_products'] = cast_rows($db->all("SELECT COALESCE(l.sku, '') AS sku, l.description AS name, SUM(CASE WHEN d.type = 'invoice' THEN l.net_cents ELSE -l.net_cents END) AS cents, SUM(CASE WHEN d.type = 'invoice' THEN l.qty ELSE -l.qty END) AS qty FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE d.tenant_id = ? AND ((d.type = 'invoice' AND d.status <> 'draft') OR d.type = 'credit_note') AND SUBSTR(d.date, 1, 4) = ? GROUP BY l.sku, l.description ORDER BY cents DESC LIMIT 5", [$t, $year]), ['cents'], ['qty']);
                $out['recent'] = $db->all("SELECT d.id, d.type, d.number, d.status, d.date, d.gross_cents, c.name AS customer FROM documents d JOIN customers c ON c.id = d.customer_id WHERE d.tenant_id = ? AND d.type IN ('quote','order','invoice') ORDER BY d.id DESC LIMIT 8", [$t]);
                $out['customers'] = (int) $db->val("SELECT COUNT(*) FROM customers WHERE tenant_id = ? AND status = 'customer'", [$t], 0);
                $out['leads'] = (int) $db->val("SELECT COUNT(*) FROM customers WHERE tenant_id = ? AND status = 'lead'", [$t], 0);
            }
            if (can($role, 'purchasing:r')) {
                $out['payables_cents'] = (int) $db->val("SELECT COALESCE(SUM(gross_cents - paid_cents), 0) FROM supplier_invoices WHERE tenant_id = ? AND status IN ('open','partial')", [$t], 0);
                $out['payables_overdue_cents'] = (int) $db->val("SELECT COALESCE(SUM(gross_cents - paid_cents), 0) FROM supplier_invoices WHERE tenant_id = ? AND status IN ('open','partial') AND due_date < ?", [$t, $today], 0);
                $out['open_purchase_orders'] = (int) $db->val("SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ? AND status IN ('ordered','partial')", [$t], 0);
            }
            if (can($role, 'stock:r')) {
                $v = 0; $low = 0;
                foreach ($db->all('SELECT p.id, p.min_stock, p.avg_cost_cents FROM products p WHERE p.tenant_id = ? AND p.track_stock = 1 AND p.active = 1', [$t]) as $p) {
                    $hand = Stock::onHand($db, $t, (int) $p['id']);
                    $v += max(0, (int) round($hand * (int) $p['avg_cost_cents']));
                    if ((float) $p['min_stock'] > 0 && $hand - Stock::reserved($db, $t, (int) $p['id']) <= (float) $p['min_stock']) $low++;
                }
                $out['stock_value_cents'] = $v;
                $out['low_stock_count'] = $low;
            }
            if (can($role, 'logistics:r')) {
                $out['shipments_active'] = (int) $db->val("SELECT COUNT(*) FROM shipments WHERE tenant_id = ? AND status IN ('planned','packed','shipped','in_transit')", [$t], 0);
                $out['shipments_late'] = (int) $db->val("SELECT COUNT(*) FROM shipments WHERE tenant_id = ? AND status IN ('planned','packed','shipped','in_transit') AND eta IS NOT NULL AND eta < ?", [$t, $today], 0);
                $out['shipments_problem'] = (int) $db->val("SELECT COUNT(*) FROM shipments WHERE tenant_id = ? AND status = 'problem'", [$t], 0);
            }
            if (can($role, 'accounting:r')) {
                $out['cash_cents'] = (int) $db->val("SELECT COALESCE(SUM(l.debit_cents - l.credit_cents), 0) FROM journal_lines l JOIN accounts a ON a.id = l.account_id WHERE l.tenant_id = ? AND a.kind IN ('bank','cash') AND a.active = 1", [$t], 0);
            }
            $out['tasks_due'] = (int) $db->val("SELECT COUNT(*) FROM activities WHERE tenant_id = ? AND done = 0 AND (kind = 'task' OR due_date IS NOT NULL) AND (due_date IS NULL OR due_date <= ?)", [$t, $today], 0);
            return $out;
        });

        // ----- Auswertungen Buchhaltung -----
        $r->get('/reports/trial-balance', 'accounting:r', function (Ctx $c) {
            [$from, $to] = self::range($c, date('Y') . '-01-01', date('Y') . '-12-31');
            return Accounting::trialBalance($c->db, $c->tenantId, $from, $to, $c->q('detail') === '1') + ['from' => $from, 'to' => $to];
        });
        $r->get('/reports/pnl', 'accounting:r', function (Ctx $c) {
            [$from, $to] = self::range($c, date('Y') . '-01-01', date('Y') . '-12-31');
            return Accounting::profitAndLoss($c->db, $c->tenantId, $from, $to) + ['from' => $from, 'to' => $to];
        });
        $r->get('/reports/balance-sheet', 'accounting:r', function (Ctx $c) {
            $to = $c->q('to', today());
            if (!is_date($to)) throw bad('Datum ist ungültig');
            return Accounting::balanceSheet($c->db, $c->tenantId, $to) + ['to' => $to];
        });
        $r->get('/reports/vat', 'accounting:r', function (Ctx $c) {
            [$from, $to] = self::range($c, date('Y-m-01'), date('Y-m-t'));
            return Accounting::vat($c->db, $c->tenantId, $from, $to) + ['from' => $from, 'to' => $to];
        });

        // ----- Auswertungen Verkauf und Lager -----
        $r->get('/reports/sales', 'reports:r', function (Ctx $c) {
            [$from, $to] = self::range($c, date('Y') . '-01-01', date('Y') . '-12-31');
            $by = voneof($c->q('by', 'customer'), ['customer', 'product', 'month'], 'Gruppierung');
            $base = "((d.type = 'invoice' AND d.status <> 'draft') OR d.type = 'credit_note') AND d.tenant_id = ? AND d.date >= ? AND d.date <= ?";
            $sign = "(CASE WHEN d.type = 'invoice' THEN 1 ELSE -1 END)";
            $p = [$c->tenantId, $from, $to];
            if ($by === 'customer') $rows = cast_rows($c->db->all("SELECT c.number AS key_, c.name AS label, SUM($sign * d.net_cents) AS net_cents, SUM($sign * d.gross_cents) AS gross_cents, COUNT(*) AS docs FROM documents d JOIN customers c ON c.id = d.customer_id WHERE $base GROUP BY c.id, c.number, c.name ORDER BY net_cents DESC", $p), ['net_cents', 'gross_cents', 'docs']);
            elseif ($by === 'product') $rows = cast_rows($c->db->all("SELECT COALESCE(l.sku, '') AS key_, l.description AS label, SUM($sign * l.net_cents) AS net_cents, SUM($sign * l.qty) AS qty, COUNT(*) AS docs FROM document_lines l JOIN documents d ON d.id = l.document_id WHERE $base GROUP BY l.sku, l.description ORDER BY net_cents DESC", $p), ['net_cents', 'docs'], ['qty']);
            else $rows = cast_rows($c->db->all("SELECT SUBSTR(d.date, 1, 7) AS key_, SUBSTR(d.date, 1, 7) AS label, SUM($sign * d.net_cents) AS net_cents, SUM($sign * d.gross_cents) AS gross_cents, COUNT(*) AS docs FROM documents d WHERE $base GROUP BY SUBSTR(d.date, 1, 7) ORDER BY key_", $p), ['net_cents', 'gross_cents', 'docs']);
            return ['rows' => $rows, 'total_net_cents' => array_sum(array_column($rows, 'net_cents')), 'from' => $from, 'to' => $to, 'by' => $by];
        });
        $r->get('/reports/stock-value', 'stock:r', function (Ctx $c) {
            $rows = cast_rows($c->db->all('SELECT p.id, p.sku, p.name, p.unit, p.avg_cost_cents, (SELECT COALESCE(SUM(s.qty), 0) FROM stock_levels s WHERE s.product_id = p.id) AS qty FROM products p WHERE p.tenant_id = ? AND p.track_stock = 1 ORDER BY p.name', [$c->tenantId]), [], ['qty']);
            foreach ($rows as &$x) $x['value_cents'] = (int) round($x['qty'] * (int) $x['avg_cost_cents']);
            unset($x);
            $rows = array_values(array_filter($rows, fn($x) => abs($x['qty']) > 1e-9));
            return ['rows' => $rows, 'total_cents' => array_sum(array_column($rows, 'value_cents'))];
        });
    }
}
