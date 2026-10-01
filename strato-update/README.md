# Update für die echte Strato-Seite

Enthält alle Änderungen (kumulativ, kann über ein früheres Update-Paket gelegt werden):

**1. Live-Demo Kasse & PDA** (`/pos-pda/`, `/ar/pos-pda/`)
- neu: `assets/demo.css`, `assets/demo.js`
- geändert: `pos-pda/index.html`, `ar/pos-pda/index.html`
- Läuft komplett im Browser. Artikel und Texte (DE/AR) stehen oben in `assets/demo.js`.

**2. Preise im neuen Kartenlook** (Preise-Seite und Startseite, DE + AR)
- neu: `assets/preise.css`
- geändert: `preise/index.html`, `ar/preise/index.html`, `index.html`, `ar/index.html`
- Alle Preise kommen weiterhin live über `api-site.php` (data-field / data-cycle / data-if bleiben unverändert).
- `assets/site-data.js`: Einheit ("Monat", "Quartal", "Jahr") und Spar-Hinweis des Umschalters richten
  sich jetzt nach `<html lang>`. Vorher erschienen sie auch auf den arabischen Seiten auf Deutsch.
  Für Deutsch ändert sich nichts.

Hochladen: Dateien mit gleicher Ordnerstruktur ins Hauptverzeichnis der Domain kopieren (gleichnamige
Dateien ersetzen). `config.php`, die PHP-Proxy-Dateien und alle übrigen Seiten bleiben unverändert.

Versionsparameter: `demo.*` mit `?v=20261001-1`, `preise.css` und `site-data.js` mit `?v=20261001-2`.
Bei späteren Änderungen den Wert in den HTML-Dateien erhöhen, damit Browser nicht die alte Datei nehmen.
