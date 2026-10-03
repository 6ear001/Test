<?php
declare(strict_types=1);

namespace Erp\Api;

use Erp\{Accounting, Ctx, Router};
use function Erp\{audit, bad, cast_rows, conflict, is_date, like, limit_of, not_found, today, vdate, vint, voneof, vstr};

/** Buchhaltung: Kontenplan, Finanzkonten (Bank/Kasse), Journal, Buchungen, Umbuchungen, Privat, Offene Posten. */
final class FinanceApi
{
    private static function money(array $b, string $key = 'amount_cents'): int
    {
        return vint($b, $key, 'Betrag', 1, 2000000000, true);
    }
    private static function finance(Ctx $c, int $id): array
    {
        return $c->db->get("SELECT * FROM accounts WHERE id = ? AND tenant_id = ? AND kind IN ('bank','cash') AND active = 1", [$id, $c->tenantId]) ?? throw bad('Bitte ein Bank- oder Kassenkonto wählen');
    }
    private static function range(Ctx $c): array
    {
        $from = $c->q('from', '0000-01-01');
        $to = $c->q('to', '9999-12-31');
        if (($from !== '0000-01-01' && !is_date($from)) || ($to !== '9999-12-31' && !is_date($to))) throw bad('Datum ist ungültig');
        return [$from, $to];
    }

    public static function register(Router $r): void
    {
        // ----- Kontenplan -----
        $r->get('/accounting/accounts', 'accounting:r', function (Ctx $c) {
            $kind = $c->q('kind', 'general');
            $where = ['a.tenant_id = ?'];
            $p = [$c->tenantId];
            if ($kind === 'general') $where[] = "a.kind IN ('general','bank','cash')";
            elseif ($kind !== 'all') { $where[] = 'a.kind = ?'; $p[] = $kind; }
            if ($q = $c->q('q')) { $where[] = '(a.number LIKE ? OR a.name LIKE ?)'; array_push($p, like($q), like($q)); }
            if ($c->q('active') === '1') $where[] = 'a.active = 1';
            $limit = limit_of($c->q('limit'), 500, 2000);
            $rows = cast_rows($c->db->all('SELECT a.id, a.number, a.name, a.type, a.kind, a.system_key, a.active, a.party_id,
                    (SELECT COALESCE(SUM(l.debit_cents - l.credit_cents), 0) FROM journal_lines l WHERE l.tenant_id = a.tenant_id AND l.account_id = a.id) AS balance_cents
                    FROM accounts a WHERE ' . implode(' AND ', $where) . " ORDER BY a.number LIMIT $limit", $p), ['balance_cents']);
            return ['rows' => $rows];
        });
        // Aufwandskonten zur Auswahl in Eingangsrechnungen (auch für Einkäufer ohne Buchhaltungsrechte)
        $r->get('/accounting/expense-accounts', 'purchasing:w', fn(Ctx $c) => ['rows' => $c->db->all("SELECT id, number, name, system_key FROM accounts WHERE tenant_id = ? AND kind = 'general' AND type IN ('expense','asset') AND active = 1 ORDER BY number", [$c->tenantId])]);
        $r->post('/accounting/accounts', 'accounting:w', function (Ctx $c) {
            $number = vstr($c->body, 'number', 'Kontonummer', 4, true);
            if (!preg_match('/^\d{4}$/', $number)) throw bad('Sachkonten haben vierstellige Nummern (Personenkonten werden automatisch angelegt).');
            if ($c->db->get('SELECT id FROM accounts WHERE tenant_id = ? AND number = ?', [$c->tenantId, $number])) throw conflict('Diese Kontonummer gibt es schon.');
            $type = voneof($c->body['type'] ?? '', ['asset', 'liability', 'equity', 'revenue', 'expense'], 'Kontoart');
            $id = $c->db->insert('accounts', ['tenant_id' => $c->tenantId, 'number' => $number, 'name' => vstr($c->body, 'name', 'Bezeichnung', 200, true), 'type' => $type, 'kind' => 'general', 'active' => 1]);
            audit($c, 'account', $id, 'create', $number);
            return ['id' => $id];
        });
        $r->put('/accounting/accounts/:id', 'accounting:w', function (Ctx $c) {
            $a = $c->db->get("SELECT * FROM accounts WHERE id = ? AND tenant_id = ? AND kind IN ('general','bank','cash')", [$c->id(), $c->tenantId]) ?? throw not_found('Konto');
            $row = ['name' => vstr($c->body, 'name', 'Bezeichnung', 200, true)];
            if (array_key_exists('active', $c->body)) {
                if (!$c->body['active'] && $a['system_key']) throw conflict('Systemkonten können nicht deaktiviert werden.');
                $row['active'] = $c->body['active'] ? 1 : 0;
            }
            $c->db->update('accounts', $c->tenantId, (int) $a['id'], $row);
            return ['ok' => true];
        });
        $r->get('/accounting/accounts/:id/ledger', 'accounting:r', function (Ctx $c) {
            [$from, $to] = self::range($c);
            return Accounting::ledger($c->db, $c->tenantId, $c->id(), $from, $to);
        });

        // ----- Finanzkonten (eigene Konten: Bank und Kasse) -----
        $r->get('/accounting/finance-accounts', 'auth', function (Ctx $c) {
            $rows = cast_rows($c->db->all("SELECT a.id, a.number, a.name, a.kind, a.iban, a.bic, a.bank_name, a.active, (SELECT COALESCE(SUM(l.debit_cents - l.credit_cents), 0) FROM journal_lines l WHERE l.tenant_id = a.tenant_id AND l.account_id = a.id) AS balance_cents FROM accounts a WHERE a.tenant_id = ? AND a.kind IN ('bank','cash') ORDER BY a.active DESC, a.number", [$c->tenantId]), ['balance_cents']);
            return ['rows' => $rows, 'total_cents' => array_sum(array_map(fn($x) => $x['active'] ? $x['balance_cents'] : 0, $rows))];
        });
        $r->post('/accounting/finance-accounts', 'accounting:w', function (Ctx $c) {
            $kind = voneof($c->body['kind'] ?? 'bank', ['bank', 'cash'], 'Art');
            $base = $kind === 'bank' ? 1201 : 1001;
            $number = null;
            for ($n = $base; $n < $base + 99; $n++) if (!$c->db->get('SELECT id FROM accounts WHERE tenant_id = ? AND number = ?', [$c->tenantId, (string) $n])) { $number = (string) $n; break; }
            if (!$number) throw conflict('Keine freie Kontonummer mehr.');
            $iban = strtoupper(preg_replace('/\s+/', '', (string) ($c->body['iban'] ?? '')));
            if ($iban !== '' && !preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/', $iban)) throw bad('IBAN ist ungültig');
            $id = $c->db->insert('accounts', ['tenant_id' => $c->tenantId, 'number' => $number, 'name' => vstr($c->body, 'name', 'Bezeichnung', 200, true), 'type' => 'asset', 'kind' => $kind, 'active' => 1, 'iban' => $iban ?: null, 'bic' => vstr($c->body, 'bic', 'BIC', 20), 'bank_name' => vstr($c->body, 'bank_name', 'Bank', 120)]);
            $open = vint($c->body, 'opening_cents', 'Anfangsbestand', -2000000000, 2000000000);
            if ($open !== 0) {
                $acc = Accounting::sys($c->db, $c->tenantId, 'opening');
                Accounting::post($c, ['date' => vdate($c->body, 'opening_date', 'Datum Anfangsbestand', false, today()), 'text' => 'Anfangsbestand ' . $c->body['name'], 'source' => 'manual',
                    'lines' => [['account_id' => $id, 'debit' => max($open, 0), 'credit' => max(-$open, 0)], ['account_id' => $acc, 'debit' => max(-$open, 0), 'credit' => max($open, 0)]]]);
            }
            audit($c, 'account', $id, 'create', $number);
            return ['id' => $id, 'number' => $number];
        });
        $r->put('/accounting/finance-accounts/:id', 'accounting:w', function (Ctx $c) {
            $a = $c->db->get("SELECT id, system_key FROM accounts WHERE id = ? AND tenant_id = ? AND kind IN ('bank','cash')", [$c->id(), $c->tenantId]) ?? throw not_found('Konto');
            $iban = strtoupper(preg_replace('/\s+/', '', (string) ($c->body['iban'] ?? '')));
            if ($iban !== '' && !preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/', $iban)) throw bad('IBAN ist ungültig');
            $row = ['name' => vstr($c->body, 'name', 'Bezeichnung', 200, true), 'iban' => $iban ?: null, 'bic' => vstr($c->body, 'bic', 'BIC', 20), 'bank_name' => vstr($c->body, 'bank_name', 'Bank', 120)];
            if (array_key_exists('active', $c->body)) {
                if (!$c->body['active'] && $a['system_key']) throw conflict('Das Standardkonto kann nicht deaktiviert werden.');
                $row['active'] = $c->body['active'] ? 1 : 0;
            }
            $c->db->update('accounts', $c->tenantId, (int) $a['id'], $row);
            return ['ok' => true];
        });
        $r->post('/accounting/transfer', 'accounting:w', function (Ctx $c) {
            $from = self::finance($c, vint($c->body, 'from_account_id', 'Von Konto', 1, 2000000000, true));
            $to = self::finance($c, vint($c->body, 'to_account_id', 'Nach Konto', 1, 2000000000, true));
            if ($from['id'] === $to['id']) throw bad('Bitte zwei verschiedene Konten wählen.');
            $amount = self::money($c->body);
            $e = Accounting::post($c, ['date' => vdate($c->body, 'date', 'Datum', false, today()), 'text' => vstr($c->body, 'text', 'Text', 300) ?? "Umbuchung {$from['name']} → {$to['name']}", 'source' => 'transfer',
                'lines' => [['account_id' => (int) $to['id'], 'debit' => $amount], ['account_id' => (int) $from['id'], 'credit' => $amount]]]);
            audit($c, 'journal', $e['id'], 'transfer', $e['number']);
            return $e;
        });
        $r->post('/accounting/private', 'accounting:w', function (Ctx $c) {
            $type = voneof($c->body['type'] ?? '', ['withdrawal', 'deposit'], 'Art');
            $fin = self::finance($c, vint($c->body, 'account_id', 'Konto', 1, 2000000000, true));
            $amount = self::money($c->body);
            $priv = Accounting::sys($c->db, $c->tenantId, $type === 'withdrawal' ? 'drawings' : 'deposits');
            $lines = $type === 'withdrawal' ? [['account_id' => $priv, 'debit' => $amount], ['account_id' => (int) $fin['id'], 'credit' => $amount]] : [['account_id' => (int) $fin['id'], 'debit' => $amount], ['account_id' => $priv, 'credit' => $amount]];
            $e = Accounting::post($c, ['date' => vdate($c->body, 'date', 'Datum', false, today()), 'text' => vstr($c->body, 'text', 'Text', 300) ?? ($type === 'withdrawal' ? 'Privatentnahme' : 'Privateinlage'), 'source' => 'private', 'lines' => $lines]);
            audit($c, 'journal', $e['id'], 'private', $e['number']);
            return $e;
        });

        // ----- Journal -----
        $r->get('/accounting/journal', 'accounting:r', function (Ctx $c) {
            [$from, $to] = self::range($c);
            $where = ['e.tenant_id = ?', 'e.date >= ?', 'e.date <= ?'];
            $p = [$c->tenantId, $from, $to];
            if ($s = $c->q('source')) { $where[] = 'e.source = ?'; $p[] = $s; }
            if ($q = $c->q('q')) { $where[] = '(e.number LIKE ? OR e.text LIKE ?)'; array_push($p, like($q), like($q)); }
            if ($aid = (int) $c->q('account_id', '0')) { $where[] = 'EXISTS (SELECT 1 FROM journal_lines x WHERE x.entry_id = e.id AND x.account_id = ?)'; $p[] = $aid; }
            $limit = limit_of($c->q('limit'), 200, 2000);
            $rows = cast_rows($c->db->all('SELECT e.id, e.number, e.date, e.text, e.source, e.reverses_id, e.reversed_by_id, (SELECT COALESCE(SUM(l.debit_cents), 0) FROM journal_lines l WHERE l.entry_id = e.id) AS amount_cents FROM journal_entries e WHERE ' . implode(' AND ', $where) . " ORDER BY e.date DESC, e.id DESC LIMIT $limit", $p), ['amount_cents']);
            return ['rows' => $rows];
        });
        $r->get('/accounting/journal/:id', 'accounting:r', function (Ctx $c) {
            $e = $c->db->get('SELECT * FROM journal_entries WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Buchung');
            $e['lines'] = $c->db->all('SELECT l.id, l.account_id, a.number AS account_number, a.name AS account_name, l.debit_cents, l.credit_cents, l.text FROM journal_lines l JOIN accounts a ON a.id = l.account_id WHERE l.entry_id = ? AND l.tenant_id = ? ORDER BY l.id', [$e['id'], $c->tenantId]);
            return $e;
        });
        $r->post('/accounting/journal', 'accounting:w', function (Ctx $c) {
            $lines = [];
            foreach (($c->body['lines'] ?? []) as $l) {
                if (!is_array($l)) throw bad('Buchungszeile ist ungültig');
                $acc = $c->db->get('SELECT id, kind FROM accounts WHERE id = ? AND tenant_id = ?', [vint($l, 'account_id', 'Konto', 1, 2000000000, true), $c->tenantId]) ?? throw bad('Konto nicht gefunden');
                if (in_array($acc['kind'], ['debtor', 'creditor'], true)) throw bad('Kunden- und Lieferantenkonten werden über Rechnungen und Zahlungen gebucht, nicht manuell.');
                $lines[] = ['account_id' => (int) $acc['id'], 'debit' => vint($l, 'debit_cents', 'Soll', 0), 'credit' => vint($l, 'credit_cents', 'Haben', 0), 'text' => vstr($l, 'text', 'Text', 200)];
            }
            $e = Accounting::post($c, ['date' => vdate($c->body, 'date', 'Buchungsdatum', true), 'text' => vstr($c->body, 'text', 'Buchungstext', 300, true), 'source' => 'manual', 'lines' => $lines]);
            audit($c, 'journal', $e['id'], 'create', $e['number']);
            return $e;
        });
        $r->post('/accounting/journal/:id/reverse', 'accounting:w', function (Ctx $c) {
            $e = Accounting::reverse($c, $c->id(), vdate($c->body, 'date', 'Datum'), vstr($c->body, 'text', 'Text', 300));
            audit($c, 'journal', $e['id'], 'reverse', $e['number']);
            return $e;
        });

        // ----- Offene Posten, Zahlungen -----
        $r->get('/accounting/open-items', 'accounting:r', function (Ctx $c) {
            return Accounting::openItems($c->db, $c->tenantId, voneof($c->q('type', 'debtors'), ['debtors', 'creditors'], 'Art'));
        });
        $r->get('/accounting/payments', 'accounting:r', function (Ctx $c) {
            [$from, $to] = self::range($c);
            $rows = $c->db->all("SELECT p.id, p.kind, p.date, p.amount_cents, p.method, p.reference, p.reversed, p.ref_type, p.ref_id, a.number AS account_number, a.name AS account_name,
                    CASE WHEN p.kind = 'customer' THEN (SELECT name FROM customers WHERE id = p.party_id) ELSE (SELECT name FROM suppliers WHERE id = p.party_id) END AS party,
                    CASE WHEN p.ref_type = 'invoice' THEN (SELECT number FROM documents WHERE id = p.ref_id) ELSE (SELECT number FROM supplier_invoices WHERE id = p.ref_id) END AS doc_number
                    FROM payments p JOIN accounts a ON a.id = p.account_id WHERE p.tenant_id = ? AND p.date >= ? AND p.date <= ? ORDER BY p.date DESC, p.id DESC LIMIT 500", [$c->tenantId, $from, $to]);
            return ['rows' => $rows];
        });
    }
}
