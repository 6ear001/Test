<?php
declare(strict_types=1);

namespace Erp;

/** Anmeldung: Sitzungen (zufälliges Token, nur als Hash gespeichert), Passwortregeln, Begrenzung von Versuchen. */
final class Auth
{
    public const COOKIE = 'erp_session';
    private const DAYS = 14;

    public static function https(): bool
    {
        $cfg = erp_config();
        if ($cfg['secure_cookies'] !== null) return (bool) $cfg['secure_cookies'];
        if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
        return !empty($cfg['trust_proxy']) && strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    }
    public static function clientIp(): string
    {
        if (!empty(erp_config()['trust_proxy']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $first = trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
            if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
        }
        return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    }
    private static function cookiePath(): string
    {
        $dir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')));
        return rtrim($dir, '/') . '/';
    }
    private static function cookie(string $value, int $expires): void
    {
        setcookie(self::COOKIE, $value, ['expires' => $expires, 'path' => self::cookiePath(), 'secure' => self::https(), 'httponly' => true, 'samesite' => 'Strict']);
    }

    public static function policy(string $password): ?string
    {
        if (mb_strlen($password) < 10) return 'Das Passwort braucht mindestens 10 Zeichen.';
        if (mb_strlen($password) > 200) return 'Das Passwort ist zu lang.';
        if (!preg_match('/\p{L}/u', $password) || !preg_match('/\d/', $password)) return 'Das Passwort braucht Buchstaben und Zahlen.';
        return null;
    }

    public static function start(Db $db, array $user): void
    {
        $token = bin2hex(random_bytes(32));
        $now = time();
        $db->run('DELETE FROM sessions WHERE expires_at < ?', [$now]);
        $db->run('INSERT INTO sessions (token_hash, user_id, tenant_id, expires_at, created_at) VALUES (?,?,?,?,?)',
            [hash('sha256', $token), $user['id'], $user['tenant_id'], $now + self::DAYS * 86400, $now]);
        $db->run('UPDATE users SET last_login = ? WHERE id = ?', [date('Y-m-d H:i:s'), $user['id']]);
        self::cookie($token, $now + self::DAYS * 86400);
    }
    public static function end(Db $db): void
    {
        $t = $_COOKIE[self::COOKIE] ?? null;
        if (is_string($t) && $t !== '') $db->run('DELETE FROM sessions WHERE token_hash = ?', [hash('sha256', $t)]);
        self::cookie('', time() - 3600);
    }
    public static function endAllFor(Db $db, int $userId): void
    {
        $db->run('DELETE FROM sessions WHERE user_id = ?', [$userId]);
    }
    /** Der angemeldete Benutzer (mit Mandant und Tarif) oder null. */
    public static function user(Db $db): ?array
    {
        $t = $_COOKIE[self::COOKIE] ?? null;
        if (!is_string($t) || !preg_match('/^[0-9a-f]{64}$/', $t)) return null;
        $row = $db->get(
            'SELECT s.expires_at, u.id, u.tenant_id, u.email, u.name, u.role, u.active, t.active AS tenant_active, t.plan, t.name AS tenant_name
               FROM sessions s JOIN users u ON u.id = s.user_id JOIN tenants t ON t.id = u.tenant_id WHERE s.token_hash = ?',
            [hash('sha256', $t)],
        );
        if (!$row || (int) $row['expires_at'] < time() || !(int) $row['active'] || !(int) $row['tenant_active']) return null;
        foreach (['id', 'tenant_id', 'active', 'tenant_active'] as $k) $row[$k] = (int) $row[$k];
        return $row;
    }
    /** Zählt einen Versuch und meldet true, wenn das Limit überschritten ist (gespeichert in der Datenbank, nicht in einer Transaktion). */
    public static function limited(Db $db, string $key, int $max, int $window): bool
    {
        $now = time();
        if (random_int(1, 20) === 1) $db->run('DELETE FROM rate_hits WHERE ts < ?', [$now - 7200]);
        $count = (int) $db->val('SELECT COUNT(*) FROM rate_hits WHERE k = ? AND ts >= ?', [$key, $now - $window]);
        if ($count >= $max) return true;
        $db->run('INSERT INTO rate_hits (k, ts) VALUES (?, ?)', [$key, $now]);
        return false;
    }
    public static function clearLimit(Db $db, string $key): void
    {
        $db->run('DELETE FROM rate_hits WHERE k = ?', [$key]);
    }
}
