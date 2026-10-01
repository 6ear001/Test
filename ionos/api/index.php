<?php
// D-Group Website: JSON-API für klassisches Webhosting (IONOS, Strato, …) mit PHP 7.4+.
// Gleiche Endpunkte und Regeln wie server.js:
//   GET  /api/health    GET /api/site    GET /api/products    POST /api/contact
// Aufgerufen wird diese Datei über die Rewrite-Regel in der .htaccess (?route=…).

declare(strict_types=1);

$dataDir = dirname(__DIR__) . '/api-data';
$config = [
    'notifyEmail' => '',
    'mailFrom' => '',
    'trustProxy' => false,
    'rateMax' => 5,
    'rateWindowSeconds' => 600,
];
if (is_file($dataDir . '/config.php')) {
    $loaded = include $dataDir . '/config.php';
    if (is_array($loaded)) {
        $config = array_merge($config, $loaded);
    }
}

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

function send_json(int $status, $body, array $headers = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function serve_data_file(string $dataDir, string $file, int $maxAge): void
{
    $raw = @file_get_contents($dataDir . '/' . $file);
    $json = $raw === false ? null : json_decode($raw);
    if ($json === null) {
        error_log("D-Group API: {$file} nicht lesbar");
        send_json(500, ['ok' => false, 'error' => 'Daten momentan nicht verfügbar.']);
    }
    send_json(200, $json, ['Cache-Control' => 'public, max-age=' . $maxAge]);
}

/** Bereinigt Freitext: Steuerzeichen raus, Leerraum glätten (Zeilenumbrüche bleiben), Länge kappen. */
function clean_text($value, int $max): string
{
    if (!is_string($value)) {
        return '';
    }
    $value = preg_replace('/[^\S\n]+/u', ' ', $value) ?? '';
    $value = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]/', '', $value) ?? '';
    return mb_substr(trim($value), 0, $max);
}

function client_ip(array $config): string
{
    if (!empty($config['trustProxy']) && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $first = trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if ($first !== '') {
            return $first;
        }
    }
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

/** Dateibasiertes Rate-Limit. Gespeichert wird nur ein Hash der IP, nie die IP selbst. */
function rate_limited(string $dataDir, array $config): bool
{
    $dir = $dataDir . '/rate';
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
        return false; // Ohne Schreibrecht lieber Anfragen zulassen als alle abzuweisen
    }
    $window = (int) $config['rateWindowSeconds'];
    $max = (int) $config['rateMax'];
    $now = time();
    $file = $dir . '/' . hash('sha256', client_ip($config) . '|' . __FILE__) . '.json';

    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return false;
    }
    flock($fh, LOCK_EX);
    $stamps = json_decode((string) stream_get_contents($fh), true);
    $stamps = is_array($stamps) ? $stamps : [];
    $stamps = array_values(array_filter($stamps, function ($t) use ($now, $window) {
        return is_int($t) && $now - $t < $window;
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
            if ($now - (int) @filemtime($old) > $window) {
                @unlink($old);
            }
        }
    }
    return $limited;
}

function validate_contact(array $body): array
{
    $errors = [];
    $data = [
        'name' => clean_text($body['name'] ?? '', 100),
        'contact' => clean_text($body['contact'] ?? '', 150),
        'shopType' => clean_text($body['shopType'] ?? '', 30),
        'interest' => clean_text($body['interest'] ?? '', 30),
        'message' => clean_text($body['message'] ?? '', 2000),
    ];

    if (mb_strlen($data['name']) < 2) {
        $errors['name'] = 'Bitte geben Sie Ihren Namen an.';
    }

    $digits = preg_replace('/\D/', '', $data['contact']) ?? '';
    $isEmail = (bool) preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $data['contact']);
    $isPhone = (bool) preg_match('/^\+?[\d\s()\-.\/]{6,25}$/', $data['contact']) && strlen($digits) >= 6;
    if (!$isEmail && !$isPhone) {
        $errors['contact'] = 'Bitte geben Sie eine gültige E-Mail-Adresse oder Telefonnummer an.';
    }

    $shopTypes = ['kiosk', 'lebensmittel', 'getraenke', 'baeckerei', 'einzelhandel', 'sonstiges'];
    if ($data['shopType'] !== '' && !in_array($data['shopType'], $shopTypes, true)) {
        $errors['shopType'] = 'Ungültige Auswahl.';
    }
    if (!in_array($data['interest'], ['kasse', 'kasse-pda', 'komplett', 'unsicher'], true)) {
        $data['interest'] = 'unsicher';
    }
    if (($body['consent'] ?? null) !== true) {
        $errors['consent'] = 'Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.';
    }
    return [$data, $errors, $isEmail ? 'email' : 'phone'];
}

/** Speichert die Anfrage in einer PHP-Datei, die beim direkten Aufruf nichts ausgibt. */
function store_request(string $dataDir, array $record): bool
{
    $file = $dataDir . '/requests.php';
    $isNew = !is_file($file);
    $fh = @fopen($file, 'ab');
    if ($fh === false) {
        return false;
    }
    flock($fh, LOCK_EX);
    if ($isNew) {
        fwrite($fh, "<?php http_response_code(404); exit; ?>\n");
    }
    $ok = fwrite($fh, json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n") !== false;
    flock($fh, LOCK_UN);
    fclose($fh);
    return $ok;
}

function header_safe(string $value): string
{
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

function notify_by_mail(array $config, array $record): void
{
    $to = header_safe((string) $config['notifyEmail']);
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return;
    }
    $host = strtolower(preg_replace('/[^a-z0-9.\-]/i', '', explode(':', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost'))[0]) ?? 'localhost');
    $from = header_safe((string) $config['mailFrom']);
    if ($from === '' || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        $from = 'noreply@' . ($host !== '' ? $host : 'localhost');
    }

    $headers = [
        'From: ' . $from,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    if ($record['contactKind'] === 'email' && filter_var($record['contact'], FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: ' . header_safe($record['contact']);
    }

    $subject = '=?UTF-8?B?' . base64_encode('Neue Beratungsanfrage: ' . header_safe($record['name'])) . '?=';
    $body = "Neue Beratungsanfrage über die Website\n\n"
        . 'Name:      ' . $record['name'] . "\n"
        . 'Kontakt:   ' . $record['contact'] . "\n"
        . 'Interesse: ' . $record['interest'] . "\n"
        . 'Geschäft:  ' . ($record['shopType'] !== '' ? $record['shopType'] : '-') . "\n"
        . 'Eingegangen: ' . $record['receivedAt'] . "\n\n"
        . ($record['message'] !== '' ? "Nachricht:\n" . $record['message'] . "\n" : '');

    if (!@mail($to, $subject, $body, implode("\r\n", $headers))) {
        error_log('D-Group API: Benachrichtigungs-Mail konnte nicht gesendet werden');
    }
}

function handle_contact(string $dataDir, array $config): void
{
    if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') === false) {
        send_json(415, ['ok' => false, 'error' => 'Content-Type muss application/json sein.']);
    }
    $limit = 16 * 1024;
    $raw = (string) file_get_contents('php://input', false, null, 0, $limit + 1);
    if (strlen($raw) > $limit) {
        send_json(413, ['ok' => false, 'error' => 'Anfrage zu groß.']);
    }
    $body = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        send_json(400, ['ok' => false, 'error' => 'Ungültiges JSON.']);
    }
    // Leeres Objekt {} ist erlaubt (wird unten validiert), Listen wie [1,2] nicht
    if (!is_array($body) || ($body !== [] && array_keys($body) === range(0, count($body) - 1))) {
        send_json(400, ['ok' => false, 'error' => 'Ungültige Anfrage.']);
    }

    // Honeypot: Menschen sehen das Feld nicht. Bots bekommen eine Scheinbestätigung.
    if (isset($body['website']) && is_string($body['website']) && trim($body['website']) !== '') {
        send_json(201, ['ok' => true, 'id' => bin2hex(random_bytes(8))]);
    }

    if (rate_limited($dataDir, $config)) {
        send_json(
            429,
            ['ok' => false, 'error' => 'Zu viele Anfragen. Bitte versuchen Sie es in ein paar Minuten erneut.'],
            ['Retry-After' => (string) (int) $config['rateWindowSeconds']]
        );
    }

    [$data, $errors, $kind] = validate_contact($body);
    if ($errors) {
        send_json(400, ['ok' => false, 'errors' => $errors]);
    }

    $record = array_merge(
        ['id' => bin2hex(random_bytes(8)), 'receivedAt' => gmdate('c')],
        $data,
        ['contactKind' => $kind]
    );
    if (!store_request($dataDir, $record)) {
        error_log('D-Group API: Anfrage konnte nicht gespeichert werden (Schreibrechte für api-data/ prüfen)');
        send_json(500, ['ok' => false, 'error' => 'Ihre Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.']);
    }

    notify_by_mail($config, $record);
    send_json(201, ['ok' => true, 'id' => $record['id']]);
}

// ---- Routing ---------------------------------------------------------------
$route = (string) ($_GET['route'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$routes = [
    'health' => ['GET'],
    'site' => ['GET'],
    'products' => ['GET'],
    'contact' => ['POST'],
];
if (!isset($routes[$route])) {
    send_json(404, ['ok' => false, 'error' => 'Nicht gefunden.']);
}
if (!in_array($method, $routes[$route], true) && !($method === 'HEAD' && $routes[$route] === ['GET'])) {
    send_json(405, ['ok' => false, 'error' => 'Methode nicht erlaubt.'], ['Allow' => implode(', ', $routes[$route])]);
}

switch ($route) {
    case 'health':
        send_json(200, ['status' => 'ok', 'time' => gmdate('c')]);
    case 'site':
        serve_data_file($dataDir, 'site.json', 60);
    case 'products':
        serve_data_file($dataDir, 'products.json', 300);
    case 'contact':
        handle_contact($dataDir, $config);
}
