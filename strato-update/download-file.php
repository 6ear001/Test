<?php
require __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    exit;
}

$id = $_GET['id'] ?? '';
if (!is_string($id)) {
    http_response_code(400);
    exit;
}
// Strikt als GUID validieren, bevor es in die Backend-URL eingesetzt wird
// (verhindert Missbrauch als offenes Relay auf beliebige Pfade).
if (!preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $id)) {
    http_response_code(400);
    exit;
}

// Download-Dateien können bis zu 300 MB groß sein - anders als die kleinen
// JSON-/Bild-Proxys hier NICHT im Speicher puffern (curl_exec mit RETURNTRANSFER
// würde bei einem 300-MB-Installer den PHP-Speicher sprengen), sondern Byte für
// Byte direkt an den Browser durchreichen (CURLOPT_WRITEFUNCTION).
set_time_limit(0);
while (ob_get_level() > 0) {
    ob_end_flush();
}

function fetch_download($id)
{
    $ch = curl_init(BACKEND_BASE . '/downloads/' . $id . '/file');
    curl_setopt($ch, CURLOPT_TIMEOUT, 300);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);

    curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($curl, $headerLine) {
        $len = strlen($headerLine);
        $trimmed = trim($headerLine);
        if ($trimmed === '') {
            return $len;
        }
        if (stripos($trimmed, 'HTTP/') === 0) {
            $parts = explode(' ', $trimmed, 3);
            if (isset($parts[1])) {
                http_response_code((int) $parts[1]);
            }
            return $len;
        }
        if (preg_match('/^(Content-Type|Content-Disposition|Content-Length):\s*(.+)$/i', $trimmed, $m)) {
            header($m[1] . ': ' . $m[2]);
        }
        return $len;
    });

    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($curl, $chunk) {
        echo $chunk;
        flush();
        return strlen($chunk);
    });

    curl_exec($ch);
    $errno = curl_errno($ch);
    curl_close($ch);
    return $errno;
}

header('X-Content-Type-Options: nosniff');

// Gelegentlich bricht die erste Verbindung zum Backend (langsamer Kaltstart,
// kurzer Netz-Hänger) ab, bevor überhaupt Daten fließen - ein zweiter Versuch
// über eine frische Verbindung klappt dabei praktisch immer sofort. Nur retryn,
// solange noch nichts an den Browser gesendet wurde (sonst wäre der Download
// schon angefangen und ein Neuversuch würde ihn doppelt schreiben).
$errno = fetch_download($id);
if ($errno && !headers_sent()) {
    $errno = fetch_download($id);
}
if ($errno && !headers_sent()) {
    http_response_code(502);
}
