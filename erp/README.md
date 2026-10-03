# D-Group ERP

Webbasiertes ERP als **SaaS-fähige PHP-Anwendung** (mehrere Firmen/Mandanten auf einer Installation) – ohne Node, ohne Build-Schritt, ohne Composer. Läuft auf normalem Webspace (Strato, IONOS, …) mit PHP und **SQLite oder MySQL/MariaDB**.

## Was enthalten ist

| Bereich | Funktionen |
|---|---|
| **Kundenverwaltung (CRM)** | Kunden, Interessenten, Ansprechpartner, Aktivitäten und Wiedervorlagen, Kundenakte mit Umsatz/offenen Posten, Kreditlimit-Warnung, Kontoauszug |
| **Verkauf** | Angebot → Auftrag → Lieferschein → Rechnung → Zahlung, Teillieferungen, Teilrechnungen, Gutschriften/Retouren, Druck als PDF (Browser), lückenlose Rechnungsnummern |
| **Einkauf** | Lieferanten, Bestellungen, Wareneingang (Teillieferungen), Eingangsrechnungen mit Zuordnung zur Bestellung, Zahlungen, Nachbestell-Vorschläge nach Mindestbestand |
| **Lager** | Mehrere Lager, Bestand je Lager, Reservierung durch Aufträge, Umlagerung, Korrekturen, Inventur, Lagerplätze, gleitender Durchschnittspreis, lückenloses Bewegungsprotokoll |
| **Logistik** | Sendungen (ausgehend und eingehend), Frachtführer mit Tracking-Link, Statusverlauf, Verspätungs-Hinweise, Frachtkosten |
| **Buchhaltung** | Doppelte Buchführung (Kontenrahmen angelehnt an SKR03, Auszug), **Kundenkonten (Debitoren)** und **Lieferantenkonten (Kreditoren)** automatisch je Kunde/Lieferant, **eigene Konten** (mehrere Bank- und Kassenkonten, Umbuchung, Privatentnahme/-einlage), Journal, manuelle Buchungen, Storno, Festschreibung, Kontoblätter, Offene Posten mit Altersstruktur, Summen- und Saldenliste, GuV, Bilanz-Übersicht, Umsatzsteuer-Auswertung |
| **SaaS** | Mandanten (Firmen) strikt getrennt, Selbstregistrierung, Rollen (Administrator, Buchhaltung, Vertrieb, Einkauf, Lager & Logistik, Nur lesen), Tarife mit Limits, Betreiber-Schnittstelle, Änderungsprotokoll |

Alle Listen lassen sich als CSV exportieren. Die Oberfläche ist deutsch, für Handy und Desktop gebaut, mit hellem und dunklem Design.

## Installation auf Strato / IONOS (oder jedem Webspace mit PHP)

Voraussetzung: **PHP 8.1 oder neuer** (im Kundenbereich einstellbar) mit `pdo_sqlite` **oder** `pdo_mysql`. Empfohlen für den Dauerbetrieb: eine MySQL-/MariaDB-Datenbank.

1. Ordner `erp/` per FTP in ein Verzeichnis Ihres Webspace hochladen, z. B. nach `/erp/` (erreichbar unter `https://IHRE-DOMAIN/erp/`).
2. `config.sample.php` kopieren nach **`config.php`** und anpassen:
   * **MySQL (empfohlen):** im Kundenbereich eine Datenbank anlegen und Host, Name, Benutzer und Passwort in `config.php` eintragen. Die Tabellen werden beim ersten Aufruf automatisch angelegt.
   * **SQLite:** nichts weiter nötig. Der Ordner `storage/` muss für PHP beschreibbar sein (Rechte 775, notfalls 777).
3. `https://IHRE-DOMAIN/erp/` öffnen → **„Firma registrieren“**. Die erste Registrierung legt die Firma und den Administrator an.
4. Dort **Firma & Einstellungen** ausfüllen (Adresse, USt-IdNr., Bankverbindung) – diese Angaben erscheinen auf den Belegen.
5. Soll nur Ihre eigene Firma das System nutzen, in `config.php` `'allow_signup' => false` setzen (weitere Mandanten legen dann Sie über die Betreiber-Schnittstelle an).

Die mitgelieferte `.htaccess` erzwingt HTTPS, sperrt `src/`, `storage/`, `tools/`, `tests/` und `config.php` von außen und setzt Sicherheits-Header (u. a. eine strenge Content-Security-Policy). `mod_rewrite` ist nicht zwingend nötig: Die Oberfläche spricht die API direkt über `api.php` an.

## Betrieb

* **Datensicherung:** SQLite: `php tools/backup.php` (z. B. als täglicher Cronjob). MySQL: `mysqldump` oder die Datensicherung Ihres Hosters. **Bitte vor dem Produktivbetrieb eine Wiederherstellung einmal ausprobieren.**
* **Mandant endgültig löschen** (z. B. DSGVO-Löschwunsch): `php tools/delete-tenant.php <ID> --yes` (vorher sichern).
* **Updates:** neue Dateien über die alten kopieren; `config.php` und `storage/` bleiben unberührt. Neue Tabellen werden beim Start angelegt.
* **Tarife** (Benutzer- und Belegzahl je Monat) stehen in `src/Util.php` (Konstante `PLANS`).

### Betreiber-Schnittstelle (SaaS-Verwaltung)

In `config.php` einen langen zufälligen `'operator_key'` setzen (mind. 20 Zeichen). Dann, z. B. mit curl:

```bash
# Mandanten ansehen
curl -H "X-Operator-Key: IHR-SCHLÜSSEL" -H "X-Requested-With: erp" https://IHRE-DOMAIN/erp/api.php?_p=/operator/tenants
# Mandant anlegen
curl -X POST -H "X-Operator-Key: IHR-SCHLÜSSEL" -H "X-Requested-With: erp" -H "Content-Type: application/json" \
  -d '{"company":"Firma GmbH","name":"Erika Muster","email":"erika@firma.de","password":"MindestensZehnZeichen1","plan":"business"}' \
  "https://IHRE-DOMAIN/erp/api.php?_p=/operator/tenants"
# Tarif ändern / Mandant sperren
curl -X PUT -H "X-Operator-Key: IHR-SCHLÜSSEL" -H "X-Requested-With: erp" -H "Content-Type: application/json" \
  -d '{"plan":"enterprise","active":true}' "https://IHRE-DOMAIN/erp/api.php?_p=/operator/tenants/1"
```

## Sicherheit

* Mandantentrennung: Jede Abfrage ist auf die Firma des angemeldeten Benutzers beschränkt. Der Testlauf prüft das für alle Bereiche (Lesen, Ändern, Löschen, Verknüpfen fremder Daten).
* Passwörter mit `password_hash` (bcrypt), Sitzungs-Token nur als Hash gespeichert, Cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` bei HTTPS), Anmeldeversuche begrenzt (je E-Mail und IP), keine Benutzer-Aufzählung bei der Anmeldung.
* Schutz vor fremden Seiten (CSRF): Pflicht-Header + Origin-Prüfung bei jeder ändernden Anfrage, nur JSON, Größenlimit.
* Alle Datenbankzugriffe parametrisiert; die Oberfläche setzt Daten ausschließlich als Text ein (kein HTML aus der Datenbank) und läuft unter einer strengen Content-Security-Policy ohne Inline-Skripte.
* Rollen und Rechte werden **serverseitig** geprüft. Buchungen sind unveränderlich (nur Storno), Belegnummern lückenlos, alle Änderungen stehen im Protokoll.
* Fehlermeldungen verraten keine internen Details.

## Tests

```bash
php tests/run.php                       # SQLite
ERP_TEST_DB=mysql ERP_TEST_MYSQL='host=127.0.0.1;port=3306;name=erp_test;user=erp;pass=…' php tests/run.php   # MySQL/MariaDB (leert die Testdatenbank!)
```

Der Testlauf startet einen PHP-Server mit frischer Datenbank und prüft über 330 Fälle: kompletter Ablauf von Einkauf bis Zahlung, Teillieferungen, Gutschriften mit Rundung, Lagerführung, Buchungs-Invarianten (Soll = Haben, Aktiva = Passiva), Rollen, Tarif-Limits, Mandantentrennung, CSRF/Brute-Force, Betriebswerkzeuge. Er ist gegen SQLite und MariaDB 10.11 grün.

## Wichtige Hinweise und Grenzen (bitte lesen)

* **Steuer und Recht:** Kontenrahmen, Belegvorlagen und Auswertungen sind eine **Arbeitsgrundlage, keine Steuerberatung und keine zertifizierte Buchhaltungssoftware** (kein GoBD-Testat, kein DATEV-/ELSTER-Export). Bitte Rechnungsvorlage und Kontenplan einmal mit Ihrer Steuerberatung prüfen (Pflichtangaben nach § 14 UStG, Leistungsdatum, Zahlungsbedingungen, Aufbewahrung).
* Umsatzsteuer: Soll-Versteuerung mit Steuersätzen 19 %, 7 % und 0 %. **Nicht enthalten:** Kleinunternehmerregelung (§ 19), Reverse-Charge (§ 13b), innergemeinschaftliche Lieferungen, Ist-Versteuerung, Skonto, Mehrwährung.
* Die Warenwirtschaft nutzt das **Wareneinkaufskonto-Verfahren**: Der Wareneinsatz wird mit der Eingangsrechnung gebucht; die Bestandsveränderung zum Jahresende buchen Sie manuell (Lagerwert siehe Auswertung „Bestand“).
* **Nicht enthalten:** E-Mail-Versand (Belege drucken Sie als PDF aus dem Browser; „Passwort vergessen“ setzt der Administrator zurück), Online-Zahlung und automatische Abrechnung der Tarife (z. B. Stripe), Mahnwesen, Stücklisten/Produktion, Chargen und Seriennummern, Zwei-Faktor-Anmeldung, Schnittstellen zu Versanddienstleistern (Tracking-Links sind Vorlagen, bitte prüfen), mehrsprachige Oberfläche.
* Eine Installation auf einem einzelnen Server trägt kleine bis mittlere Datenmengen gut. Für sehr viele Mandanten empfiehlt sich MySQL/MariaDB auf einem eigenen Datenbankserver.
* Personenbezogene Daten (Kunden, Mitarbeiter): Auftragsverarbeitungsvertrag mit dem Hosting-Anbieter und Datenschutzhinweise für Ihre Kunden sind Ihre Aufgabe.

## Aufbau

```
index.html, assets/        Oberfläche (HTML, CSS, JavaScript-Module, kein Build nötig)
api.php                    Einstiegspunkt der API
src/                       PHP-Code: Db, Schema, Auth, Router, Accounting, Stock, Payments, Api/*
tools/                     Betriebswerkzeuge (Sicherung, Mandant löschen)
tests/                     Testlauf (php tests/run.php)
config.sample.php          Vorlage für config.php
storage/                   SQLite-Datei und Sicherungen (von außen gesperrt)
```
