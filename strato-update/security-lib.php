<?php
// Gemeinsame Sicherheits-Helfer für die PHP-Proxy-Dateien (api-*.php, kontakt.php, logo.php, ...).
// Ergänzt config.php, ohne sie zu verändern: BACKEND_BASE und backend_get() bleiben dort.
// Diese Datei wird nur per require eingebunden und ist per .htaccess von außen nicht abrufbar.

/**
 * Echte Besucher-IP. X-Forwarded-For wird nur beachtet, wenn in config.php
 * define('DG_TRUST_PROXY', true); gesetzt ist (nur nötig, wenn ein Proxy/Load-Balancer davor sitzt).
 */
function dg_client_ip(): string
{
    if (defined('DG_TRUST_PROXY') && DG_TRUST_PROXY && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $first = trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) {
            return $first;
        }
    }
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

/** Hostname dieser Anfrage (ohne Port, kleingeschrieben, nur gültige Zeichen). */
function dg_host(): string
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\d+$/', '', $host);
    return preg_replace('/[^a-z0-9.\-]/', '', (string) $host);
}

/**
 * Begrenzt Anfragen je Besucher: höchstens $max innerhalb von $windowSeconds.
 * Gespeichert wird nur ein Hash, nie die IP selbst. Ist der Speicher nicht beschreibbar,
 * werden Anfragen lieber zugelassen als alle Besucher auszusperren.
 */
function dg_rate_limited(string $bucket, int $max, int $windowSeconds): bool
{
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/dg-rate';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return false;
    }
    $now = time();
    $file = $dir . '/' . hash('sha256', $bucket . '|' . dg_client_ip() . '|' . __DIR__) . '.json';
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return false;
    }
    flock($fh, LOCK_EX);
    $stamps = json_decode((string) stream_get_contents($fh), true);
    $stamps = is_array($stamps) ? $stamps : [];
    $stamps = array_values(array_filter($stamps, function ($t) use ($now, $windowSeconds) {
        return is_int($t) && $now - $t < $windowSeconds;
    }));
    $limited = count($stamps) >= $max;
    if (!$limited) {
        $stamps[] = $now;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($stamps));
    flock($fh, LOCK_UN);
    fclose($fh);

    // Gelegentlich alte Zähler aufräumen
    if (random_int(1, 50) === 1) {
        foreach (glob($dir . '/*.json') ?: [] as $old) {
            if ($now - (int) @filemtime($old) > 3600) {
                @unlink($old);
            }
        }
    }
    return $limited;
}

/**
 * Stammt die Anfrage von einer Seite dieser Domain? Prüft Origin, sonst Referer.
 * Fehlen beide (z. B. Datenschutz-Erweiterungen im Browser), wird nicht blockiert.
 */
function dg_same_origin(): bool
{
    $host = dg_host();
    if ($host === '') {
        return true;
    }
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $key) {
        $value = trim((string) ($_SERVER[$key] ?? ''));
        if ($value === '' || $value === 'null') {
            continue;
        }
        $other = parse_url($value, PHP_URL_HOST);
        return is_string($other) && strtolower($other) === $host;
    }
    return true;
}

/** Kürzt einen Text auf $max Zeichen (UTF-8-sicher, auch ohne mbstring). */
function dg_cut(string $value, int $max): string
{
    $value = str_replace("\0", '', $value);
    return function_exists('mb_substr') ? mb_substr($value, 0, $max, 'UTF-8') : substr($value, 0, $max);
}

/** Antwort für Besucher, wenn das Backend nicht sauber antwortet: keine Fehlerseiten oder Details durchreichen. */
function dg_backend_error(int $status): void
{
    http_response_code($status === 404 ? 404 : 502);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"error":"Dienst vorübergehend nicht verfügbar"}';
}

/** Leitet einen JSON-Endpunkt des Backends weiter (nur GET/HEAD, nur echte JSON-Antworten). */
function dg_proxy_json(string $path): void
{
    header('X-Content-Type-Options: nosniff');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'HEAD') {
        http_response_code(405);
        header('Allow: GET, HEAD');
        return;
    }
    [$status, $contentType, $body] = backend_get($path);
    if ($status < 200 || $status >= 300 || stripos($contentType, 'application/json') !== 0) {
        dg_backend_error($status);
        return;
    }
    http_response_code($status);
    header('Content-Type: ' . $contentType);
    if ($method !== 'HEAD') {
        echo $body;
    }
}

/** Leitet ein Bild des Backends weiter (nur GET/HEAD, nur Bild-Typen). */
function dg_proxy_image(string $path, int $maxAge = 300): void
{
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: script-src 'none'; sandbox");
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'HEAD') {
        http_response_code(405);
        header('Allow: GET, HEAD');
        return;
    }
    [$status, $contentType, $body] = backend_get($path);
    if ($status < 200 || $status >= 300 || !preg_match('#^image/(png|jpeg|webp|gif|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)\b#i', $contentType)) {
        dg_backend_error($status);
        return;
    }
    http_response_code($status);
    header('Content-Type: ' . $contentType);
    header('Cache-Control: public, max-age=' . $maxAge);
    if ($method !== 'HEAD') {
        echo $body;
    }
}
