// Tests für die PHP-Variante der API (IONOS-Paket). Wird übersprungen, wenn PHP nicht installiert ist.
// Baut das Paket, startet PHPs eingebauten Server und prüft dieselben Regeln wie test/api.test.js.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hasPhp = spawnSync("php", ["-v"]).status === 0;

if (!hasPhp) {
  test("PHP-API (übersprungen: php nicht installiert)", { skip: true }, () => {});
} else {
  let php, base, site;

  before(async () => {
    execFileSync(process.execPath, [path.join(root, "scripts", "build-ionos.mjs")], { stdio: "ignore" });
    site = mkdtempSync(path.join(tmpdir(), "dgroup-php-"));
    cpSync(path.join(root, "dist", "ionos"), site, { recursive: true });

    // Kleineres Rate-Limit, damit der Test schnell ist
    const cfg = path.join(site, "api-data", "config.php");
    writeFileSync(cfg, readFileSync(cfg, "utf8").replace("'rateMax' => 5", "'rateMax' => 3"));

    // Ersetzt die Rewrite-Regel der .htaccess für PHPs eingebauten Server
    writeFileSync(
      path.join(site, "router.php"),
      `<?php
$p = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api/(health|site|products|contact)/?$#', $p, $m)) { $_GET['route'] = $m[1]; require __DIR__ . '/api/index.php'; return true; }
return false;`,
    );

    const port = 20000 + Math.floor(Math.random() * 20000);
    php = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", site, path.join(site, "router.php")], { stdio: "ignore" });
    base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) return;
      } catch {
        /* Server startet noch */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("PHP-Server startete nicht");
  });

  after(() => {
    php?.kill();
    if (site) rmSync(site, { recursive: true, force: true });
  });

  const post = (body, headers = {}) =>
    fetch(`${base}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  const valid = { name: "Max Mustermann", contact: "max@example.de", interest: "kasse-pda", consent: true };

  test("PHP: health, site und products", async () => {
    assert.equal((await (await fetch(`${base}/api/health`)).json()).status, "ok");
    assert.equal((await (await fetch(`${base}/api/site`)).json()).name, "D-Group IT Solutions");
    assert.ok((await (await fetch(`${base}/api/products`)).json()).items.length >= 8);
  });

  test("PHP: unbekannte Route 404, falsche Methode 405 mit Allow", async () => {
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
    const res = await fetch(`${base}/api/contact`);
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("allow"), "POST");
  });

  test("PHP: Content-Type, JSON, Größe und Validierung", async () => {
    assert.equal((await post("x", { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await post("{kaputt")).status, 400);
    assert.equal((await post("[1,2]")).status, 400);
    assert.equal((await post({ ...valid, message: "x".repeat(20_000) })).status, 413);
    const res = await post({ name: "M", contact: "kein-kontakt", consent: false });
    assert.equal(res.status, 400);
    const { errors } = await res.json();
    assert.ok(errors.name && errors.contact && errors.consent);
  });

  test("PHP: Honeypot wird verworfen und nichts gespeichert", async () => {
    const res = await post({ ...valid, website: "http://spam.example" });
    assert.equal(res.status, 201);
    assert.equal(existsSync(path.join(site, "api-data", "requests.php")), false);
  });

  test("PHP: Anfrage wird mit Schutzzeile gespeichert, danach greift das Rate-Limit", async () => {
    // Zähler der bisherigen Tests zurücksetzen
    rmSync(path.join(site, "api-data", "rate"), { recursive: true, force: true });

    const ok = await post({ ...valid, message: "Bitte  um\nRückruf" });
    assert.equal(ok.status, 201);
    const { id } = await ok.json();

    const lines = readFileSync(path.join(site, "api-data", "requests.php"), "utf8").trim().split("\n");
    assert.equal(lines[0], "<?php http_response_code(404); exit; ?>");
    const record = JSON.parse(lines[1]);
    assert.equal(record.id, id);
    assert.equal(record.contactKind, "email");
    assert.equal(record.message, "Bitte um\nRückruf");

    assert.equal((await post({ ...valid, contact: "+49 151 2345678" })).status, 201);
    assert.equal((await post(valid)).status, 201);
    const limited = await post(valid);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "600");
  });
}
