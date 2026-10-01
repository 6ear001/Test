// D-Group Website: statische Dateien + kleine JSON-API, ohne externe Abhängigkeiten.
//
//   GET  /api/health    Lebenszeichen
//   GET  /api/site      Firmen- und Kontaktdaten, Preise der Pakete (data/site.json)
//   GET  /api/products  Demo-Artikel für die interaktive Kassen-Vorschau (data/products.json)
//   POST /api/contact   Beratungsanfrage (wird in data/requests.jsonl gespeichert)
import http from "node:http";
import { readFile, appendFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const gzipAsync = promisify(gzip);
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".svg", ".txt", ".xml"]);

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; " +
    "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const SHOP_TYPES = ["kiosk", "lebensmittel", "getraenke", "baeckerei", "einzelhandel", "sonstiges"];
const INTERESTS = ["kasse", "kasse-pda", "komplett", "unsicher"];

export function createApp(options = {}) {
  const publicDir = path.resolve(options.publicDir ?? path.join(ROOT, "public"));
  const dataDir = path.resolve(options.dataDir ?? path.join(ROOT, "data"));
  const cfg = {
    requestsFile: options.requestsFile ?? process.env.REQUESTS_FILE ?? path.join(dataDir, "requests.jsonl"),
    // Nur nötig, wenn die HTML-Dateien auf einer anderen Domain liegen als die API (z. B. Strato).
    allowedOrigin: options.allowedOrigin ?? process.env.ALLOWED_ORIGIN ?? "",
    trustProxy: options.trustProxy ?? process.env.TRUST_PROXY === "1",
    // Optional: Slack-/Discord-/Mattermost-kompatibler Webhook für Benachrichtigungen.
    webhookUrl: options.webhookUrl ?? process.env.NOTIFY_WEBHOOK_URL ?? "",
    rate: { max: 5, windowMs: 10 * 60 * 1000, ...options.rate },
  };

  const hits = new Map(); // IP -> Zeitstempel (nur im Arbeitsspeicher, es werden keine IPs gespeichert)
  const gzipCache = new Map();

  function sendJson(res, status, body, headers = {}) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(payload);
  }

  function clientIp(req) {
    if (cfg.trustProxy) {
      const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
      if (fwd) return fwd;
    }
    return req.socket.remoteAddress || "unknown";
  }

  function rateLimited(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < cfg.rate.windowMs);
    if (recent.length >= cfg.rate.max) {
      hits.set(ip, recent);
      return true;
    }
    recent.push(now);
    hits.set(ip, recent);
    return false;
  }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, list] of hits) {
      if (list.every((t) => now - t >= cfg.rate.windowMs)) hits.delete(ip);
    }
  }, 60_000);
  sweep.unref();

  function readJsonBody(req, limit = 16 * 1024) {
    return new Promise((resolve, reject) => {
      if (!String(req.headers["content-type"] || "").includes("application/json")) {
        return reject({ status: 415, message: "Content-Type muss application/json sein." });
      }
      let size = 0;
      let tooLarge = false;
      const chunks = [];
      req.on("data", (chunk) => {
        if (tooLarge) return; // Rest verwerfen, damit die Antwort sauber beim Client ankommt
        size += chunk.length;
        if (size > limit) {
          tooLarge = true;
          chunks.length = 0;
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        if (tooLarge) return reject({ status: 413, message: "Anfrage zu groß." });
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject({ status: 400, message: "Ungültiges JSON." });
        }
      });
      req.on("error", () => reject({ status: 400, message: "Anfrage abgebrochen." }));
    });
  }

  const text = (value, max) =>
    typeof value === "string"
      ? value.replace(/[^\S\n]+/g, " ").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim().slice(0, max)
      : "";

  function validateContact(body) {
    const errors = {};
    const data = {
      name: text(body.name, 100),
      contact: text(body.contact, 150),
      shopType: text(body.shopType, 30),
      interest: text(body.interest, 30),
      message: text(body.message, 2000),
    };

    if (data.name.length < 2) errors.name = "Bitte geben Sie Ihren Namen an.";

    const digits = data.contact.replace(/\D/g, "");
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.contact);
    const isPhone = /^\+?[\d\s()\-./]{6,25}$/.test(data.contact) && digits.length >= 6;
    if (!isEmail && !isPhone) errors.contact = "Bitte geben Sie eine gültige E-Mail-Adresse oder Telefonnummer an.";

    if (data.shopType && !SHOP_TYPES.includes(data.shopType)) errors.shopType = "Ungültige Auswahl.";
    if (!INTERESTS.includes(data.interest)) data.interest = "unsicher";
    if (body.consent !== true) errors.consent = "Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.";

    return { data, errors, kind: isEmail ? "email" : "phone" };
  }

  async function handleContact(req, res) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      return sendJson(res, err.status || 400, { ok: false, error: err.message || "Fehlerhafte Anfrage." });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(res, 400, { ok: false, error: "Ungültige Anfrage." });
    }

    // Honeypot: Menschen sehen das Feld nicht. Bots bekommen eine Scheinbestätigung.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return sendJson(res, 201, { ok: true, id: randomUUID() });
    }

    if (rateLimited(clientIp(req))) {
      return sendJson(
        res,
        429,
        { ok: false, error: "Zu viele Anfragen. Bitte versuchen Sie es in ein paar Minuten erneut." },
        { "Retry-After": String(Math.ceil(cfg.rate.windowMs / 1000)) },
      );
    }

    const { data, errors, kind } = validateContact(body);
    if (Object.keys(errors).length) return sendJson(res, 400, { ok: false, errors });

    const record = { id: randomUUID(), receivedAt: new Date().toISOString(), ...data, contactKind: kind };
    try {
      await mkdir(path.dirname(cfg.requestsFile), { recursive: true });
      await appendFile(cfg.requestsFile, JSON.stringify(record) + "\n", "utf8");
    } catch (err) {
      console.error("Anfrage konnte nicht gespeichert werden:", err);
      return sendJson(res, 500, { ok: false, error: "Ihre Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut." });
    }

    if (cfg.webhookUrl) notify(record);
    return sendJson(res, 201, { ok: true, id: record.id });
  }

  function notify(record) {
    const msg =
      `Neue Beratungsanfrage von ${record.name} (${record.contact})\n` +
      `Interesse: ${record.interest}${record.shopType ? ` · Geschäft: ${record.shopType}` : ""}` +
      (record.message ? `\n${record.message}` : "");
    fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg, content: msg }),
      signal: AbortSignal.timeout(5000),
    }).catch((err) => console.error("Webhook fehlgeschlagen:", err.message));
  }

  async function serveDataFile(res, file, maxAge) {
    try {
      const json = JSON.parse(await readFile(path.join(dataDir, file), "utf8"));
      sendJson(res, 200, json, { "Cache-Control": `public, max-age=${maxAge}` });
    } catch (err) {
      console.error(`${file} nicht lesbar:`, err.message);
      sendJson(res, 500, { ok: false, error: "Daten momentan nicht verfügbar." });
    }
  }

  async function handleApi(req, res, pathname) {
    if (cfg.allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", cfg.allowedOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
    }

    const routes = {
      "/api/health": { GET: () => sendJson(res, 200, { status: "ok", time: new Date().toISOString() }) },
      "/api/site": { GET: () => serveDataFile(res, "site.json", 60) },
      "/api/products": { GET: () => serveDataFile(res, "products.json", 300) },
      "/api/contact": { POST: () => handleContact(req, res) },
    };
    const route = routes[pathname];
    if (!route) return sendJson(res, 404, { ok: false, error: "Nicht gefunden." });
    const handler = route[req.method] || (req.method === "HEAD" && route.GET);
    if (!handler) {
      return sendJson(res, 405, { ok: false, error: "Methode nicht erlaubt." }, { Allow: Object.keys(route).join(", ") });
    }
    return handler();
  }

  async function serveStatic(req, res, pathname) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }

    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      res.writeHead(400);
      return res.end("Bad Request");
    }
    if (rel.includes("\0")) {
      res.writeHead(400);
      return res.end("Bad Request");
    }

    let file = path.resolve(publicDir, "." + rel);
    if (file !== publicDir && !file.startsWith(publicDir + path.sep)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = path.join(file, "index.html");
      info = await stat(file).catch(() => null);
    }
    if (!info) return sendNotFound(req, res);

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const cache =
      ext === ".html" ? "no-cache" : ext === ".woff2" ? "public, max-age=31536000, immutable" : "public, max-age=86400";

    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, { ETag: etag, "Cache-Control": cache });
      return res.end();
    }

    const headers = { "Content-Type": type, ETag: etag, "Cache-Control": cache, Vary: "Accept-Encoding" };
    const wantsGzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));

    if (wantsGzip) {
      let entry = gzipCache.get(file);
      if (!entry || entry.etag !== etag) {
        entry = { etag, buf: await gzipAsync(await readFile(file)) };
        gzipCache.set(file, entry);
      }
      res.writeHead(200, { ...headers, "Content-Encoding": "gzip", "Content-Length": entry.buf.length });
      return res.end(req.method === "HEAD" ? undefined : entry.buf);
    }

    res.writeHead(200, { ...headers, "Content-Length": info.size });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  }

  async function sendNotFound(req, res) {
    try {
      const page = await readFile(path.join(publicDir, "404.html"));
      res.writeHead(404, { "Content-Type": MIME[".html"], "Cache-Control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : page);
    } catch {
      res.writeHead(404, { "Content-Type": MIME[".txt"] });
      res.end("Seite nicht gefunden");
    }
  }

  return http.createServer(async (req, res) => {
    try {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
      if (!req.url || !req.url.startsWith("/") || req.url.startsWith("//")) {
        res.writeHead(400);
        return res.end("Bad Request");
      }
      const pathname = req.url.split("?")[0];
      if (pathname.startsWith("/api/")) return await handleApi(req, res, pathname);
      return await serveStatic(req, res, pathname);
    } catch (err) {
      console.error("Unerwarteter Fehler:", err);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: "Interner Fehler." });
      else res.end();
    }
  });
}

// Direkter Start: `node server.js`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "0.0.0.0";
  createApp().listen(port, host, () => console.log(`D-Group Website läuft auf http://localhost:${port}`));
}
