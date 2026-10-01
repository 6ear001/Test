<?php
require __DIR__ . '/config.php';
require __DIR__ . '/security-lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /kontakt/');
    exit;
}

// 1) Nur Formulare von Seiten dieser Domain annehmen (Schutz vor fremden Seiten, die
//    Anfragen über diesen Server absenden wollen).
if (!dg_same_origin()) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Ungültige Anfrage.';
    exit;
}

// 2) Größe begrenzen (das Formular ist klein; große Anfragen sind kein Kontaktformular).
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 65536) {
    http_response_code(413);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Anfrage zu groß.';
    exit;
}

// 3) Nur die Felder des Formulars weiterreichen, jeweils gekürzt auf die im Formular erlaubte Länge.
$limits = [
    'produkt' => 200, 'language' => 5, 'returnOrigin' => 200, 'name' => 160, 'company' => 200,
    'email' => 256, 'phone' => 64, 'registerCount' => 6, 'message' => 4000, 'website' => 200,
];
$fields = [];
foreach ($limits as $name => $max) {
    if (isset($_POST[$name]) && is_string($_POST[$name])) {
        $fields[$name] = dg_cut($_POST[$name], $max);
    }
}
$lang = (($fields['language'] ?? '') === 'ar') ? 'ar' : 'de';
$fields['language'] = $lang;
$contactPath = ($lang === 'ar') ? '/ar/kontakt/' : '/kontakt/';
$thanksPath = $contactPath . 'danke/';

// returnOrigin muss zur eigenen Domain gehören, sonst durch die eigene Domain ersetzen.
$ownHost = dg_host();
$givenHost = isset($fields['returnOrigin']) ? parse_url($fields['returnOrigin'], PHP_URL_HOST) : null;
if (!is_string($givenHost) || strtolower($givenHost) !== $ownHost) {
    $fields['returnOrigin'] = 'https://' . $ownHost;
}

// 4) Honeypot: Menschen sehen das Feld nicht. Bots bekommen eine Scheinbestätigung,
//    das Backend wird nicht belastet.
if (trim($fields['website'] ?? '') !== '') {
    header('Location: ' . $thanksPath);
    exit;
}

// 5) Höchstens 8 Anfragen je 10 Minuten und Besucher.
if (dg_rate_limited('kontakt', 8, 600)) {
    header('Location: ' . $contactPath . '?fehler=limit');
    exit;
}

// Reicht das Formular an das Backend weiter. Die Redirect-Antwort
// zeigt dank returnOrigin (siehe kontakt/index.html) bereits auf die eigene
// Domain (/kontakt/danke bzw. /kontakt/?fehler=...) - einfach durchreichen,
// ohne die Backend-Adresse dabei irgendwo preiszugeben.
$ch = curl_init(BACKEND_BASE . '/public/kontakt');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
// Das Backend sieht sonst nur die Adresse dieses Servers statt die des Besuchers.
curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-Forwarded-For: ' . dg_client_ip()]);
$response = curl_exec($ch);

if ($response === false) {
    curl_close($ch);
    http_response_code(502);
    echo 'Das Kontaktformular ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.';
    exit;
}

$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headerText = substr($response, 0, $headerSize);
curl_close($ch);

if (preg_match('/^Location:\s*(.+)$/mi', $headerText, $m)) {
    // Nur Pfad+Query aus der Backend-Antwort uebernehmen, nie Host/Schema -
    // so kann die Contabo-Adresse auch dann nicht durchsickern, wenn
    // returnOrigin serverseitig aus irgendeinem Grund nicht gegriffen hat.
    $location = trim($m[1]);
    $path = parse_url($location, PHP_URL_PATH) ?: $contactPath;
    $query = parse_url($location, PHP_URL_QUERY);
    $target = $path . ($query ? '?' . $query : '');
    // Nur Ziele innerhalb des Kontaktbereichs zulassen (kein "//fremde-domain", keine Steuerzeichen).
    if (!preg_match('#^/(ar/)?kontakt(/|\?|$)#', $target) || preg_match('/[\x00-\x1f\x7f]/', $target)) {
        $target = $contactPath;
    }
    header('Location: ' . $target);
    exit;
}

// Kein Redirect vom Backend bekommen (unerwartet) - sicherheitshalber zurueck zum Formular.
header('Location: ' . $contactPath);
