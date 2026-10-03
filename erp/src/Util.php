<?php
declare(strict_types=1);

namespace Erp;

// Gemeinsame Helfer: Fehler, Eingabeprüfung, Rechnen mit Cent-Beträgen, Nummernkreise, Einstellungen, Tarife, Rollen.

final class HttpError extends \RuntimeException
{
    public function __construct(public int $status, string $message)
    {
        parent::__construct($message);
    }
}
function bad(string $m): HttpError { return new HttpError(400, $m); }
function not_found(string $what = 'Eintrag'): HttpError { return new HttpError(404, "$what nicht gefunden"); }
function conflict(string $m): HttpError { return new HttpError(409, $m); }
function forbidden(string $m = 'Dazu fehlt die Berechtigung'): HttpError { return new HttpError(403, $m); }

// ---------- Eingabeprüfung ----------
function vstr(array $b, string $key, string $label, int $max = 200, bool $required = false): ?string
{
    $v = $b[$key] ?? null;
    if ($v === null || $v === '') {
        if ($required) throw bad("$label fehlt");
        return null;
    }
    if (!is_string($v) && !is_int($v) && !is_float($v)) throw bad("$label ist ungültig");
    $v = trim(str_replace("\0", '', (string) $v));
    if ($v === '') {
        if ($required) throw bad("$label fehlt");
        return null;
    }
    if (mb_strlen($v) > $max) throw bad("$label ist zu lang (höchstens $max Zeichen)");
    return $v;
}
function vint(array $b, string $key, string $label, int $min = 0, int $max = 2000000000, bool $required = false, int $def = 0): int
{
    $v = $b[$key] ?? null;
    if ($v === null || $v === '') {
        if ($required) throw bad("$label fehlt");
        return $def;
    }
    if (is_bool($v) || !is_numeric($v) || (float) $v != (int) $v) throw bad("$label ist ungültig");
    $n = (int) $v;
    if ($n < $min || $n > $max) throw bad("$label ist ungültig");
    return $n;
}
function vnum(array $b, string $key, string $label, float $min = 0, float $max = 1e9, bool $required = false, float $def = 0): float
{
    $v = $b[$key] ?? null;
    if ($v === null || $v === '') {
        if ($required) throw bad("$label fehlt");
        return $def;
    }
    if (is_bool($v) || !is_numeric($v)) throw bad("$label ist ungültig");
    $n = (float) $v;
    if (!is_finite($n) || $n < $min || $n > $max) throw bad("$label ist ungültig");
    return $n;
}
function voneof($value, array $list, string $label)
{
    if (!in_array($value, $list, true)) throw bad("$label ist ungültig");
    return $value;
}
function is_date($v): bool
{
    if (!is_string($v) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m)) return false;
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
}
function vdate(array $b, string $key, string $label, bool $required = false, ?string $def = null): ?string
{
    $v = $b[$key] ?? null;
    if ($v === null || $v === '') {
        if ($required) throw bad("$label fehlt");
        return $def;
    }
    if (!is_date($v)) throw bad("$label ist kein gültiges Datum (JJJJ-MM-TT)");
    return $v;
}
function vemail(array $b, string $key = 'email', string $label = 'E-Mail'): ?string
{
    $v = vstr($b, $key, $label, 190);
    if ($v !== null && !filter_var($v, FILTER_VALIDATE_EMAIL)) throw bad("$label ist ungültig");
    return $v;
}
function vtax($v, string $label = 'Steuersatz'): float
{
    if (!is_numeric($v) || !in_array((float) $v, [19.0, 7.0, 0.0], true)) throw bad("$label muss 19, 7 oder 0 sein");
    return (float) $v;
}
function today(): string { return date('Y-m-d'); }
function add_days(string $d, int $days): string
{
    return (new \DateTimeImmutable($d))->modify(($days >= 0 ? '+' : '') . $days . ' days')->format('Y-m-d');
}

// ---------- Rechnen ----------
/** Rundet auf ganze Cent (kaufmännisch, halbe Beträge von Null weg). */
function roundc(float|int $x): int
{
    return (int) round($x + ($x >= 0 ? 1e-9 : -1e-9));
}
function r3(float|int $x): float { return round((float) $x, 3); }
function line_net(float $qty, int $priceCents, float $discountPct = 0): int
{
    return roundc($qty * $priceCents * (1 - $discountPct / 100));
}
/** Summen eines Belegs. Die Steuer wird je Steuersatz auf die Netto-Summe gerechnet (nicht je Zeile). */
function totals(array $lines): array
{
    $groups = [];
    $net = 0;
    foreach ($lines as $l) {
        $net += (int) $l['net_cents'];
        $k = (string) (int) $l['tax_rate'];
        $groups[$k] = ($groups[$k] ?? 0) + (int) $l['net_cents'];
    }
    krsort($groups, SORT_NUMERIC);
    $tax = 0;
    $byRate = [];
    foreach ($groups as $rate => $n) {
        $t = roundc($n * (int) $rate / 100);
        $tax += $t;
        $byRate[] = ['rate' => (int) $rate, 'net_cents' => $n, 'tax_cents' => $t];
    }
    return ['net_cents' => $net, 'tax_cents' => $tax, 'gross_cents' => $net + $tax, 'byRate' => $byRate];
}

// ---------- Nummernkreise ----------
function next_seq(Db $db, int $tenantId, string $key, int $start = 1): int
{
    $db->insertIgnore('counters', ['tenant_id' => $tenantId, 'k' => $key, 'value' => $start - 1]);
    $db->run('UPDATE counters SET value = value + 1 WHERE tenant_id = ? AND k = ?', [$tenantId, $key]);
    return (int) $db->val('SELECT value FROM counters WHERE tenant_id = ? AND k = ?', [$tenantId, $key]);
}
/** z. B. RE-2026-00001 (Zähler je Jahr; fortlaufend, da in derselben Transaktion wie der Beleg vergeben). */
function next_number(Db $db, int $tenantId, string $prefix, ?string $date = null, int $pad = 5): string
{
    $year = substr($date ?? today(), 0, 4);
    return sprintf('%s-%s-%0' . $pad . 'd', $prefix, $year, next_seq($db, $tenantId, "$prefix:$year"));
}

// ---------- Protokoll ----------
function audit(Ctx $c, string $entity, ?int $entityId, string $action, ?string $detail = null): void
{
    $c->db->run(
        'INSERT INTO audit_log (tenant_id, user_id, user_name, entity, entity_id, action, detail) VALUES (?,?,?,?,?,?,?)',
        [$c->tenantId, $c->user['id'] ?? null, $c->user['name'] ?? null, $entity, $entityId, $action, $detail !== null ? mb_substr($detail, 0, 500) : null],
    );
}

// ---------- Einstellungen ----------
const DEFAULT_SETTINGS = [
    'company_name' => '', 'street' => '', 'zip' => '', 'city' => '', 'country' => 'DE', 'email' => '', 'phone' => '',
    'website' => '', 'vat_id' => '', 'tax_no' => '', 'iban' => '', 'bic' => '', 'bank_name' => '', 'register' => '',
    'managing_director' => '', 'payment_days' => 14, 'doc_footer' => '', 'allow_negative_stock' => false,
    'books_closed_until' => null,
];
function get_settings(Db $db, int $tenantId): array
{
    $row = $db->get('SELECT name, settings FROM tenants WHERE id = ?', [$tenantId]);
    $saved = json_decode((string) ($row['settings'] ?? '{}'), true);
    return array_merge(DEFAULT_SETTINGS, ['company_name' => $row['name'] ?? ''], is_array($saved) ? $saved : []);
}
function save_settings(Db $db, int $tenantId, array $patch): array
{
    $next = array_merge(get_settings($db, $tenantId), $patch);
    $db->run('UPDATE tenants SET settings = ?, name = ? WHERE id = ?', [json_encode($next, JSON_UNESCAPED_UNICODE), $next['company_name'] ?: 'Firma', $tenantId]);
    return $next;
}

// ---------- Tarife ----------
const PLANS = [
    'starter' => ['label' => 'Starter', 'users' => 3, 'docs_per_month' => 100],
    'business' => ['label' => 'Business', 'users' => 15, 'docs_per_month' => 2000],
    'enterprise' => ['label' => 'Enterprise', 'users' => 1000, 'docs_per_month' => 1000000],
];

// ---------- Rollen ----------
function perms_rw(string ...$areas): array
{
    $o = [];
    foreach ($areas as $a) { $o[] = "$a:r"; $o[] = "$a:w"; }
    return $o;
}
function perms_r(string ...$areas): array { return array_map(fn($a) => "$a:r", $areas); }
function roles(): array
{
    return [
        'admin' => ['label' => 'Administrator', 'perms' => ['*']],
        'accounting' => ['label' => 'Buchhaltung', 'perms' => [...perms_rw('accounting'), ...perms_r('reports', 'crm', 'sales', 'purchasing', 'stock', 'logistics')]],
        'sales' => ['label' => 'Vertrieb', 'perms' => [...perms_rw('crm', 'sales'), ...perms_r('stock', 'logistics', 'reports', 'purchasing')]],
        'purchasing' => ['label' => 'Einkauf', 'perms' => [...perms_rw('purchasing'), ...perms_r('crm', 'sales', 'stock', 'logistics', 'reports')]],
        'warehouse' => ['label' => 'Lager & Logistik', 'perms' => [...perms_rw('stock', 'logistics'), ...perms_r('sales', 'purchasing', 'crm')]],
        'viewer' => ['label' => 'Nur lesen', 'perms' => perms_r('crm', 'sales', 'purchasing', 'stock', 'logistics', 'reports')],
    ];
}
function can(string $role, string $perm): bool
{
    $p = roles()[$role]['perms'] ?? null;
    return $p !== null && (in_array('*', $p, true) || in_array($perm, $p, true));
}
function perms_of(string $role): array
{
    $p = roles()[$role]['perms'] ?? [];
    if (in_array('*', $p, true)) {
        $all = [];
        foreach (['crm', 'sales', 'purchasing', 'stock', 'logistics', 'accounting', 'reports', 'admin'] as $a) { $all[] = "$a:r"; $all[] = "$a:w"; }
        return $all;
    }
    return $p;
}

// ---------- Ergebniszeilen: Summen aus MySQL kommen als Text, hier in Zahlen wandeln ----------
function cast_row(?array $r, array $ints = [], array $floats = []): ?array
{
    if ($r === null) return null;
    foreach ($ints as $k) if (array_key_exists($k, $r) && $r[$k] !== null) $r[$k] = (int) $r[$k];
    foreach ($floats as $k) if (array_key_exists($k, $r) && $r[$k] !== null) $r[$k] = (float) $r[$k];
    return $r;
}
function cast_rows(array $rows, array $ints = [], array $floats = []): array
{
    return array_map(fn($r) => cast_row($r, $ints, $floats), $rows);
}
/** Suchmuster für LIKE: %, _ und ! in der Eingabe werden maskiert und nicht als Platzhalter gedeutet. */
function like(string $q): string
{
    return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $q) . '%';
}
function limit_of(?string $v, int $def = 100, int $max = 500): int
{
    $n = (int) $v;
    return $n > 0 ? min($n, $max) : $def;
}
