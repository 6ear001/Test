<?php
// Router für den PHP-Entwicklungsserver (php -S): ersetzt die .htaccess-Regeln. Nur für Tests und lokale Vorschau.
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$root = dirname(__DIR__);
if (preg_match('#^/(src|storage|tests|tools|config[^/]*\.php|\.git)(/|$)#', $path)) {
    http_response_code(403);
    echo 'Forbidden';
    return true;
}
if (preg_match('#^/api(/|$)#', $path) || $path === '/api.php') {
    $_SERVER['SCRIPT_NAME'] = '/api.php';
    require $root . '/api.php';
    return true;
}
return false;
