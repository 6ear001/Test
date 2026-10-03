<?php
// Kopieren Sie diese Datei nach "config.php" und passen Sie sie an. config.php wird nie veröffentlicht oder in Git gespeichert.
return [
    // Variante 1: SQLite (läuft sofort, keine Datenbank-Einrichtung; für kleine Installationen und zum Ausprobieren)
    'db' => ['driver' => 'sqlite', 'path' => __DIR__ . '/storage/erp.sqlite'],

    // Variante 2: MySQL / MariaDB (empfohlen für den Dauerbetrieb; Zugangsdaten stehen im Strato- bzw. IONOS-Kundenbereich)
    // 'db' => ['driver' => 'mysql', 'host' => 'localhost', 'port' => 3306, 'name' => 'DATENBANKNAME', 'user' => 'BENUTZER', 'pass' => 'PASSWORT'],

    'timezone' => 'Europe/Berlin',

    // Selbstregistrierung neuer Firmen auf der Anmeldeseite (false = nur Sie legen Mandanten an)
    'allow_signup' => true,

    // Betreiber-Konsole (Tarife ändern, Mandanten sperren) über /api/operator/tenants mit Header X-Operator-Key.
    // Leer lassen = abgeschaltet. Sonst ein langer, zufälliger Wert (mindestens 20 Zeichen).
    'operator_key' => '',

    // Nur true setzen, wenn ein Proxy / Load-Balancer davorsitzt, der X-Forwarded-For und X-Forwarded-Proto korrekt setzt.
    'trust_proxy' => false,
];
