// Baut das Upload-Paket für klassisches Webhosting (IONOS): dist/ionos/ und dist/d-group-ionos.zip
// Aufruf: npm run build:ionos
import { cpSync, rmSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "ionos");
const zip = path.join(root, "dist", "d-group-ionos.zip");

rmSync(path.join(root, "dist"), { recursive: true, force: true });
mkdirSync(path.join(out, "api-data"), { recursive: true });

cpSync(path.join(root, "public"), out, { recursive: true }); // Seite
cpSync(path.join(root, "ionos", "api"), path.join(out, "api"), { recursive: true }); // PHP-API
copyFileSync(path.join(root, "ionos", ".htaccess"), path.join(out, ".htaccess"));
for (const f of [".htaccess", "config.php"]) copyFileSync(path.join(root, "ionos", "api-data", f), path.join(out, "api-data", f));
for (const f of ["site.json", "products.json"]) copyFileSync(path.join(root, "data", f), path.join(out, "api-data", f)); // gleiche Daten wie beim Node-Server

try {
  // Inhalt direkt im ZIP-Wurzelverzeichnis (nicht in einem Unterordner), inkl. versteckter Dateien wie .htaccess
  execFileSync("zip", ["-r", "-q", zip, "."], { cwd: out });
  console.log(`Fertig: ${path.relative(root, zip)}`);
} catch {
  console.log(`Ordner fertig: ${path.relative(root, out)} – bitte den Inhalt per FTP hochladen oder selbst zippen (kein 'zip' gefunden).`);
}
if (existsSync(out)) console.log(`Inhalt: ${path.relative(root, out)}/`);
