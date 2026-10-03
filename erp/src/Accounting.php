<?php
declare(strict_types=1);

namespace Erp;

/**
 * Buchhaltungs-Kern: Kontenplan (angelehnt an SKR03, Auszug), Buchungen nach doppelter Buchführung, Auswertungen.
 * Jede Buchung ist ausgeglichen (Soll = Haben), fortlaufend nummeriert und wird nur per Storno rückgängig gemacht.
 */
final class Accounting
{
    /** [Nr, Name, Typ, Systemschlüssel, Art] */
    private const CHART = [
        ['0200', 'Technische Anlagen und Maschinen', 'asset'],
        ['0420', 'Büroeinrichtung', 'asset'],
        ['0800', 'Gezeichnetes Kapital', 'equity', 'capital'],
        ['0860', 'Gewinnvortrag vor Verwendung', 'equity', 'retained'],
        ['1000', 'Kasse', 'asset', 'cash', 'cash'],
        ['1200', 'Bank', 'asset', 'bank', 'bank'],
        ['1360', 'Geldtransit', 'asset', 'transit'],
        ['1571', 'Abziehbare Vorsteuer 7 %', 'asset', 'vat_in_7'],
        ['1576', 'Abziehbare Vorsteuer 19 %', 'asset', 'vat_in_19'],
        ['1771', 'Umsatzsteuer 7 %', 'liability', 'vat_out_7'],
        ['1776', 'Umsatzsteuer 19 %', 'liability', 'vat_out_19'],
        ['1780', 'Umsatzsteuer-Vorauszahlungen', 'liability', 'vat_prepay'],
        ['1800', 'Privatentnahmen allgemein', 'equity', 'drawings'],
        ['1890', 'Privateinlagen', 'equity', 'deposits'],
        ['3200', 'Wareneingang (ohne Vorsteuer)', 'expense', 'goods_0'],
        ['3300', 'Wareneingang 7 % Vorsteuer', 'expense', 'goods_7'],
        ['3400', 'Wareneingang 19 % Vorsteuer', 'expense', 'goods_19'],
        ['3800', 'Bezugsnebenkosten', 'expense'],
        ['3960', 'Bestandsveränderungen Waren', 'expense', 'inventory_change'],
        ['3980', 'Warenbestand', 'asset', 'inventory'],
        ['4100', 'Löhne und Gehälter', 'expense'],
        ['4130', 'Gesetzliche soziale Aufwendungen', 'expense'],
        ['4210', 'Miete', 'expense'],
        ['4240', 'Gas, Strom, Wasser', 'expense'],
        ['4360', 'Versicherungen', 'expense'],
        ['4530', 'Laufende Kfz-Betriebskosten', 'expense'],
        ['4600', 'Werbekosten', 'expense'],
        ['4650', 'Bewirtungskosten', 'expense'],
        ['4660', 'Reisekosten Arbeitnehmer', 'expense'],
        ['4710', 'Verpackungsmaterial', 'expense'],
        ['4730', 'Ausgangsfrachten', 'expense', 'freight_out'],
        ['4800', 'Reparaturen und Instandhaltung', 'expense'],
        ['4806', 'Wartungskosten für Hard- und Software', 'expense'],
        ['4900', 'Sonstige betriebliche Aufwendungen', 'expense', 'other_expense'],
        ['4910', 'Porto', 'expense'],
        ['4920', 'Telefon', 'expense'],
        ['4930', 'Bürobedarf', 'expense'],
        ['4950', 'Rechts- und Beratungskosten', 'expense'],
        ['4955', 'Buchführungskosten', 'expense'],
        ['4970', 'Nebenkosten des Geldverkehrs', 'expense'],
        ['4985', 'Werkzeuge und Kleingeräte', 'expense'],
        ['8200', 'Erlöse (steuerfrei)', 'revenue', 'rev_0'],
        ['8300', 'Erlöse 7 % USt', 'revenue', 'rev_7'],
        ['8400', 'Erlöse 19 % USt', 'revenue', 'rev_19'],
        ['8700', 'Erlösschmälerungen', 'revenue'],
        ['9000', 'Saldenvorträge (Eröffnung)', 'equity', 'opening'],
    ];
    private const CARRIERS = [
        ['DHL', 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={tracking}'],
        ['DPD', 'https://tracking.dpd.de/status/de_DE/parcel/{tracking}'],
        ['UPS', 'https://www.ups.com/track?tracknum={tracking}'],
        ['GLS', 'https://gls-group.com/DE/de/paketverfolgung?match={tracking}'],
        ['Spedition', null],
        ['Selbstabholung', null],
    ];

    /** Legt Kontenplan, Hauptlager und Frachtführer für einen neuen Mandanten an. */
    public static function seedTenant(Db $db, int $tenantId): void
    {
        foreach (self::CHART as $a) {
            $db->insert('accounts', ['tenant_id' => $tenantId, 'number' => $a[0], 'name' => $a[1], 'type' => $a[2], 'kind' => $a[4] ?? 'general', 'system_key' => $a[3] ?? null, 'active' => 1]);
        }
        $db->insert('warehouses', ['tenant_id' => $tenantId, 'name' => 'Hauptlager', 'code' => 'HL', 'is_default' => 1, 'active' => 1]);
        foreach (self::CARRIERS as [$name, $url]) {
            $db->insert('carriers', ['tenant_id' => $tenantId, 'name' => $name, 'tracking_url' => $url, 'active' => 1]);
        }
    }

    public static function sys(Db $db, int $tenantId, string $key): int
    {
        $id = $db->val('SELECT id FROM accounts WHERE tenant_id = ? AND system_key = ?', [$tenantId, $key]);
        if (!$id) throw conflict("Systemkonto fehlt: $key");
        return (int) $id;
    }
    public static function taxSuffix(int|float $rate): string { return (int) $rate === 19 ? '19' : ((int) $rate === 7 ? '7' : '0'); }

    /** Eigenes Konto für einen Kunden (Debitor ab 10001) oder Lieferanten (Kreditor ab 70001). */
    public static function createPartyAccount(Db $db, int $tenantId, string $kind, int $partyId, string $name): array
    {
        $start = $kind === 'debtor' ? 10001 : 70001;
        do {
            $n = next_seq($db, $tenantId, "acct:$kind", $start);
        } while ($db->get('SELECT 1 FROM accounts WHERE tenant_id = ? AND number = ?', [$tenantId, (string) $n]));
        $id = $db->insert('accounts', ['tenant_id' => $tenantId, 'number' => (string) $n, 'name' => mb_substr($name, 0, 200), 'type' => $kind === 'debtor' ? 'asset' : 'liability', 'kind' => $kind, 'party_id' => $partyId, 'active' => 1]);
        return ['id' => $id, 'number' => (string) $n];
    }

    /** Bucht einen ausgeglichenen Buchungssatz. $a: date, text, source, ref_type, ref_id, reverses, lines[{account_id, debit, credit, text}] (Cent). */
    public static function post(Ctx $c, array $a): array
    {
        $db = $c->db;
        $t = $c->tenantId;
        $date = $a['date'] ?? '';
        if (!is_date($date)) throw bad('Buchungsdatum ist ungültig');
        $closed = $c->settings()['books_closed_until'] ?? null;
        if ($closed && $date <= $closed) throw conflict("Die Buchhaltung ist bis $closed festgeschrieben");
        $lines = array_values(array_filter($a['lines'], fn($l) => ($l['debit'] ?? 0) !== 0 || ($l['credit'] ?? 0) !== 0));
        if (count($lines) < 2) throw bad('Eine Buchung braucht mindestens zwei Zeilen');
        $debit = 0;
        $credit = 0;
        foreach ($lines as $l) {
            $d = $l['debit'] ?? 0;
            $cr = $l['credit'] ?? 0;
            if (!is_int($d) || !is_int($cr) || $d < 0 || $cr < 0 || ($d > 0 && $cr > 0)) throw bad('Jede Buchungszeile braucht entweder Soll oder Haben (ganze Cent-Beträge, nicht negativ)');
            $acc = $db->get('SELECT id, active FROM accounts WHERE id = ? AND tenant_id = ?', [$l['account_id'], $t]);
            if (!$acc) throw bad('Konto nicht gefunden');
            if (!(int) $acc['active']) throw bad('Auf ein deaktiviertes Konto kann nicht gebucht werden');
            $debit += $d;
            $credit += $cr;
        }
        if ($debit !== $credit) throw bad(sprintf('Buchung ist nicht ausgeglichen: Soll %.2f ≠ Haben %.2f', $debit / 100, $credit / 100));
        $number = next_number($db, $t, 'BU', $date);
        $entryId = $db->insert('journal_entries', [
            'tenant_id' => $t, 'number' => $number, 'date' => $date, 'text' => mb_substr((string) $a['text'], 0, 300), 'source' => $a['source'] ?? 'manual',
            'ref_type' => $a['ref_type'] ?? null, 'ref_id' => $a['ref_id'] ?? null, 'reverses_id' => $a['reverses'] ?? null, 'created_by' => $c->userId(),
        ]);
        foreach ($lines as $l) {
            $db->insert('journal_lines', [
                'tenant_id' => $t, 'entry_id' => $entryId, 'account_id' => $l['account_id'], 'debit_cents' => $l['debit'] ?? 0,
                'credit_cents' => $l['credit'] ?? 0, 'text' => isset($l['text']) ? mb_substr((string) $l['text'], 0, 200) : null,
            ]);
        }
        return ['id' => $entryId, 'number' => $number];
    }

    /** Storno einer manuellen Buchung. Belegbezogene Buchungen werden über ihren Beleg storniert. */
    public static function reverse(Ctx $c, int $entryId, ?string $date = null, ?string $text = null): array
    {
        $e = $c->db->get('SELECT * FROM journal_entries WHERE id = ? AND tenant_id = ?', [$entryId, $c->tenantId]);
        if (!$e) throw not_found('Buchung');
        if ($e['reversed_by_id']) throw conflict('Diese Buchung wurde bereits storniert');
        if ($e['reverses_id']) throw conflict('Eine Stornobuchung kann nicht erneut storniert werden');
        if (!in_array($e['source'], ['manual', 'transfer', 'private'], true)) {
            throw conflict('Diese Buchung gehört zu einem Beleg und wird dort storniert (z. B. per Gutschrift oder Zahlungsstorno)');
        }
        return self::reverseEntry($c, $e, $date, $text);
    }
    /** Gegenbuchung ohne Beschränkung der Buchungsart (für Belegstorno, Zahlungsstorno). */
    public static function reverseForDocument(Ctx $c, int $entryId, string $text): array
    {
        $e = $c->db->get('SELECT * FROM journal_entries WHERE id = ? AND tenant_id = ?', [$entryId, $c->tenantId]);
        if (!$e || $e['reversed_by_id']) throw conflict('Die Buchung wurde bereits storniert');
        return self::reverseEntry($c, $e, null, $text);
    }
    private static function reverseEntry(Ctx $c, array $e, ?string $date, ?string $text): array
    {
        $lines = $c->db->all('SELECT account_id, debit_cents, credit_cents, text FROM journal_lines WHERE entry_id = ?', [$e['id']]);
        $rev = self::post($c, [
            'date' => $date && is_date($date) ? $date : today(), 'text' => $text ?: "Storno {$e['number']}: {$e['text']}", 'source' => 'storno', 'reverses' => (int) $e['id'],
            'lines' => array_map(fn($l) => ['account_id' => (int) $l['account_id'], 'debit' => (int) $l['credit_cents'], 'credit' => (int) $l['debit_cents'], 'text' => $l['text']], $lines),
        ]);
        $c->db->run('UPDATE journal_entries SET reversed_by_id = ? WHERE id = ?', [$rev['id'], $e['id']]);
        return $rev;
    }

    // ---------- Salden, Kontoblatt, Auswertungen ----------
    public static function balance(Db $db, int $tenantId, int $accountId, string $upTo = '9999-12-31'): int
    {
        return (int) $db->val(
            'SELECT COALESCE(SUM(l.debit_cents - l.credit_cents), 0) FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
              WHERE l.tenant_id = ? AND l.account_id = ? AND e.date <= ?',
            [$tenantId, $accountId, $upTo], 0,
        );
    }

    /** Kontoblatt mit Anfangsbestand und laufendem Saldo (Soll positiv, Haben negativ). */
    public static function ledger(Db $db, int $tenantId, int $accountId, string $from = '0000-01-01', string $to = '9999-12-31'): array
    {
        $account = $db->get('SELECT * FROM accounts WHERE id = ? AND tenant_id = ?', [$accountId, $tenantId]);
        if (!$account) throw not_found('Konto');
        $opening = (int) $db->val(
            'SELECT COALESCE(SUM(l.debit_cents - l.credit_cents), 0) FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
              WHERE l.tenant_id = ? AND l.account_id = ? AND e.date < ?',
            [$tenantId, $accountId, $from], 0,
        );
        $rows = $db->all(
            'SELECT e.id AS entry_id, e.number, e.date, e.text, e.source, e.ref_type, e.ref_id, l.debit_cents, l.credit_cents,
                    (SELECT GROUP_CONCAT(a2.number) FROM journal_lines l2 JOIN accounts a2 ON a2.id = l2.account_id WHERE l2.entry_id = e.id AND l2.id != l.id) AS counter
               FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
              WHERE l.tenant_id = ? AND l.account_id = ? AND e.date >= ? AND e.date <= ? ORDER BY e.date, e.id, l.id',
            [$tenantId, $accountId, $from, $to],
        );
        $run = $opening;
        foreach ($rows as &$r) {
            $r['debit_cents'] = (int) $r['debit_cents'];
            $r['credit_cents'] = (int) $r['credit_cents'];
            $run += $r['debit_cents'] - $r['credit_cents'];
            $r['balance_cents'] = $run;
            $r['counter'] = $r['counter'] !== null ? str_replace(',', ', ', (string) $r['counter']) : null;
        }
        unset($r);
        return ['account' => $account, 'opening_cents' => $opening, 'rows' => $rows, 'closing_cents' => $run];
    }

    public static function trialBalance(Db $db, int $tenantId, string $from = '0000-01-01', string $to = '9999-12-31', bool $detail = false): array
    {
        $rows = $db->all(
            'SELECT a.id, a.number, a.name, a.type, a.kind,
                    COALESCE(SUM(CASE WHEN e.date < ? THEN l.debit_cents - l.credit_cents END), 0) AS opening_cents,
                    COALESCE(SUM(CASE WHEN e.date >= ? AND e.date <= ? THEN l.debit_cents END), 0) AS debit_cents,
                    COALESCE(SUM(CASE WHEN e.date >= ? AND e.date <= ? THEN l.credit_cents END), 0) AS credit_cents
               FROM accounts a
               LEFT JOIN journal_lines l ON l.account_id = a.id AND l.tenant_id = a.tenant_id
               LEFT JOIN journal_entries e ON e.id = l.entry_id
              WHERE a.tenant_id = ? GROUP BY a.id, a.number, a.name, a.type, a.kind ORDER BY a.number',
            [$from, $from, $to, $from, $to, $tenantId],
        );
        $out = [];
        $sums = ['debtor' => null, 'creditor' => null];
        foreach ($rows as $r) {
            foreach (['opening_cents', 'debit_cents', 'credit_cents'] as $k) $r[$k] = (int) $r[$k];
            $r['closing_cents'] = $r['opening_cents'] + $r['debit_cents'] - $r['credit_cents'];
            if (!$detail && ($r['kind'] === 'debtor' || $r['kind'] === 'creditor')) {
                $k = $r['kind'];
                $sums[$k] ??= ['id' => null, 'number' => $k === 'debtor' ? 'Debitoren' : 'Kreditoren',
                    'name' => $k === 'debtor' ? 'Forderungen aus Lieferungen und Leistungen (Summe)' : 'Verbindlichkeiten aus Lieferungen und Leistungen (Summe)',
                    'type' => $r['type'], 'kind' => $k, 'opening_cents' => 0, 'debit_cents' => 0, 'credit_cents' => 0, 'closing_cents' => 0];
                foreach (['opening_cents', 'debit_cents', 'credit_cents', 'closing_cents'] as $f) $sums[$k][$f] += $r[$f];
            } else {
                $out[] = $r;
            }
        }
        foreach ($sums as $s) if ($s) $out[] = $s;
        $out = array_values(array_filter($out, fn($r) => $r['opening_cents'] || $r['debit_cents'] || $r['credit_cents'] || $r['closing_cents']));
        $tot = fn($k) => array_sum(array_column($out, $k));
        return ['rows' => $out, 'totals' => ['opening_cents' => $tot('opening_cents'), 'debit_cents' => $tot('debit_cents'), 'credit_cents' => $tot('credit_cents'), 'closing_cents' => $tot('closing_cents')]];
    }

    /** Gewinn- und Verlustrechnung für einen Zeitraum. */
    public static function profitAndLoss(Db $db, int $tenantId, string $from, string $to): array
    {
        $tb = self::trialBalance($db, $tenantId, $from, $to, true)['rows'];
        $revenue = [];
        $expenses = [];
        foreach ($tb as $r) {
            if ($r['type'] === 'revenue' && ($v = $r['credit_cents'] - $r['debit_cents'])) $revenue[] = ['number' => $r['number'], 'name' => $r['name'], 'cents' => $v];
            if ($r['type'] === 'expense' && ($v = $r['debit_cents'] - $r['credit_cents'])) $expenses[] = ['number' => $r['number'], 'name' => $r['name'], 'cents' => $v];
        }
        $revTotal = array_sum(array_column($revenue, 'cents'));
        $groups = [];
        foreach ([['3', 'Wareneinsatz / Einkauf'], ['4', 'Betriebliche Aufwendungen'], ['other', 'Übrige Aufwendungen']] as [$prefix, $label]) {
            $items = array_values(array_filter($expenses, fn($e) => $prefix === 'other' ? !in_array($e['number'][0], ['3', '4'], true) : $e['number'][0] === $prefix));
            if ($items) $groups[] = ['label' => $label, 'items' => $items, 'total_cents' => array_sum(array_column($items, 'cents'))];
        }
        $expTotal = array_sum(array_column($groups, 'total_cents'));
        $goods = 0;
        foreach ($groups as $g) if ($g['label'] === 'Wareneinsatz / Einkauf') $goods = $g['total_cents'];
        return ['revenue' => $revenue, 'revenue_total_cents' => $revTotal, 'groups' => $groups, 'expense_total_cents' => $expTotal, 'gross_profit_cents' => $revTotal - $goods, 'result_cents' => $revTotal - $expTotal];
    }

    /** Bilanz-Übersicht zum Stichtag: Aktiva = Passiva (inkl. Ergebnis aller gebuchten Zeiträume). */
    public static function balanceSheet(Db $db, int $tenantId, string $to = '9999-12-31'): array
    {
        $tb = self::trialBalance($db, $tenantId, '0000-01-01', $to, false)['rows'];
        $take = function (string $type, int $sign) use ($tb) {
            $o = [];
            foreach ($tb as $r) if ($r['type'] === $type && ($v = $sign * $r['closing_cents'])) $o[] = ['number' => $r['number'], 'name' => $r['name'], 'cents' => $v];
            return $o;
        };
        $assets = $take('asset', 1);
        $liabilities = $take('liability', -1);
        $equity = $take('equity', -1);
        $result = 0;
        foreach ($tb as $r) if ($r['type'] === 'revenue' || $r['type'] === 'expense') $result -= $r['closing_cents'];
        $sum = fn($a) => array_sum(array_column($a, 'cents'));
        return [
            'assets' => $assets, 'liabilities' => $liabilities, 'equity' => $equity, 'result_cents' => $result,
            'assets_total_cents' => $sum($assets), 'liabilities_total_cents' => $sum($liabilities), 'equity_total_cents' => $sum($equity) + $result,
            'passiva_total_cents' => $sum($liabilities) + $sum($equity) + $result,
        ];
    }

    /** Umsatzsteuer-Voranmeldung (vereinfacht, Soll-Versteuerung) aus den gebuchten Konten. */
    public static function vat(Db $db, int $tenantId, string $from, string $to): array
    {
        $tb = [];
        foreach (self::trialBalance($db, $tenantId, $from, $to, true)['rows'] as $r) $tb[$r['number']] = $r;
        $credit = fn($n) => isset($tb[$n]) ? $tb[$n]['credit_cents'] - $tb[$n]['debit_cents'] : 0;
        $debit = fn($n) => isset($tb[$n]) ? $tb[$n]['debit_cents'] - $tb[$n]['credit_cents'] : 0;
        $out19 = $credit('1776'); $out7 = $credit('1771'); $in19 = $debit('1576'); $in7 = $debit('1571');
        return [
            'sales' => [
                ['label' => 'Umsätze 19 %', 'net_cents' => $credit('8400'), 'tax_cents' => $out19],
                ['label' => 'Umsätze 7 %', 'net_cents' => $credit('8300'), 'tax_cents' => $out7],
                ['label' => 'Steuerfreie Umsätze', 'net_cents' => $credit('8200'), 'tax_cents' => 0],
            ],
            'input' => [['label' => 'Vorsteuer 19 %', 'tax_cents' => $in19], ['label' => 'Vorsteuer 7 %', 'tax_cents' => $in7]],
            'output_total_cents' => $out19 + $out7, 'input_total_cents' => $in19 + $in7, 'payable_cents' => $out19 + $out7 - $in19 - $in7,
        ];
    }

    /** Offene Posten (Debitoren oder Kreditoren) mit Altersstruktur. */
    public static function openItems(Db $db, int $tenantId, string $type): array
    {
        if ($type === 'debtors') {
            $rows = $db->all(
                "SELECT d.id, d.number, d.date, d.due_date, d.gross_cents, d.paid_cents, d.credited_cents, c.id AS party_id, c.name AS party, 'invoice' AS ref_type
                   FROM documents d JOIN customers c ON c.id = d.customer_id
                  WHERE d.tenant_id = ? AND d.type = 'invoice' AND d.status IN ('open','partial') ORDER BY d.due_date, d.id",
                [$tenantId],
            );
            foreach ($rows as &$r) $r['open_cents'] = (int) $r['gross_cents'] - (int) $r['paid_cents'] - (int) $r['credited_cents'];
        } else {
            $rows = $db->all(
                "SELECT i.id, i.number, i.supplier_ref, i.date, i.due_date, i.gross_cents, i.paid_cents, 0 AS credited_cents, s.id AS party_id, s.name AS party, 'supplier_invoice' AS ref_type
                   FROM supplier_invoices i JOIN suppliers s ON s.id = i.supplier_id
                  WHERE i.tenant_id = ? AND i.status IN ('open','partial') ORDER BY i.due_date, i.id",
                [$tenantId],
            );
            foreach ($rows as &$r) $r['open_cents'] = (int) $r['gross_cents'] - (int) $r['paid_cents'];
        }
        unset($r);
        $buckets = ['not_due' => 0, 'd1_30' => 0, 'd31_60' => 0, 'd61_90' => 0, 'd90' => 0];
        $now = strtotime(today() . ' 00:00:00 UTC');
        foreach ($rows as &$r) {
            $late = $r['due_date'] ? (int) floor(($now - strtotime($r['due_date'] . ' 00:00:00 UTC')) / 86400) : 0;
            $r['days_overdue'] = max($late, 0);
            $k = $late <= 0 ? 'not_due' : ($late <= 30 ? 'd1_30' : ($late <= 60 ? 'd31_60' : ($late <= 90 ? 'd61_90' : 'd90')));
            $r['bucket'] = $k;
            $buckets[$k] += $r['open_cents'];
        }
        unset($r);
        return ['rows' => $rows, 'buckets' => $buckets, 'total_cents' => array_sum(array_column($rows, 'open_cents'))];
    }
}
