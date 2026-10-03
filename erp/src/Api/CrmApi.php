<?php
declare(strict_types=1);

namespace Erp\Api;

use Erp\{Accounting, Ctx, Router};
use function Erp\{audit, bad, cast_row, cast_rows, conflict, is_date, like, limit_of, not_found, today, vdate, vemail, vint, vnum, voneof, vstr};

/** Kundenverwaltung (CRM) und Lieferanten: Stammdaten, Ansprechpartner, Aktivitäten/Aufgaben, Kundenakte, Kontoauszug. */
final class CrmApi
{
    private const KINDS = ['note', 'call', 'email', 'meeting', 'task'];

    /** Prüft und sammelt die Felder eines Kunden bzw. Lieferanten. */
    private static function fields(array $b, string $type): array
    {
        $country = strtoupper(vstr($b, 'country', 'Land', 2) ?? 'DE');
        if (!preg_match('/^[A-Z]{2}$/', $country)) throw bad('Land muss ein 2-stelliger Ländercode sein (z. B. DE)');
        $row = [
            'name' => vstr($b, 'name', 'Name', 200, true), 'email' => vemail($b), 'phone' => vstr($b, 'phone', 'Telefon', 60),
            'website' => vstr($b, 'website', 'Webseite', 200), 'street' => vstr($b, 'street', 'Straße', 200), 'zip' => vstr($b, 'zip', 'PLZ', 20),
            'city' => vstr($b, 'city', 'Ort', 120), 'country' => $country, 'vat_id' => vstr($b, 'vat_id', 'USt-IdNr.', 30),
            'payment_days' => vint($b, 'payment_days', 'Zahlungsziel', 0, 365, false, 14), 'notes' => vstr($b, 'notes', 'Notizen', 4000),
        ];
        if ($type === 'customer') {
            $row += [
                'kind' => voneof($b['kind'] ?? 'company', ['company', 'person'], 'Art'),
                'status' => voneof($b['status'] ?? 'customer', ['lead', 'customer', 'inactive'], 'Status'),
                'discount_pct' => vnum($b, 'discount_pct', 'Rabatt', 0, 100),
                'credit_limit_cents' => vint($b, 'credit_limit_cents', 'Kreditlimit', 0),
                'tags' => vstr($b, 'tags', 'Schlagwörter', 200),
            ];
        } else {
            $iban = strtoupper(preg_replace('/\s+/', '', (string) ($b['iban'] ?? '')));
            if ($iban !== '' && !preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/', $iban)) throw bad('IBAN ist ungültig');
            $row += [
                'status' => voneof($b['status'] ?? 'active', ['active', 'inactive'], 'Status'),
                'iban' => $iban ?: null, 'bic' => vstr($b, 'bic', 'BIC', 20), 'lead_days' => vint($b, 'lead_days', 'Lieferzeit', 0, 365, false, 3),
            ];
        }
        return $row;
    }

    public static function register(Router $r): void
    {
        foreach (['customer' => ['customers', 'debtor', 'crm'], 'supplier' => ['suppliers', 'creditor', 'purchasing']] as $type => [$plural, $acctKind, $area]) {
            $table = $plural;
            $r->get("/$plural", "$area:r", function (Ctx $c) use ($table, $type) {
                $where = ['c.tenant_id = ?'];
                $p = [$c->tenantId];
                if ($q = $c->q('q')) {
                    $where[] = '(c.name LIKE ? OR c.number LIKE ? OR c.email LIKE ? OR c.city LIKE ?)';
                    array_push($p, like($q), like($q), like($q), like($q));
                }
                if ($s = $c->q('status')) { $where[] = 'c.status = ?'; $p[] = $s; }
                $limit = limit_of($c->q('limit'));
                $offset = max(0, (int) $c->q('offset', '0'));
                $w = implode(' AND ', $where);
                if ($type === 'customer') {
                    $sql = "SELECT c.id, c.number, c.name, c.kind, c.status, c.email, c.phone, c.city, c.tags, c.payment_days, c.credit_limit_cents,
                            (SELECT COALESCE(SUM(d.gross_cents - d.paid_cents - d.credited_cents), 0) FROM documents d WHERE d.tenant_id = c.tenant_id AND d.customer_id = c.id AND d.type = 'invoice' AND d.status IN ('open','partial')) AS open_cents,
                            (SELECT COALESCE(SUM(CASE WHEN d.type = 'invoice' THEN d.net_cents ELSE -d.net_cents END), 0) FROM documents d WHERE d.tenant_id = c.tenant_id AND d.customer_id = c.id AND ((d.type = 'invoice' AND d.status <> 'draft') OR d.type = 'credit_note')) AS revenue_cents
                            FROM customers c WHERE $w ORDER BY c.name LIMIT $limit OFFSET $offset";
                    $rows = cast_rows($c->db->all($sql, $p), ['open_cents', 'revenue_cents']);
                } else {
                    $sql = "SELECT c.id, c.number, c.name, c.status, c.email, c.phone, c.city, c.payment_days, c.lead_days,
                            (SELECT COALESCE(SUM(i.gross_cents - i.paid_cents), 0) FROM supplier_invoices i WHERE i.tenant_id = c.tenant_id AND i.supplier_id = c.id AND i.status IN ('open','partial')) AS open_cents,
                            (SELECT COALESCE(SUM(i.net_cents), 0) FROM supplier_invoices i WHERE i.tenant_id = c.tenant_id AND i.supplier_id = c.id AND i.status <> 'cancelled') AS volume_cents
                            FROM suppliers c WHERE $w ORDER BY c.name LIMIT $limit OFFSET $offset";
                    $rows = cast_rows($c->db->all($sql, $p), ['open_cents', 'volume_cents']);
                }
                $total = (int) $c->db->val("SELECT COUNT(*) FROM $table c WHERE $w", $p);
                return ['rows' => $rows, 'total' => $total];
            });

            $r->post("/$plural", "$area:w", function (Ctx $c) use ($table, $type, $acctKind) {
                $row = self::fields($c->body, $type);
                $acct = Accounting::createPartyAccount($c->db, $c->tenantId, $acctKind, 0, $row['name']);
                $id = $c->db->insert($table, ['tenant_id' => $c->tenantId, 'number' => $acct['number'], 'account_id' => $acct['id']] + $row);
                $c->db->run('UPDATE accounts SET party_id = ? WHERE id = ?', [$id, $acct['id']]);
                audit($c, $type, $id, 'create', $row['name']);
                return ['id' => $id, 'number' => $acct['number']];
            });

            $r->get("/$plural/:id", "$area:r", function (Ctx $c) use ($table, $type) {
                $row = $c->db->get("SELECT * FROM $table WHERE id = ? AND tenant_id = ?", [$c->id(), $c->tenantId]) ?? throw not_found($type === 'customer' ? 'Kunde' : 'Lieferant');
                $out = ['item' => $row, 'contacts' => $c->db->all('SELECT * FROM contacts WHERE tenant_id = ? AND party_type = ? AND party_id = ? ORDER BY is_primary DESC, name', [$c->tenantId, $type, $row['id']]),
                    'activities' => $c->db->all('SELECT * FROM activities WHERE tenant_id = ? AND party_type = ? AND party_id = ? ORDER BY done, COALESCE(due_date, \'9999-12-31\'), id DESC LIMIT 100', [$c->tenantId, $type, $row['id']])];
                $t = $c->tenantId;
                if ($type === 'customer') {
                    $year = date('Y') . '-01-01';
                    $out['stats'] = cast_row($c->db->get(
                        "SELECT
                          (SELECT COALESCE(SUM(gross_cents - paid_cents - credited_cents), 0) FROM documents WHERE tenant_id = ? AND customer_id = ? AND type = 'invoice' AND status IN ('open','partial')) AS open_cents,
                          (SELECT COALESCE(SUM(gross_cents - paid_cents - credited_cents), 0) FROM documents WHERE tenant_id = ? AND customer_id = ? AND type = 'invoice' AND status IN ('open','partial') AND due_date < ?) AS overdue_cents,
                          (SELECT COALESCE(SUM(CASE WHEN type = 'invoice' THEN net_cents ELSE -net_cents END), 0) FROM documents WHERE tenant_id = ? AND customer_id = ? AND ((type = 'invoice' AND status <> 'draft') OR type = 'credit_note')) AS revenue_cents,
                          (SELECT COALESCE(SUM(CASE WHEN type = 'invoice' THEN net_cents ELSE -net_cents END), 0) FROM documents WHERE tenant_id = ? AND customer_id = ? AND date >= ? AND ((type = 'invoice' AND status <> 'draft') OR type = 'credit_note')) AS revenue_year_cents,
                          (SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND customer_id = ? AND type = 'invoice' AND status <> 'draft') AS invoice_count,
                          (SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND customer_id = ? AND type = 'order' AND status IN ('open','partial','delivered')) AS open_orders",
                        [$t, $row['id'], $t, $row['id'], today(), $t, $row['id'], $t, $row['id'], $year, $t, $row['id'], $t, $row['id']],
                    ), ['open_cents', 'overdue_cents', 'revenue_cents', 'revenue_year_cents', 'invoice_count', 'open_orders']);
                    $out['documents'] = $c->db->all("SELECT id, type, number, status, date, due_date, gross_cents, paid_cents, credited_cents FROM documents WHERE tenant_id = ? AND customer_id = ? ORDER BY id DESC LIMIT 40", [$t, $row['id']]);
                    $out['shipments'] = $c->db->all("SELECT s.id, s.number, s.status, s.tracking_no, s.ship_date FROM shipments s JOIN documents d ON d.id = s.delivery_id WHERE s.tenant_id = ? AND d.customer_id = ? ORDER BY s.id DESC LIMIT 10", [$t, $row['id']]);
                } else {
                    $out['stats'] = cast_row($c->db->get(
                        "SELECT (SELECT COALESCE(SUM(gross_cents - paid_cents), 0) FROM supplier_invoices WHERE tenant_id = ? AND supplier_id = ? AND status IN ('open','partial')) AS open_cents,
                                (SELECT COALESCE(SUM(net_cents), 0) FROM supplier_invoices WHERE tenant_id = ? AND supplier_id = ? AND status <> 'cancelled') AS volume_cents,
                                (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ? AND supplier_id = ? AND status IN ('ordered','partial')) AS open_orders",
                        [$t, $row['id'], $t, $row['id'], $t, $row['id']],
                    ), ['open_cents', 'volume_cents', 'open_orders']);
                    $out['documents'] = $c->db->all("SELECT id, 'purchase_order' AS type, number, status, date, gross_cents, 0 AS paid_cents FROM purchase_orders WHERE tenant_id = ? AND supplier_id = ? ORDER BY id DESC LIMIT 30", [$t, $row['id']]);
                    $out['invoices'] = $c->db->all("SELECT id, number, supplier_ref, status, date, due_date, gross_cents, paid_cents FROM supplier_invoices WHERE tenant_id = ? AND supplier_id = ? ORDER BY id DESC LIMIT 30", [$t, $row['id']]);
                }
                return $out;
            });

            $r->put("/$plural/:id", "$area:w", function (Ctx $c) use ($table, $type) {
                $old = $c->db->get("SELECT id FROM $table WHERE id = ? AND tenant_id = ?", [$c->id(), $c->tenantId]) ?? throw not_found($type === 'customer' ? 'Kunde' : 'Lieferant');
                $row = self::fields($c->body, $type);
                $c->db->update($table, $c->tenantId, (int) $old['id'], $row);
                $c->db->run('UPDATE accounts SET name = ? WHERE tenant_id = ? AND party_id = ? AND kind IN (\'debtor\',\'creditor\') AND id = (SELECT account_id FROM ' . $table . ' WHERE id = ?)', [mb_substr($row['name'], 0, 200), $c->tenantId, $old['id'], $old['id']]);
                audit($c, $type, (int) $old['id'], 'update', $row['name']);
                return ['ok' => true];
            });

            $r->delete("/$plural/:id", "$area:w", function (Ctx $c) use ($table, $type) {
                $row = $c->db->get("SELECT id, name, account_id FROM $table WHERE id = ? AND tenant_id = ?", [$c->id(), $c->tenantId]) ?? throw not_found('Eintrag');
                $used = $type === 'customer'
                    ? (int) $c->db->val('SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND customer_id = ?', [$c->tenantId, $row['id']])
                    : (int) $c->db->val('SELECT (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ? AND supplier_id = ?) + (SELECT COUNT(*) FROM supplier_invoices WHERE tenant_id = ? AND supplier_id = ?) + (SELECT COUNT(*) FROM goods_receipts WHERE tenant_id = ? AND supplier_id = ?)', [$c->tenantId, $row['id'], $c->tenantId, $row['id'], $c->tenantId, $row['id']]);
                $booked = (int) $c->db->val('SELECT COUNT(*) FROM journal_lines WHERE tenant_id = ? AND account_id = ?', [$c->tenantId, $row['account_id']]);
                if ($used || $booked) throw conflict('Es gibt bereits Belege oder Buchungen. Bitte stattdessen auf „inaktiv“ setzen.');
                $c->db->run('DELETE FROM contacts WHERE tenant_id = ? AND party_type = ? AND party_id = ?', [$c->tenantId, $type, $row['id']]);
                $c->db->run('DELETE FROM activities WHERE tenant_id = ? AND party_type = ? AND party_id = ?', [$c->tenantId, $type, $row['id']]);
                $c->db->run("DELETE FROM $table WHERE id = ? AND tenant_id = ?", [$row['id'], $c->tenantId]);
                $c->db->run('DELETE FROM accounts WHERE id = ? AND tenant_id = ?', [$row['account_id'], $c->tenantId]);
                audit($c, $type, (int) $row['id'], 'delete', $row['name']);
                return ['ok' => true];
            });

            // Kontoauszug: Kontoblatt des Personenkontos plus offene Posten
            $r->get("/$plural/:id/statement", "$area:r", function (Ctx $c) use ($table, $type) {
                $row = $c->db->get("SELECT id, number, name, account_id FROM $table WHERE id = ? AND tenant_id = ?", [$c->id(), $c->tenantId]) ?? throw not_found('Eintrag');
                $from = $c->q('from', '0000-01-01');
                $to = $c->q('to', '9999-12-31');
                if (!is_date($from) && $from !== '0000-01-01' || !is_date($to) && $to !== '9999-12-31') throw bad('Datum ist ungültig');
                $led = Accounting::ledger($c->db, $c->tenantId, (int) $row['account_id'], $from, $to);
                $open = Accounting::openItems($c->db, $c->tenantId, $type === 'customer' ? 'debtors' : 'creditors');
                return ['party' => $row, 'ledger' => $led, 'open_items' => array_values(array_filter($open['rows'], fn($i) => (int) $i['party_id'] === (int) $row['id']))];
            });

            // Ansprechpartner
            $r->post("/$plural/:id/contacts", "$area:w", function (Ctx $c) use ($table, $type) {
                $c->db->get("SELECT id FROM $table WHERE id = ? AND tenant_id = ?", [$c->id(), $c->tenantId]) ?? throw not_found('Eintrag');
                $id = $c->db->insert('contacts', ['tenant_id' => $c->tenantId, 'party_type' => $type, 'party_id' => $c->id(), 'name' => vstr($c->body, 'name', 'Name', 160, true), 'role' => vstr($c->body, 'role', 'Funktion', 120), 'email' => vemail($c->body), 'phone' => vstr($c->body, 'phone', 'Telefon', 60), 'is_primary' => !empty($c->body['is_primary']) ? 1 : 0]);
                return ['id' => $id];
            });
            $r->post("/$plural/:id/activities", "$area:w", function (Ctx $c) use ($table, $type) {
                $c->db->get("SELECT id FROM $table WHERE id = ? AND tenant_id = ?", [$c->id(), $c->tenantId]) ?? throw not_found('Eintrag');
                $id = $c->db->insert('activities', ['tenant_id' => $c->tenantId, 'party_type' => $type, 'party_id' => $c->id(),
                    'kind' => voneof($c->body['kind'] ?? 'note', self::KINDS, 'Art'), 'text' => vstr($c->body, 'text', 'Text', 2000, true),
                    'due_date' => vdate($c->body, 'due_date', 'Fällig am'), 'user_id' => $c->userId(), 'user_name' => $c->user['name']]);
                return ['id' => $id];
            });
        }

        $r->put('/contacts/:id', 'auth', function (Ctx $c) {
            $ct = $c->db->get('SELECT id, party_type FROM contacts WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Ansprechpartner');
            self::need($c, $ct['party_type'] === 'customer' ? 'crm:w' : 'purchasing:w');
            $c->db->update('contacts', $c->tenantId, (int) $ct['id'], ['name' => vstr($c->body, 'name', 'Name', 160, true), 'role' => vstr($c->body, 'role', 'Funktion', 120), 'email' => vemail($c->body), 'phone' => vstr($c->body, 'phone', 'Telefon', 60), 'is_primary' => !empty($c->body['is_primary']) ? 1 : 0]);
            return ['ok' => true];
        });
        $r->delete('/contacts/:id', 'auth', function (Ctx $c) {
            $ct = $c->db->get('SELECT id, party_type FROM contacts WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Ansprechpartner');
            self::need($c, $ct['party_type'] === 'customer' ? 'crm:w' : 'purchasing:w');
            $c->db->run('DELETE FROM contacts WHERE id = ? AND tenant_id = ?', [$ct['id'], $c->tenantId]);
            return ['ok' => true];
        });
        $r->put('/activities/:id', 'auth', function (Ctx $c) {
            $a = $c->db->get('SELECT id, party_type FROM activities WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Aktivität');
            self::need($c, $a['party_type'] === 'customer' ? 'crm:w' : 'purchasing:w');
            $row = [];
            if (array_key_exists('done', $c->body)) $row['done'] = $c->body['done'] ? 1 : 0;
            if (array_key_exists('text', $c->body)) $row['text'] = vstr($c->body, 'text', 'Text', 2000, true);
            if (array_key_exists('due_date', $c->body)) $row['due_date'] = vdate($c->body, 'due_date', 'Fällig am');
            $c->db->update('activities', $c->tenantId, (int) $a['id'], $row);
            return ['ok' => true];
        });
        $r->delete('/activities/:id', 'auth', function (Ctx $c) {
            $a = $c->db->get('SELECT id, party_type FROM activities WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Aktivität');
            self::need($c, $a['party_type'] === 'customer' ? 'crm:w' : 'purchasing:w');
            $c->db->run('DELETE FROM activities WHERE id = ? AND tenant_id = ?', [$a['id'], $c->tenantId]);
            return ['ok' => true];
        });
        // Aufgaben und Wiedervorlagen (offene Aufgaben, zuerst die fälligen)
        $r->get('/activities', 'auth', function (Ctx $c) {
            $rows = $c->db->all(
                "SELECT a.id, a.party_type, a.party_id, a.kind, a.text, a.due_date, a.done, a.user_name,
                        CASE WHEN a.party_type = 'customer' THEN (SELECT name FROM customers WHERE id = a.party_id) ELSE (SELECT name FROM suppliers WHERE id = a.party_id) END AS party_name
                   FROM activities a WHERE a.tenant_id = ? AND a.done = 0 AND (a.kind = 'task' OR a.due_date IS NOT NULL)
                  ORDER BY COALESCE(a.due_date, '9999-12-31'), a.id LIMIT 50", [$c->tenantId]);
            return ['rows' => $rows];
        });
    }

    private static function need(Ctx $c, string $perm): void
    {
        if (!\Erp\can($c->user['role'], $perm)) throw \Erp\forbidden();
    }
}
