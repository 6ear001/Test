# D-Group Kasse & PDA – Website mit API

Neue Landingpage für **D-Group IT Solutions**: helles, warmes Design mit der Markenfarbe Rot, eine **interaktive Kassen-Demo**, eine **PDA-Demo**, Pakete, FAQ und ein Beratungsformular, das über eine kleine JSON-API läuft. Läuft ohne Build-Schritt und ohne externe Abhängigkeiten (nur Node.js ≥ 20).

```bash
npm start          # http://localhost:3000
npm test           # Tests für Node-Server und PHP-API
npm run dev        # Neustart bei Änderungen am Server
```

## Aufbau

```
server.js              Node-Server: statische Dateien + API
data/site.json         Firmendaten, Ankündigung, Kontakt, Paketpreise
data/products.json     Demo-Artikel für die Kassen-Vorschau
public/index.html      Die Seite
public/assets/css      Styles (Farben und Abstände als Variablen am Dateianfang)
public/assets/js       Verhalten: Demo-Kasse, PDA-Demo, Formular, Animationen
public/assets/fonts    Outfit + Inter, lokal eingebunden (kein Google-Fonts-Aufruf, DSGVO-freundlich)
ionos/                 PHP-Variante der API + .htaccess für klassisches Webhosting (IONOS)
scripts/build-ionos.mjs  Baut das Upload-Paket dist/d-group-ionos.zip
test/api.test.js       Tests für den Node-Server (API, Validierung, Rate-Limit, Sicherheit)
test/php-api.test.js   Dieselben Regeln für die PHP-API (übersprungen, wenn PHP fehlt)
```

## API

| Methode | Pfad            | Zweck                                                                         |
| ------- | --------------- | ----------------------------------------------------------------------------- |
| GET     | `/api/health`   | Lebenszeichen                                                                 |
| GET     | `/api/site`     | Name, Ankündigung, Kontakt, Paketpreise aus `data/site.json`                  |
| GET     | `/api/products` | Warengruppen und Artikel der Demo-Kasse aus `data/products.json`              |
| POST    | `/api/contact`  | Beratungsanfrage (JSON). Antwort `201 {ok, id}`, Fehler `400 {errors}` / `429` |

`POST /api/contact` erwartet `name`, `contact` (E-Mail **oder** Telefon) und `consent: true`; optional `shopType`, `interest` (`kasse` · `kasse-pda` · `komplett` · `unsicher`) und `message`. Das Feld `website` ist ein Honeypot gegen Bots und muss leer bleiben. Es gilt ein Limit von 5 Anfragen je 10 Minuten und IP; IP-Adressen werden nicht gespeichert.

## Inhalte pflegen

- **Preise**: in `data/site.json` unter `packages` eintragen, z. B. `"kasse-pda": { "price": { "amount": 49, "unit": "pro Monat", "from": true } }`. Solange `price` `null` ist, zeigt die Seite „Preis auf Anfrage“.
- **Kontaktdaten**: `contact.email` / `contact.phone` in `data/site.json` füllen, dann erscheinen sie neben dem Formular.
- **Demo-Artikel**: `data/products.json` (Brutto-Preis, MwSt.-Satz 7 oder 19, optional `deposit` für Pfand).
- **Texte, Pakete, FAQ**: direkt in `public/index.html`.

## Eingehende Anfragen

Jede Anfrage wird als eine Zeile JSON in `data/requests.jsonl` gespeichert (steht in `.gitignore`, enthält personenbezogene Daten). Für Benachrichtigungen kann ein Slack-/Discord-/Mattermost-kompatibler Webhook gesetzt werden.

| Umgebungsvariable    | Bedeutung                                                              |
| -------------------- | ---------------------------------------------------------------------- |
| `PORT`, `HOST`       | Port (Standard 3000) und Adresse                                        |
| `REQUESTS_FILE`      | Speicherort der Anfragen                                                |
| `NOTIFY_WEBHOOK_URL` | Optional: Webhook, der bei jeder Anfrage eine Nachricht erhält          |
| `TRUST_PROXY=1`      | Hinter einem Reverse Proxy: Client-IP aus `X-Forwarded-For` verwenden   |
| `ALLOWED_ORIGIN`     | Nur nötig, wenn die HTML-Dateien auf einer anderen Domain liegen (CORS) |

## Betrieb

### A) IONOS / klassisches Webhosting (PHP)

```bash
npm run build:ionos     # erzeugt dist/d-group-ionos.zip
```

1. ZIP entpacken und den **Inhalt** (nicht den Ordner) per FTP/SFTP oder im IONOS „Webspace Explorer“ in das Hauptverzeichnis der Domain hochladen – oder zum Ausprobieren in einen Unterordner wie `test/`. Versteckte Dateien (`.htaccess`) müssen mit hochgeladen werden.
2. Aufrufen: `https://ihre-domain.de/` (bzw. `/test/`). Funktioniert die API, zeigt `https://ihre-domain.de/api/health` `{"status":"ok",…}`.
3. Optional E-Mail bei neuen Anfragen: in `api-data/config.php` `notifyEmail` (und möglichst `mailFrom` mit einer Adresse Ihrer Domain) eintragen.
4. Gespeicherte Anfragen stehen in `api-data/requests.php` (per FTP öffnen; die Datei ist von außen nicht abrufbar). Das Verzeichnis `api-data/` muss für PHP beschreibbar sein.

Voraussetzungen: Linux-Tarif mit PHP ≥ 7.4 und aktivierter `.htaccess`/mod_rewrite. Eigene 404-Seite: Zeile `ErrorDocument` in der `.htaccess` aktivieren, wenn die Seite im Hauptverzeichnis liegt. Zeigt die Seite hinter einem Proxy immer dieselbe Besucher-IP, `trustProxy` in `config.php` prüfen.

### B) Mit Node.js-Hosting (VPS, Render, Fly.io, Railway …)

Repo ausrollen, `npm start`, ggf. hinter einen Reverse Proxy (HTTPS) setzen und `TRUST_PROXY=1` setzen.

### C) Statische Seite und API getrennt

Den Ordner `public/` hochladen und die API woanders hosten. In `public/index.html` die Basis-URL im Tag `<meta name="dgroup-api" content="https://api.example.de">` eintragen, auf dem API-Server `ALLOWED_ORIGIN=https://ihre-domain.de` setzen und in der Content-Security-Policy des Webservers die API-Domain unter `connect-src` erlauben. Ohne erreichbare API bleibt die Seite lesbar; nur Formular und Demo-Artikel benötigen sie.

## Vor dem Livegang prüfen

- **Logo**: Das Logo ist ein einfaches SVG-Zeichen (`#logo` in `index.html`, `public/favicon.svg`). Bitte durch das echte `logo-mark` ersetzen.
- **Impressum & Datenschutz**: Die Footer-Links zeigen auf `/impressum/` und `/datenschutz/` wie auf der bisherigen Seite. Diese Seiten sind hier nicht enthalten.
- **Aussagen**: Alle Funktionsaussagen stammen von der bisherigen Seite (TSE inklusive, Updates im Abo, Support per E-Mail, PDA-Funktionen). Der Ablauf „In drei Schritten“ und die Paketinhalte sind Vorschläge und sollten fachlich bestätigt werden.
- **Domain**: `canonical` und `og:image` in `index.html` verweisen auf `https://d-group-it-solutions.de/`.
