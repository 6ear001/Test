<?php
declare(strict_types=1);

/**
 * Testlauf für das ERP: startet einen PHP-Server mit frischer Datenbank und prüft die API über HTTP.
 *   php tests/run.php                       # SQLite (Standard)
 *   ERP_TEST_DB=mysql ERP_TEST_MYSQL='host=127.0.0.1;port=3307;name=erp_test;user=erp;pass=erp-pass' php tests/run.php
 */

$root = dirname(__DIR__);
$tmp = sys_get_temp_dir() . '/erp-test-' . bin2hex(random_bytes(4));
mkdir($tmp);
$driver = getenv('ERP_TEST_DB') ?: 'sqlite';
if ($driver === 'mysql') {
    parse_str(str_replace(';', '&', (string) getenv('ERP_TEST_MYSQL')), $m);
    $db = ['driver' => 'mysql', 'host' => $m['host'] ?? '127.0.0.1', 'port' => (int) ($m['port'] ?? 3306), 'name' => $m['name'] ?? 'erp_test', 'user' => $m['user'] ?? '', 'pass' => $m['pass'] ?? ''];
    $pdo = new PDO("mysql:host={$db['host']};port={$db['port']};dbname={$db['name']};charset=utf8mb4", $db['user'], $db['pass']);
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) $pdo->exec("DROP TABLE `$t`");
} else {
    $db = ['driver' => 'sqlite', 'path' => "$tmp/test.sqlite"];
}
file_put_contents("$tmp/config.php", '<?php return ' . var_export(['db' => $db, 'operator_key' => 'test-operator-key-0123456789', 'login_limit' => [5, 600], 'signup_limit' => [100, 600]], true) . ';');
$port = random_int(20000, 40000);
putenv("ERP_CONFIG_FOR_CLI=$tmp/config.php");
$GLOBALS['driver'] = $driver;
$proc = proc_open(['php', '-S', "127.0.0.1:$port", '-t', $root, "$root/tests/router.php"], [1 => ['file', "$tmp/server.log", 'w'], 2 => ['file', "$tmp/server.log", 'a']], $pipes, $root, ['ERP_CONFIG' => "$tmp/config.php", 'PATH' => getenv('PATH')]);
register_shutdown_function(function () use ($proc, $tmp) {
    proc_terminate($proc);
    foreach (glob("$tmp/*") ?: [] as $f) @unlink($f);
    @rmdir($tmp);
});
$base = "http://127.0.0.1:$port";
for ($i = 0; $i < 50; $i++) {
    if (@fsockopen('127.0.0.1', $port)) break;
    usleep(100000);
}

// ---------- kleine Testhilfen ----------
$GLOBALS['pass'] = 0;
$GLOBALS['fail'] = 0;
function check(bool $ok, string $what, $detail = null): void
{
    if ($ok) { $GLOBALS['pass']++; return; }
    $GLOBALS['fail']++;
    echo "  FEHLER: $what" . ($detail !== null ? ' → ' . (is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE)) : '') . "\n";
}
function same($a, $b, string $what): void { check($a === $b, $what, ['erwartet' => $b, 'erhalten' => $a]); }
function section(string $t): void { echo "\n$t\n"; }

final class Client
{
    public string $cookie = '';
    public function __construct(private string $base) {}
    /** @return array{0:int,1:array,2:array} Status, JSON, Header */
    public function call(string $method, string $path, ?array $body = null, array $headers = []): array
    {
        $h = ['X-Requested-With: erp', 'Accept: application/json'];
        if ($body !== null) $h[] = 'Content-Type: application/json';
        if ($this->cookie !== '') $h[] = 'Cookie: ' . $this->cookie;
        foreach ($headers as $k => $v) $h[] = "$k: $v";
        $ch = curl_init($this->base . '/api' . $path);
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => 20]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        $raw = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $size = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        $head = substr($raw, 0, $size);
        if (preg_match_all('/^Set-Cookie:\s*(erp_session=[^;]*)/mi', $head, $m) && $m[1]) $this->cookie = end($m[1]) === 'erp_session=' ? '' : end($m[1]);
        return [$status, json_decode(substr($raw, $size), true) ?? [], [$head]];
    }
    public function get(string $p): array { return $this->call('GET', $p)[1]; }
    public function ok(string $method, string $path, ?array $body = null): array
    {
        [$s, $j] = $this->call($method, $path, $body);
        check($s >= 200 && $s < 300, "$method $path → $s", $j);
        return $j;
    }
    public function fails(string $method, string $path, ?array $body, int $status, string $what): array
    {
        [$s, $j] = $this->call($method, $path, $body);
        same($s, $status, "$what (Status)");
        return $j;
    }
}

require __DIR__ . '/cases.php';

// PHP-Warnungen oder -Fehler im Server-Log gelten als Fehler (die API zeigt sie nie an, schreibt sie aber ins Log).
$log = (string) @file_get_contents("$tmp/server.log");
preg_match_all('/PHP (Warning|Notice|Deprecated|Fatal error|Parse error)[^\n]*|\[erp\][^\n]*/', $log, $mm);
foreach (array_unique($mm[0]) as $line) check(false, 'PHP-Meldung im Server-Log', $line);

echo "\n" . ($GLOBALS['fail'] === 0 ? 'ALLE TESTS BESTANDEN' : 'FEHLGESCHLAGEN') . ": {$GLOBALS['pass']} Prüfungen ok, {$GLOBALS['fail']} Fehler (Datenbank: $driver)\n";
exit($GLOBALS['fail'] === 0 ? 0 : 1);
