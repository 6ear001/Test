<?php
declare(strict_types=1);

// Lädt Konfiguration, Hilfsfunktionen und den Autoloader. Wird von api.php und den Tests eingebunden.
require_once __DIR__ . '/Util.php';

spl_autoload_register(static function (string $class): void {
    if (strncmp($class, 'Erp\\', 4) !== 0) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

function erp_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $defaults = [
        'db' => ['driver' => 'sqlite', 'path' => dirname(__DIR__) . '/storage/erp.sqlite'],
        'timezone' => 'Europe/Berlin',
        'secure_cookies' => null,   // null = automatisch (HTTPS erkennen)
        'trust_proxy' => false,     // true, wenn ein Proxy/Load-Balancer X-Forwarded-* setzt
        'operator_key' => '',       // Schlüssel für die Betreiber-Konsole (leer = abgeschaltet)
        'allow_signup' => true,     // Selbstregistrierung neuer Firmen
        'login_limit' => [10, 600], // Versuche je Zeitfenster (Sekunden)
        'signup_limit' => [5, 3600],
    ];
    $file = getenv('ERP_CONFIG') ?: dirname(__DIR__) . '/config.php';
    $custom = is_file($file) ? (require $file) : [];
    $cfg = array_replace_recursive($defaults, is_array($custom) ? $custom : []);
    date_default_timezone_set((string) $cfg['timezone']);
    return $cfg;
}

// Falls auf dem Webspace die PHP-Erweiterung mbstring fehlt: einfache Ersatzfunktionen für UTF-8
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $s, ?string $enc = null): int { return preg_match_all('/./su', $s) ?: 0; }
}
if (!function_exists('mb_substr')) {
    function mb_substr(string $s, int $start, ?int $length = null, ?string $enc = null): string
    {
        preg_match_all('/./su', $s, $m);
        return implode('', array_slice($m[0], $start, $length));
    }
}

ini_set('display_errors', '0');
error_reporting(E_ALL);
