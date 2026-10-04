// Studio-Renderer: 4K (2160×3840), Bewegungsunschärfe durch Sub-Frame-Mittelung (180°-Verschluss), Sprachspur + Musik + Effekte.
//   node render-pro.mjs b2 --voice audio/voice-b2.mp3 [--scale 2] [--sub 4] [--workers 2] [--bench 8] [--audio-only] [--range 0-870]
// Ergebnis: out/video-<ad>-4k.mp4 (Master) und out/video-<ad>-1080.mp4 (runterskaliert, überall abspielbar)
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const ad = argv[0] || "b2";
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true); };
const SCALE = Number(opt("scale", 2)), SUB = Number(opt("sub", 4)), WORKERS = Number(opt("workers", 2)), SHUTTER = Number(opt("shutter", 0.5)), FPS = 30;
const VOICE = path.resolve(ROOT, opt("voice", "audio/voice-b2.mp3"));
const CRF = String(opt("crf", 17));
const W = 1080 * SCALE, H = 1920 * SCALE;
const OUT = path.join(ROOT, "out");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  try { const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname)); if (!file.startsWith(ROOT)) throw 0; const buf = await readFile(file); res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }); res.end(buf); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const sh = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: "inherit" }); if (r.status !== 0) throw new Error(`${cmd} fehlgeschlagen`); };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: SCALE });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.goto(`http://localhost:${port}/src/index.html?ad=${ad}`);
  await page.waitForFunction("window.ready === true", null, { timeout: 30000 });
  return page;
}

const browser0 = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const probe = await openPage(browser0);
const { duration, sfx } = await probe.evaluate(() => ({ duration: window.DURATION, sfx: window.SFX }));

// ---------- Benchmark ----------
if (opt("bench", false)) {
  const n = Number(opt("bench", 8)); const times = [];
  for (let i = 0; i < n; i++) { const t = 3 + i * 0.37; const a = Date.now(); await probe.evaluate((t) => window.render(t), t); await probe.screenshot({ type: "jpeg", quality: 92 }); times.push(Date.now() - a); }
  console.log(`${W}×${H}: ${times.join(" ms, ")} ms → Ø ${Math.round(times.reduce((a, b) => a + b) / n)} ms je Aufnahme`);
  await browser0.close(); server.close(); process.exit(0);
}
await probe.close();

// ---------- Ton ----------
await mkdir(OUT, { recursive: true });
const jsonPath = path.join(OUT, `sfx-${ad}.json`), sfxWav = path.join(OUT, `sfx-${ad}.wav`), musWav = path.join(OUT, `music-${ad}.wav`), mixAudio = path.join(OUT, `mix-${ad}.m4a`);
await writeFile(jsonPath, JSON.stringify({ duration, sfx, music_from: 8.4 }));
sh("python3", [path.join(ROOT, "tools", "make-audio.py"), jsonPath, sfxWav, "--music", musWav]);
// Sprache: Rumpel raus, leicht komprimieren, auf -16 LUFS; Musik wird per Sidechain unter der Stimme abgesenkt.
const fc = [
  `[0:a]highpass=f=75,acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=2,loudnorm=I=-15:TP=-1.5:LRA=7,apad=whole_dur=${duration},atrim=0:${duration},asetpts=N/SR/TB,aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[v][vk]`,
  `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.62[m0]`,
  `[m0][vk]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=420:makeup=1[m]`,
  `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.55[s]`,
  `[v][m][s]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.92:level=0,atrim=0:${duration}[a]`,
].join(";");
sh("ffmpeg", ["-v", "error", "-y", "-i", VOICE, "-i", musWav, "-i", sfxWav, "-filter_complex", fc, "-map", "[a]", "-c:a", "aac", "-b:a", "256k", mixAudio]);
log("Ton fertig", mixAudio);
if (opt("audio-only", false)) { await browser0.close(); server.close(); process.exit(0); }

// ---------- Bilder ----------
const total = Math.round(duration * FPS);
const [r0, r1] = String(opt("range", `0-${total}`)).split("-").map(Number);
const per = Math.ceil((r1 - r0) / WORKERS);
const chunks = Array.from({ length: WORKERS }, (_, i) => ({ i, a: r0 + i * per, b: Math.min(r1, r0 + (i + 1) * per), file: path.join(OUT, `chunk-${ad}-${i}.mp4`) })).filter((c) => c.a < c.b);
let done = 0; const t0 = Date.now();
async function work(c) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await openPage(browser);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS * SUB), "-c:v", "mjpeg", "-i", "-",
    "-vf", `scale=in_range=full:in_color_matrix=bt601:out_range=limited:out_color_matrix=bt709,tmix=frames=${SUB},select='not(mod(n+1\\,${SUB}))',setpts=PTS-STARTPTS,format=yuv420p`,
    "-r", String(FPS), "-fps_mode", "cfr", "-c:v", "libx264", "-preset", "fast", "-crf", CRF, "-profile:v", "high", "-level", "5.1", "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-x264-params", "keyint=60:min-keyint=30:scenecut=0", "-movflags", "+faststart", c.file], { stdio: ["pipe", "inherit", "inherit"] });
  for (let f = c.a; f < c.b; f++) {
    for (let k = 0; k < SUB; k++) {
      const t = Math.max(0, (f + ((k + 0.5) / SUB - 0.5) * SHUTTER) / FPS);
      await page.evaluate((t) => window.render(t), t);
      const buf = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    }
    done++; if (done % 30 === 0) { const el = (Date.now() - t0) / 1000; log(`Bild ${done}/${r1 - r0}  (${Math.round(el)} s, Rest ≈ ${Math.round(el / done * (r1 - r0 - done))} s)`); }
  }
  ff.stdin.end(); await new Promise((r) => ff.on("close", r)); await browser.close();
}
await browser0.close();
await Promise.all(chunks.map(work));
server.close();

// ---------- Zusammensetzen ----------
const list = path.join(OUT, `chunks-${ad}.txt`);
await writeFile(list, chunks.map((c) => `file '${c.file}'`).join("\n"));
const master = path.join(OUT, `video-${ad}-4k.mp4`), small = path.join(OUT, `video-${ad}-1080.mp4`);
sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-i", mixAudio, "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart", master]);
sh("ffmpeg", ["-v", "error", "-y", "-i", master, "-vf", "scale=1080:1920:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-c:a", "copy", "-movflags", "+faststart", small]);
for (const c of chunks) await rm(c.file, { force: true });
log("fertig:", master, small);
