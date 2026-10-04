<?php
declare(strict_types=1);

/**
 * Füllt eine LAUFENDE Installation mit Beispieldaten, damit Sie alle Bereiche gleich ausprobieren können:
 *   php tools/demo-data.php [Basis-URL]          (Standard: http://localhost:8080)
 * Legt die Demo-Firma "Demo Handel GmbH" an (Anmeldung: demo@example.com / Demo-Passwort-2026).
 * Nur für Test- und Vorführzwecke – nicht auf einer produktiven Installation ausführen.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$base = rtrim($argv[1] ?? 'http://localhost:8080', '/');
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'Demo-Passwort-2026';

final class Http
{
    public string $cookie = '';
    public function __construct(private string $base) {}
    public function call(string $method, string $path, ?array $body = null): array
    {
        [$route, $query] = array_pad(explode('?', $path, 2), 2, '');
        $headers = ['X-Requested-With: erp', 'Accept: application/json'];
        if ($this->cookie !== '') $headers[] = 'Cookie: ' . $this->cookie;
        if ($body !== null) $headers[] = 'Content-Type: application/json';
        $ctx = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body !== null ? json_encode($body) : '', 'ignore_errors' => true, 'timeout' => 60]]);
        $raw = @file_get_contents($this->base . '/api.php?_p=' . urlencode($route) . ($query ? "&$query" : ''), false, $ctx);
        if ($raw === false) { fwrite(STDERR, "Keine Verbindung zu {$this->base}. Läuft der Server? (z. B. php -S localhost:8080 im ERP-Ordner)\n"); exit(1); }
        $status = 0;
        foreach ($http_response_header ?? [] as $i => $line) {
            if ($i === 0 && preg_match('#HTTP/\S+ (\d+)#', $line, $m)) $status = (int) $m[1];
            if (preg_match('/^Set-Cookie:\s*(erp_session=[^;]*)/i', $line, $m)) $this->cookie = $m[1] === 'erp_session=' ? '' : $m[1];
        }
        return [$status, json_decode($raw, true) ?? []];
    }
    public function ok(string $method, string $path, ?array $body = null): array
    {
        [$s, $j] = $this->call($method, $path, $body);
        if ($s < 200 || $s >= 300) { fwrite(STDERR, "Fehler bei $method $path ($s): " . ($j['error'] ?? '?') . "\n"); exit(1); }
        return $j;
    }
}

$d = fn(int $daysAgo) => date('Y-m-d', strtotime("-$daysAgo days"));
$api = new Http($base);

[$s, $j] = $api->call('POST', '/auth/signup', ['company' => 'Demo Handel GmbH', 'name' => 'Dana Demo', 'email' => DEMO_EMAIL, 'password' => DEMO_PASSWORD]);
if ($s === 409) {
    $api->ok('POST', '/auth/login', ['email' => DEMO_EMAIL, 'password' => DEMO_PASSWORD]);
    if ($api->ok('GET', '/customers')['total'] > 0) { echo "Die Demo-Daten sind schon vorhanden. Anmeldung: " . DEMO_EMAIL . " / " . DEMO_PASSWORD . "\n"; exit(0); }
} elseif ($s !== 200) { fwrite(STDERR, "Registrierung fehlgeschlagen ($s): " . ($j['error'] ?? '?') . "\n"); exit(1); }

echo "Firma und Einstellungen …\n";
$api->ok('PUT', '/settings', ['company_name' => 'Demo Handel GmbH', 'street' => 'Musterstraße 12', 'zip' => '50667', 'city' => 'Köln', 'phone' => '0221 123456', 'email' => 'info@demo-handel.example', 'managing_director' => 'Dana Demo', 'register' => 'Amtsgericht Köln, HRB 00000', 'vat_id' => 'DE123456789', 'bank_name' => 'Musterbank', 'iban' => 'DE89370400440532013000', 'bic' => 'COBADEFFXXX', 'payment_days' => 14]);

echo "Konten …\n";
$acct = [];
foreach ($api->ok('GET', '/accounting/accounts?kind=all&limit=2000')['rows'] as $a) $acct[$a['number']] = $a['id'];
$api->ok('POST', '/accounting/journal', ['date' => $d(200), 'text' => 'Eröffnung Bankkonto', 'lines' => [['account_id' => $acct['1200'], 'debit_cents' => 4500000], ['account_id' => $acct['9000'], 'credit_cents' => 4500000]]]);
$spar = $api->ok('POST', '/accounting/finance-accounts', ['kind' => 'bank', 'name' => 'Sparkasse Rücklagen', 'iban' => 'DE02120300000000202051', 'bank_name' => 'Sparkasse', 'opening_cents' => 2000000, 'opening_date' => $d(200)]);
$api->ok('POST', '/accounting/transfer', ['from_account_id' => $acct['1200'], 'to_account_id' => $acct['1000'], 'amount_cents' => 50000, 'date' => $d(30), 'text' => 'Bareinzahlung Kasse']);
foreach ([150 => 'Mai', 120 => 'Juni', 90 => 'Juli', 60 => 'August', 30 => 'September'] as $ago => $m) {
    $api->ok('POST', '/accounting/journal', ['date' => $d($ago), 'text' => "Büromiete $m", 'lines' => [['account_id' => $acct['4210'], 'debit_cents' => 120000], ['account_id' => $acct['1200'], 'credit_cents' => 120000]]]);
}
$api->ok('POST', '/accounting/journal', ['date' => $d(20), 'text' => 'Telefon und Internet', 'lines' => [['account_id' => $acct['4920'], 'debit_cents' => 8900], ['account_id' => $acct['1576'], 'debit_cents' => 1691], ['account_id' => $acct['1200'], 'credit_cents' => 10591]]]);
$api->ok('POST', '/accounting/private', ['type' => 'withdrawal', 'account_id' => $acct['1200'], 'amount_cents' => 100000, 'date' => $d(15), 'text' => 'Privatentnahme']);

echo "Lager, Lieferanten, Kunden, Artikel …\n";
$wh = $api->ok('GET', '/warehouses')['rows'][0];
$wh2 = $api->ok('POST', '/warehouses', ['name' => 'Außenlager Bonn', 'code' => 'BN']);
$s1 = $api->ok('POST', '/suppliers', ['name' => 'Papier & Rolle GmbH', 'email' => 'verkauf@papier-rolle.example', 'street' => 'Hafenstraße 4', 'zip' => '20457', 'city' => 'Hamburg', 'payment_days' => 30, 'lead_days' => 4, 'iban' => 'DE44500105175407324931']);
$s2 = $api->ok('POST', '/suppliers', ['name' => 'Hardware Direkt AG', 'email' => 'bestellung@hardware-direkt.example', 'street' => 'Technikring 9', 'zip' => '50829', 'city' => 'Köln', 'payment_days' => 14, 'lead_days' => 7]);
$c1 = $api->ok('POST', '/customers', ['name' => 'Bäckerei Sonnenschein', 'email' => 'chef@sonnenschein.example', 'street' => 'Brotgasse 3', 'zip' => '53111', 'city' => 'Bonn', 'discount_pct' => 5, 'credit_limit_cents' => 500000, 'tags' => 'Stammkunde, Gastro']);
$c2 = $api->ok('POST', '/customers', ['name' => 'Kiosk am Markt e.K.', 'email' => 'kiosk@markt.example', 'street' => 'Marktplatz 1', 'zip' => '50667', 'city' => 'Köln', 'payment_days' => 14]);
$c3 = $api->ok('POST', '/customers', ['name' => 'Restaurant Zur Linde', 'email' => 'info@zur-linde.example', 'street' => 'Lindenallee 22', 'zip' => '40213', 'city' => 'Düsseldorf', 'tags' => 'Gastro']);
$c4 = $api->ok('POST', '/customers', ['name' => 'Getränkemarkt Nord GmbH', 'email' => 'einkauf@getraenke-nord.example', 'street' => 'Industriestr. 8', 'zip' => '22525', 'city' => 'Hamburg', 'payment_days' => 30]);
$c5 = $api->ok('POST', '/customers', ['name' => 'Café Lichtblick', 'status' => 'lead', 'email' => 'hallo@lichtblick.example', 'city' => 'Aachen', 'notes' => 'Interessent von der Messe – möchte Kassensystem mit Touchscreen.']);
$api->ok('POST', "/customers/{$c1['id']}/contacts", ['name' => 'Bernd Sonnenschein', 'role' => 'Inhaber', 'phone' => '0228 111222', 'email' => 'bernd@sonnenschein.example', 'is_primary' => true]);
$api->ok('POST', "/customers/{$c1['id']}/activities", ['kind' => 'call', 'text' => 'Telefonat: Zufrieden mit der Kasse, möchte zweiten Bondrucker für die Filiale.']);
$api->ok('POST', "/customers/{$c5['id']}/activities", ['kind' => 'task', 'text' => 'Angebot für Touchscreen-Kasse schicken', 'due_date' => $d(2)]);
$api->ok('POST', "/customers/{$c3['id']}/activities", ['kind' => 'task', 'text' => 'Nachfragen, ob Lieferung vollständig angekommen ist', 'due_date' => date('Y-m-d', strtotime('+3 days'))]);

$prod = [];
foreach ([
    ['KR-80', 'Kassenrolle 80 mm (50 Stück)', 'Verbrauch', 4500, 2200, 19, 1, 100, 200, $s1['id'], 'Pkt'],
    ['BR-57', 'Bonrolle 57 mm (50 Stück)', 'Verbrauch', 3500, 1700, 19, 1, 50, 100, $s1['id'], 'Pkt'],
    ['SCH-1', 'Kassenschublade 41 cm', 'Hardware', 8900, 5200, 19, 1, 3, 5, $s2['id'], 'Stk'],
    ['DR-BON', 'Bondrucker Thermo USB', 'Hardware', 18900, 11000, 19, 1, 3, 5, $s2['id'], 'Stk'],
    ['SC-1D', 'Barcode-Scanner 1D', 'Hardware', 6900, 3800, 19, 1, 4, 6, $s2['id'], 'Stk'],
    ['BUCH-K', 'Fachbuch Kassenführung', 'Zubehör', 2490, 1400, 7, 1, 5, 10, $s2['id'], 'Stk'],
    ['DL-SUP', 'Support / Fernwartung', 'Dienstleistung', 9500, 0, 19, 0, 0, 0, null, 'Std'],
    ['DL-SET', 'Einrichtung und Schulung vor Ort', 'Dienstleistung', 25000, 0, 19, 0, 0, 0, null, 'Pausch.'],
] as [$sku, $name, $cat, $price, $cost, $tax, $track, $min, $reorder, $sup, $unit]) {
    $prod[$sku] = $api->ok('POST', '/products', ['sku' => $sku, 'name' => $name, 'category' => $cat, 'price_cents' => $price, 'cost_cents' => $cost, 'tax_rate' => $tax, 'track_stock' => (bool) $track, 'min_stock' => $min, 'reorder_qty' => $reorder, 'supplier_id' => $sup, 'unit' => $unit, 'weight_g' => $track ? 300 : 0]);
}

echo "Einkauf …\n";
$po1 = $api->ok('POST', '/purchasing/orders', ['supplier_id' => $s1['id'], 'date' => $d(75), 'warehouse_id' => $wh['id'], 'lines' => [['product_id' => $prod['KR-80']['id'], 'qty' => 120], ['product_id' => $prod['BR-57']['id'], 'qty' => 80]]]);
$api->ok('POST', "/purchasing/orders/{$po1['id']}/order");
$l = $api->ok('GET', "/purchasing/orders/{$po1['id']}")['lines'];
$api->ok('POST', "/purchasing/orders/{$po1['id']}/receive", ['warehouse_id' => $wh['id'], 'date' => $d(68), 'lines' => [['line_id' => $l[0]['id'], 'qty' => 120], ['line_id' => $l[1]['id'], 'qty' => 80]]]);
$po = $api->ok('GET', "/purchasing/orders/{$po1['id']}");
$inv1 = $api->ok('POST', '/purchasing/invoices', ['supplier_id' => $s1['id'], 'po_id' => $po1['id'], 'supplier_ref' => 'PR-2026-1187', 'date' => $d(66), 'lines' => array_map(fn($x) => ['description' => $x['description'], 'qty' => $x['qty'], 'net_cents' => $x['net_cents'], 'tax_rate' => 19, 'po_line_id' => $x['id']], $po['lines'])]);
$api->ok('POST', "/purchasing/invoices/{$inv1['id']}/payments", ['amount_cents' => $po['gross_cents'], 'date' => $d(40), 'method' => 'bank', 'reference' => 'PR-2026-1187']);

$po2 = $api->ok('POST', '/purchasing/orders', ['supplier_id' => $s2['id'], 'date' => $d(30), 'warehouse_id' => $wh['id'], 'lines' => [['product_id' => $prod['SCH-1']['id'], 'qty' => 10], ['product_id' => $prod['DR-BON']['id'], 'qty' => 10], ['product_id' => $prod['SC-1D']['id'], 'qty' => 12], ['product_id' => $prod['BUCH-K']['id'], 'qty' => 20]]]);
$api->ok('POST', "/purchasing/orders/{$po2['id']}/order");
$l = $api->ok('GET', "/purchasing/orders/{$po2['id']}")['lines'];
$api->ok('POST', "/purchasing/orders/{$po2['id']}/receive", ['warehouse_id' => $wh['id'], 'date' => $d(22), 'lines' => [['line_id' => $l[0]['id'], 'qty' => 10], ['line_id' => $l[1]['id'], 'qty' => 6], ['line_id' => $l[2]['id'], 'qty' => 12]]]);
$api->ok('POST', '/purchasing/invoices', ['supplier_id' => $s2['id'], 'po_id' => $po2['id'], 'supplier_ref' => 'HD-88231', 'date' => $d(21), 'lines' => [['description' => 'Kassenschublade 41 cm', 'qty' => 10, 'net_cents' => 52000, 'tax_rate' => 19, 'po_line_id' => $l[0]['id']], ['description' => 'Bondrucker Thermo USB', 'qty' => 6, 'net_cents' => 66000, 'tax_rate' => 19, 'po_line_id' => $l[1]['id']], ['description' => 'Barcode-Scanner 1D', 'qty' => 12, 'net_cents' => 45600, 'tax_rate' => 19, 'po_line_id' => $l[2]['id']]]]);
$api->ok('POST', '/purchasing/orders', ['supplier_id' => $s1['id'], 'date' => $d(1), 'notes' => 'Entwurf: Nachbestellung Rollen', 'lines' => [['product_id' => $prod['KR-80']['id'], 'qty' => 100]]]);

echo "Verkauf …\n";
$deliver = function (int $orderId, array $qty, ?array $ship = null) use ($api, $wh, $d) {
    $o = $api->ok('GET', "/sales/orders/$orderId");
    $lines = [];
    foreach ($o['lines'] as $ln) if (isset($qty[$ln['sku']])) $lines[] = ['line_id' => $ln['id'], 'qty' => $qty[$ln['sku']]];
    return $api->ok('POST', "/sales/orders/$orderId/deliver", ['warehouse_id' => $wh['id'], 'lines' => $lines] + ($ship ? ['create_shipment' => true] + $ship : []));
};
$carriers = $api->ok('GET', '/logistics/carriers')['rows'];
$dhl = current(array_filter($carriers, fn($x) => $x['name'] === 'DHL'))['id'];
$dpd = current(array_filter($carriers, fn($x) => $x['name'] === 'DPD'))['id'];

// Auftrag A: Bäckerei – geliefert, abgerechnet, teilweise bezahlt, teilweise gutgeschrieben
$q = $api->ok('POST', '/sales/quotes', ['customer_id' => $c1['id'], 'date' => $d(35), 'lines' => [['product_id' => $prod['SCH-1']['id'], 'qty' => 2, 'discount_pct' => 5], ['product_id' => $prod['DR-BON']['id'], 'qty' => 2, 'discount_pct' => 5], ['product_id' => $prod['KR-80']['id'], 'qty' => 20, 'discount_pct' => 5], ['product_id' => $prod['DL-SET']['id'], 'qty' => 1]]]);
$api->ok('POST', "/sales/quotes/{$q['id']}/status", ['status' => 'accepted']);
$oA = $api->ok('POST', "/sales/quotes/{$q['id']}/convert");
$dl = $deliver($oA['id'], ['SCH-1' => 2, 'DR-BON' => 2, 'KR-80' => 20], ['carrier_id' => $dhl, 'tracking_no' => '00340434161094042557']);
$api->ok('POST', "/logistics/shipments/{$dl['shipment_id']}/status", ['status' => 'shipped', 'note' => 'Paket abgeholt']);
$api->ok('POST', "/logistics/shipments/{$dl['shipment_id']}/status", ['status' => 'delivered', 'note' => 'Zugestellt, Empfänger: Sonnenschein']);
$iA = $api->ok('POST', "/sales/orders/{$oA['id']}/invoice");
$api->ok('POST', "/sales/invoices/{$iA['id']}/issue", ['date' => $d(30)]);
$invA = $api->ok('GET', "/sales/invoices/{$iA['id']}");
$api->ok('POST', "/sales/invoices/{$iA['id']}/payments", ['amount_cents' => intdiv($invA['gross_cents'], 2), 'date' => $d(18), 'method' => 'bank']);
$kr = current(array_filter($invA['lines'], fn($x) => $x['sku'] === 'KR-80'));
$api->ok('POST', "/sales/invoices/{$iA['id']}/credit-note", ['lines' => [['line_id' => $kr['id'], 'qty' => 2]], 'restock_warehouse_id' => $wh['id'], 'date' => $d(14), 'reason' => 'Falsche Rollengröße bestellt – Retoure']);

// Auftrag B: Kiosk – geliefert, Rechnung überfällig
$oB = $api->ok('POST', '/sales/orders', ['customer_id' => $c2['id'], 'date' => $d(50), 'lines' => [['product_id' => $prod['KR-80']['id'], 'qty' => 30], ['product_id' => $prod['BR-57']['id'], 'qty' => 20], ['product_id' => $prod['SC-1D']['id'], 'qty' => 2]]]);
$dB = $deliver($oB['id'], ['KR-80' => 30, 'BR-57' => 20, 'SC-1D' => 2], ['carrier_id' => $dpd, 'tracking_no' => '09445012345678']);
$api->ok('POST', "/logistics/shipments/{$dB['shipment_id']}/status", ['status' => 'delivered']);
$iB = $api->ok('POST', "/sales/orders/{$oB['id']}/invoice");
$api->ok('POST', "/sales/invoices/{$iB['id']}/issue", ['date' => $d(45)]);

// Auftrag C: Restaurant – teilweise geliefert, Sendung unterwegs (verspätet)
$oC = $api->ok('POST', '/sales/orders', ['customer_id' => $c3['id'], 'date' => $d(6), 'lines' => [['product_id' => $prod['SC-1D']['id'], 'qty' => 5], ['product_id' => $prod['DL-SUP']['id'], 'qty' => 4], ['product_id' => $prod['BR-57']['id'], 'qty' => 10]]]);
$dC = $deliver($oC['id'], ['SC-1D' => 3, 'BR-57' => 10], ['carrier_id' => $dhl, 'tracking_no' => '00340434161094999999']);
$api->ok('PUT', "/logistics/shipments/{$dC['shipment_id']}", ['carrier_id' => $dhl, 'tracking_no' => '00340434161094999999', 'eta' => $d(1), 'packages' => 1, 'weight_g' => 1500, 'cost_cents' => 790]);
$api->ok('POST', "/logistics/shipments/{$dC['shipment_id']}/status", ['status' => 'in_transit', 'note' => 'Im Zustellfahrzeug']);

// Angebot D: Getränkemarkt – gesendet
$qD = $api->ok('POST', '/sales/quotes', ['customer_id' => $c4['id'], 'date' => $d(3), 'lines' => [['product_id' => $prod['DR-BON']['id'], 'qty' => 4], ['product_id' => $prod['SCH-1']['id'], 'qty' => 4], ['product_id' => $prod['DL-SET']['id'], 'qty' => 2]]]);
$api->ok('POST', "/sales/quotes/{$qD['id']}/status", ['status' => 'sent']);

// Dienstleistungs-Rechnungen der letzten Monate (Verlauf im Dashboard)
foreach ([[165, $c1, 8], [135, $c2, 5], [105, $c3, 12], [75, $c1, 6], [65, $c4, 10], [20, $c3, 7], [10, $c2, 4]] as [$ago, $cu, $hours]) {
    $inv = $api->ok('POST', '/sales/invoices', ['customer_id' => $cu['id'], 'date' => $d($ago), 'reference' => 'Support ' . date('m/Y', strtotime("-$ago days")), 'lines' => [['product_id' => $prod['DL-SUP']['id'], 'qty' => $hours]]]);
    $api->ok('POST', "/sales/invoices/{$inv['id']}/issue", ['date' => $d($ago)]);
    if ($ago > 15) {
        $g = $api->ok('GET', "/sales/invoices/{$inv['id']}")['gross_cents'];
        $api->ok('POST', "/sales/invoices/{$inv['id']}/payments", ['amount_cents' => $g, 'date' => $d(max($ago - 12, 1)), 'method' => 'bank']);
    }
}

echo "\nFertig. Öffnen Sie $base/ und melden Sie sich an:\n  E-Mail:   " . DEMO_EMAIL . "\n  Passwort: " . DEMO_PASSWORD . "\n";
