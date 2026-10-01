import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server.js";

let server, base, tmp, requestsFile;

before(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), "dgroup-"));
  requestsFile = path.join(tmp, "requests.jsonl");
  server = createApp({ requestsFile, rate: { max: 100, windowMs: 60_000 } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmp, { recursive: true, force: true });
});

const post = (body, headers = {}) =>
  fetch(`${base}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const valid = { name: "Max Mustermann", contact: "max@example.de", interest: "kasse-pda", consent: true };

test("health", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "ok");
});

test("site liefert Name und Pakete", async () => {
  const body = await (await fetch(`${base}/api/site`)).json();
  assert.equal(body.name, "D-Group IT Solutions");
  assert.deepEqual(Object.keys(body.packages).sort(), ["kasse", "kasse-pda", "komplett"]);
});

test("products: Artikel haben Preis, Steuersatz und bekannte Kategorie", async () => {
  const { items, categories } = await (await fetch(`${base}/api/products`)).json();
  const ids = new Set(categories.map((c) => c.id));
  assert.ok(items.length >= 8);
  for (const item of items) {
    assert.ok(item.price > 0, item.id);
    assert.ok([7, 19].includes(item.vat), item.id);
    assert.ok(ids.has(item.category), item.id);
  }
});

test("unbekannte API-Route und falsche Methode", async () => {
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  const res = await fetch(`${base}/api/contact`);
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "POST");
});

test("contact: Validierung meldet Fehler pro Feld", async () => {
  const res = await post({ name: "M", contact: "kein-kontakt", consent: false });
  assert.equal(res.status, 400);
  const { errors } = await res.json();
  assert.ok(errors.name && errors.contact && errors.consent);
});

test("contact: falscher Content-Type und kaputtes JSON", async () => {
  assert.equal((await post("x", { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await post("{kaputt")).status, 400);
});

test("contact: zu große Anfrage wird mit 413 abgelehnt", async () => {
  const res = await post({ ...valid, message: "x".repeat(20_000) });
  assert.equal(res.status, 413);
});

test("contact: Honeypot wird still verworfen", async () => {
  const res = await post({ ...valid, website: "http://spam.example" });
  assert.equal(res.status, 201);
  await assert.rejects(readFile(requestsFile, "utf8"), { code: "ENOENT" });
});

test("contact: gültige Anfrage wird gespeichert", async () => {
  const ok = await post({ ...valid, message: "Bitte  um\nRückruf" });
  assert.equal(ok.status, 201);
  const { id } = await ok.json();

  const lines = (await readFile(requestsFile, "utf8")).trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, id);
  assert.equal(lines[0].contactKind, "email");
  assert.equal(lines[0].message, "Bitte um\nRückruf");

  assert.equal((await post({ ...valid, contact: "+49 151 2345678" })).status, 201);
});

test("contact: Rate-Limit greift nach zu vielen Anfragen", async () => {
  const limited = createApp({ requestsFile: path.join(tmp, "limited.jsonl"), rate: { max: 3, windowMs: 60_000 } });
  await new Promise((resolve) => limited.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${limited.address().port}/api/contact`;
  const send = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valid) });
  try {
    for (let i = 0; i < 3; i++) assert.equal((await send()).status, 201);
    const res = await send();
    assert.equal(res.status, 429);
    assert.ok(res.headers.get("retry-after"));
  } finally {
    await new Promise((resolve) => limited.close(resolve));
  }
});

test("static: Startseite, Sicherheits-Header, 404 und Pfad-Traversal", async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /text\/html/);
  assert.match(home.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");

  assert.equal((await fetch(`${base}/gibt-es-nicht`)).status, 404);

  // fetch normalisiert "..", deshalb mit rohem Socket testen
  const { request } = await import("node:http");
  const status = await new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: server.address().port, path: "/..%2f..%2fserver.js" }, (r) => {
      r.resume();
      resolve(r.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  assert.ok([403, 404].includes(status), `Status war ${status}`);
});
