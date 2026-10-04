// Rendert ein Video Bild für Bild (Chromium) und setzt es mit der Tonspur zu einer MP4 zusammen.
//   node render.mjs a|b [Breite]   → out/video-<a|b>.mp4   (Standard 1080×1920, 30 Bilder/s)
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ad = process.argv[2] || "a";
const width = Number(process.argv[3] || 1080), height = Math.round(width * 16 / 9);
const FPS = 30;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  try { const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (!file.startsWith(ROOT)) throw 0; const buf = await readFile(file); res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }); res.end(buf); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: width / 1080 });
await page.goto(`http://localhost:${port}/src/index.html?ad=${ad}`);
await page.waitForFunction("window.ready === true", null, { timeout: 20000 });
const { duration, sfx } = await page.evaluate(() => ({ duration: window.DURATION, sfx: window.SFX }));
await mkdir(path.join(ROOT, "out"), { recursive: true });
const jsonPath = path.join(ROOT, "out", `sfx-${ad}.json`), wav = path.join(ROOT, "out", `audio-${ad}.wav`), mp4 = path.join(ROOT, "out", `video-${ad}.mp4`);
await writeFile(jsonPath, JSON.stringify({ duration, sfx, music_from: ad === "a" ? 8.6 : 8.4 }));
const py = spawnSync("python3", [path.join(ROOT, "tools", "make-audio.py"), jsonPath, wav], { stdio: "inherit" });
if (py.status !== 0) throw new Error("Tonspur konnte nicht erzeugt werden (python3 + numpy nötig)");
const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", mp4], { stdio: ["pipe", "inherit", "inherit"] });
const total = Math.round(duration * FPS), t0 = Date.now();
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.render(t), f / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 94 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 60 === 0) console.log(`Bild ${f}/${total} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close(); server.close();
console.log("fertig:", mp4);
