<?php
declare(strict_types=1);

namespace Erp;

/** Zahlungseingänge (Kunden) und Zahlungsausgänge (Lieferanten) mit Buchung auf Bank/Kasse und Personenkonto. */
final class Payments
{
    public const METHODS = ['bank', 'cash', 'card', 'paypal', 'other'];

    public static function invoiceStatus(int $gross, int $paid, int $credited): string
    {
        $open = $gross - $paid - $credited;
        if ($open <= 0) return $credited >= $gross ? 'cancelled' : 'paid';
        return $paid > 0 ? 'partial' : 'open';
    }

    private static function financeAccount(Ctx $c, array $b, string $method): int
    {
        $id = vint($b, 'account_id', 'Konto', 0);
        if ($id) {
            $a = $c->db->get("SELECT id FROM accounts WHERE id = ? AND tenant_id = ? AND kind IN ('bank','cash') AND active = 1", [$id, $c->tenantId]);
            if (!$a) throw bad('Bitte ein Bank- oder Kassenkonto wählen');
            return $id;
        }
        return Accounting::sys($c->db, $c->tenantId, $method === 'cash' ? 'cash' : 'bank');
    }

    /** Zahlung eines Kunden zu einer Rechnung (auch Teilzahlung). */
    public static function recordCustomer(Ctx $c, array $inv, array $b): int
    {
        if (!in_array($inv['status'], ['open', 'partial'], true)) throw conflict('Zu dieser Rechnung ist keine Zahlung mehr offen.');
        $amount = vint($b, 'amount_cents', 'Betrag', 1, 2000000000, true);
        $open = (int) $inv['gross_cents'] - (int) $inv['paid_cents'] - (int) $inv['credited_cents'];
        if ($amount > $open) throw conflict(sprintf('Der Betrag übersteigt den offenen Betrag von %s €.', number_format($open / 100, 2, ',', '.')));
        $date = vdate($b, 'date', 'Datum', false, today());
        $method = voneof($b['method'] ?? 'bank', self::METHODS, 'Zahlungsart');
        $account = self::financeAccount($c, $b, $method);
        $cust = $c->db->get('SELECT account_id, name FROM customers WHERE id = ? AND tenant_id = ?', [$inv['customer_id'], $c->tenantId]);
        $ref = vstr($b, 'reference', 'Verwendungszweck', 200);
        $entry = Accounting::post($c, [
            'date' => $date, 'text' => "Zahlungseingang {$inv['number']} {$cust['name']}", 'source' => 'payment', 'ref_type' => 'invoice', 'ref_id' => (int) $inv['id'],
            'lines' => [['account_id' => $account, 'debit' => $amount, 'text' => $ref], ['account_id' => (int) $cust['account_id'], 'credit' => $amount, 'text' => $inv['number']]],
        ]);
        $pid = $c->db->insert('payments', ['tenant_id' => $c->tenantId, 'kind' => 'customer', 'party_id' => $inv['customer_id'], 'ref_type' => 'invoice', 'ref_id' => $inv['id'], 'date' => $date, 'amount_cents' => $amount, 'method' => $method, 'account_id' => $account, 'reference' => $ref, 'journal_entry_id' => $entry['id'], 'created_by' => $c->userId()]);
        $paid = (int) $inv['paid_cents'] + $amount;
        $c->db->run('UPDATE documents SET paid_cents = ?, status = ? WHERE id = ? AND tenant_id = ?', [$paid, self::invoiceStatus((int) $inv['gross_cents'], $paid, (int) $inv['credited_cents']), $inv['id'], $c->tenantId]);
        audit($c, 'payment', $pid, 'create', "{$inv['number']}: " . number_format($amount / 100, 2, ',', '.') . ' €');
        return $pid;
    }

    /** Zahlung an einen Lieferanten zu einer Eingangsrechnung. */
    public static function recordSupplier(Ctx $c, array $inv, array $b): int
    {
        if (!in_array($inv['status'], ['open', 'partial'], true)) throw conflict('Zu dieser Rechnung ist keine Zahlung mehr offen.');
        $amount = vint($b, 'amount_cents', 'Betrag', 1, 2000000000, true);
        $open = (int) $inv['gross_cents'] - (int) $inv['paid_cents'];
        if ($amount > $open) throw conflict(sprintf('Der Betrag übersteigt den offenen Betrag von %s €.', number_format($open / 100, 2, ',', '.')));
        $date = vdate($b, 'date', 'Datum', false, today());
        $method = voneof($b['method'] ?? 'bank', self::METHODS, 'Zahlungsart');
        $account = self::financeAccount($c, $b, $method);
        $sup = $c->db->get('SELECT account_id, name FROM suppliers WHERE id = ? AND tenant_id = ?', [$inv['supplier_id'], $c->tenantId]);
        $ref = vstr($b, 'reference', 'Verwendungszweck', 200);
        $entry = Accounting::post($c, [
            'date' => $date, 'text' => "Zahlung {$inv['number']} {$sup['name']} ({$inv['supplier_ref']})", 'source' => 'payment', 'ref_type' => 'supplier_invoice', 'ref_id' => (int) $inv['id'],
            'lines' => [['account_id' => (int) $sup['account_id'], 'debit' => $amount, 'text' => $inv['number']], ['account_id' => $account, 'credit' => $amount, 'text' => $ref]],
        ]);
        $pid = $c->db->insert('payments', ['tenant_id' => $c->tenantId, 'kind' => 'supplier', 'party_id' => $inv['supplier_id'], 'ref_type' => 'supplier_invoice', 'ref_id' => $inv['id'], 'date' => $date, 'amount_cents' => $amount, 'method' => $method, 'account_id' => $account, 'reference' => $ref, 'journal_entry_id' => $entry['id'], 'created_by' => $c->userId()]);
        $paid = (int) $inv['paid_cents'] + $amount;
        $c->db->run('UPDATE supplier_invoices SET paid_cents = ?, status = ? WHERE id = ? AND tenant_id = ?', [$paid, $paid >= (int) $inv['gross_cents'] ? 'paid' : 'partial', $inv['id'], $c->tenantId]);
        audit($c, 'payment', $pid, 'create', "{$inv['number']}: " . number_format($amount / 100, 2, ',', '.') . ' €');
        return $pid;
    }

    /** Storniert eine Zahlung (Gegenbuchung) und öffnet die Rechnung wieder. */
    public static function reverse(Ctx $c, int $paymentId): void
    {
        $p = $c->db->get('SELECT * FROM payments WHERE id = ? AND tenant_id = ?', [$paymentId, $c->tenantId]) ?? throw not_found('Zahlung');
        if ((int) $p['reversed']) throw conflict('Diese Zahlung wurde bereits storniert.');
        Accounting::reverseForDocument($c, (int) $p['journal_entry_id'], 'Storno Zahlung #' . $p['id']);
        $c->db->run('UPDATE payments SET reversed = 1 WHERE id = ?', [$p['id']]);
        if ($p['ref_type'] === 'invoice') {
            $inv = $c->db->get('SELECT * FROM documents WHERE id = ? AND tenant_id = ?', [$p['ref_id'], $c->tenantId]);
            $paid = (int) $inv['paid_cents'] - (int) $p['amount_cents'];
            $c->db->run('UPDATE documents SET paid_cents = ?, status = ? WHERE id = ? AND tenant_id = ?', [$paid, self::invoiceStatus((int) $inv['gross_cents'], $paid, (int) $inv['credited_cents']), $inv['id'], $c->tenantId]);
        } else {
            $inv = $c->db->get('SELECT * FROM supplier_invoices WHERE id = ? AND tenant_id = ?', [$p['ref_id'], $c->tenantId]);
            $paid = (int) $inv['paid_cents'] - (int) $p['amount_cents'];
            $c->db->run('UPDATE supplier_invoices SET paid_cents = ?, status = ? WHERE id = ? AND tenant_id = ?', [$paid, $paid <= 0 ? 'open' : 'partial', $inv['id'], $c->tenantId]);
        }
        audit($c, 'payment', (int) $p['id'], 'reverse');
    }
}
