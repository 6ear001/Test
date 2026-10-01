# Update für die echte Strato-Seite (kumulativ)

Alle Änderungen gegenüber der ursprünglichen Seite, in einem Paket. Kann über frühere Pakete gelegt werden.
`config.php` ist **nicht** enthalten und bleibt unverändert auf dem Server.

## 1. Live-Demo Kasse & PDA (`/pos-pda/`, `/ar/pos-pda/`)
`assets/demo.css`, `assets/demo.js`. Läuft komplett im Browser. Artikel und Texte (DE/AR) stehen oben in `demo.js`.

## 2. Preise im Kartenlook (Preise-Seite und Startseite)
`assets/preise.css`, `preise/`, `ar/preise/`, `index.html`, `ar/index.html`. Live-Preise bleiben über `api-site.php`.
`assets/site-data.js`: Einheit und Spar-Hinweis des Umschalters richten sich nach `<html lang>`.

## 3. Menü und Seitenordnung
- `assets/site-chrome.js`: Menü in der Reihenfolge des Kaufwegs (Kasse & PDA, Funktionen, Hardware, Preise, Downloads, Kontakt).
  Gilt für Kopfzeile, Handy-Menü und Fußzeile (DE + AR).
- Startseite: "Für wen" mit TSE/DSFinV-K/GoBD/§ 146a-Siegeln steht jetzt direkt unter der Kurzübersicht,
  vor den Funktionen. Neuer Button "Demo ausprobieren" bei "Kasse & PDA".

## 4. Auffindbarkeit (alle Seiten, DE + AR)
Eigener Seitentitel und Beschreibung je Seite, `canonical`, Social-Vorschau (`assets/og-image.jpg`),
`noindex` auf den Danke-Seiten. Danach nicht mehr alle Seiten mit demselben Titel "D-Group IT Solutions".

## 5. Sicherheit
- `.htaccess`: HTTPS-Umleitung, HSTS, Content-Security-Policy, X-Frame-Options, nosniff, Referrer-/Permissions-Policy,
  Sperre interner Dateien (`README.md`, `config.php`, `security-lib.php`, `*.zip`, `*.sql` ...), keine Verzeichnislisten,
  Caching und Kompression.
- Google Fonts entfernt: `Outfit` wird lokal ausgeliefert (`assets/fonts/`, `assets/site.css`). Das macht die Aussage
  in der Datenschutzerklärung wahr. Platzhalter "[Falls externe Inhalte ...]" dort entfernt.
- `security-lib.php` + `kontakt.php`, `api-*.php`, `logo.php`, `hardware-image.php`, `download-file.php`:
  Fremdseiten-Schutz, Feldlisten und Längengrenzen, Honeypot, Rate-Limit (8 Anfragen / 10 Min), keine Backend-Fehlerseiten
  oder -Adressen nach außen, nur erlaubte Inhaltstypen.
- `robots.txt`: technische Endpunkte ausgeschlossen. `zubehoer/`: Fallback-Kategorie wird maskiert.
- `assets/site-chrome.js`: Adresse der Sprachumschaltung wird maskiert.

## Nach dem Hochladen
1. `README.md` im Hauptverzeichnis des Servers **löschen**: sie nennt die Adresse des Contabo-Servers.
   (Die neue `.htaccess` sperrt `*.md` zusätzlich.)
2. Versteckte Dateien mit hochladen (`.htaccess`).
3. Prüfen: `https://…/` lädt, Kontaktformular senden, `…/README.md` liefert 403.
4. Landet die Seite in einer Endlosschleife (selten, wenn Strato HTTPS anders erkennt): in `.htaccess` den Block
   "Immer verschlüsselt (HTTPS)" entfernen.
5. Läuft Strato hinter einem Proxy, der immer dieselbe Besucher-IP zeigt: in `config.php` `define('DG_TRUST_PROXY', true);` ergänzen.
