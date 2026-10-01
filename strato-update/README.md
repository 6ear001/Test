# Update für die echte Strato-Seite: Live-Demo Kasse & PDA

Neue Dateien: `assets/demo.css`, `assets/demo.js`
Geänderte Seiten: `pos-pda/index.html`, `ar/pos-pda/index.html`

Die Demos laufen komplett im Browser (kein PHP, kein Contabo-Aufruf). Artikel und Texte
(Deutsch/Arabisch) stehen oben in `assets/demo.js`. Preise in Cent, `vat` = MwSt.-Satz, `deposit` = Pfand.

Hochladen: die vier Dateien mit gleicher Ordnerstruktur ins Hauptverzeichnis der Domain kopieren
(gleichnamige Dateien ersetzen). `config.php`, PHP-Proxy und alle übrigen Seiten bleiben unverändert.
Die neuen Dateien sind mit `?v=20261001-1` versioniert; bei späteren Änderungen den Wert in beiden
HTML-Dateien erhöhen, damit Browser nicht die alte Datei aus dem Cache nehmen.
