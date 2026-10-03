<?php
declare(strict_types=1);

namespace Erp;

/** Nimmt die Anfrage entgegen: Pfad, Schutz vor fremden Seiten (CSRF), Anmeldung, Berechtigung, Transaktion, JSON-Antwort. */
final class Kernel
{
    public static function path(): string
    {
        if (isset($_GET['_p']) && is_string($_GET['_p'])) return '/' . trim($_GET['_p'], '/');
        $uri = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
        if (preg_match('#/api(?:\.php)?(/.*)?$#', $uri, $m)) return rtrim($m[1] ?? '/', '/') ?: '/';
        return '/';
    }

    public static function handle(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        header('Referrer-Policy: no-referrer');
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        try {
            $cfg = erp_config();
            $router = new Router();
            Routes::register($router);
            $m = $router->match($method === 'HEAD' ? 'GET' : $method, self::path());
            if (!$m) throw new HttpError(404, 'Unbekannter Endpunkt');
            [$route, $params] = $m;
            $unsafe = !in_array($method, ['GET', 'HEAD'], true);
            if ($unsafe) self::checkOrigin($cfg);
            $body = $unsafe ? self::readBody() : [];
            $db = Db::conn();
            $ctx = new Ctx($db, $method, $_GET, $body);
            $ctx->params = $params;
            if ($route['perm'] !== null) {
                $user = Auth::user($db);
                if (!$user) throw new HttpError(401, 'Bitte anmelden');
                $ctx->user = $user;
                $ctx->tenantId = $user['tenant_id'];
                if ($route['perm'] !== 'auth' && !can($user['role'], $route['perm'])) throw forbidden();
            }
            $fn = $route['fn'];
            $result = ($unsafe && $route['tx']) ? $db->tx(fn() => $fn($ctx)) : $fn($ctx);
            self::send(200, $result ?? ['ok' => true]);
        } catch (HttpError $e) {
            self::send($e->status, ['error' => $e->getMessage()]);
        } catch (\Throwable $e) {
            error_log('[erp] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            self::send(500, ['error' => 'Interner Fehler. Bitte später erneut versuchen.']);
        }
    }

    private static function checkOrigin(array $cfg): void
    {
        if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'erp') throw new HttpError(403, 'Ungültige Anfrage');
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '' && $origin !== 'null') {
            $host = strtolower((string) parse_url($origin, PHP_URL_HOST));
            $own = !empty($cfg['trust_proxy']) && !empty($_SERVER['HTTP_X_FORWARDED_HOST']) ? (string) $_SERVER['HTTP_X_FORWARDED_HOST'] : (string) ($_SERVER['HTTP_HOST'] ?? '');
            $own = strtolower((string) preg_replace('/:\d+$/', '', trim(explode(',', $own)[0])));
            if ($host !== $own) throw new HttpError(403, 'Ungültige Anfrage');
        }
    }
    private static function readBody(): array
    {
        $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($len > 1048576) throw new HttpError(413, 'Anfrage zu groß');
        $raw = (string) file_get_contents('php://input', false, null, 0, 1048577);
        if ($raw === '') return [];
        if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) throw new HttpError(415, 'Nur JSON erlaubt');
        $data = json_decode($raw, true);
        if (!is_array($data)) throw new HttpError(400, 'Ungültiges JSON');
        return $data;
    }
    public static function send(int $status, $data): void
    {
        http_response_code($status);
        if ($data === [] ) $data = new \stdClass();
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PRESERVE_ZERO_FRACTION);
    }
}
