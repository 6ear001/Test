#!/bin/sh
# Startet das ERP lokal auf http://localhost:8080 (PHP muss installiert sein).
# "sh tools/start-local.sh demo" lädt zusätzlich Beispieldaten.
cd "$(dirname "$0")/.." || exit 1
command -v php >/dev/null 2>&1 || { echo "PHP wurde nicht gefunden (macOS: brew install php, Debian/Ubuntu: sudo apt install php-cli php-sqlite3 php-mbstring)."; exit 1; }
php -r 'exit(extension_loaded("pdo_sqlite") && extension_loaded("mbstring") ? 0 : 1);' || { echo "Es fehlen die PHP-Erweiterungen pdo_sqlite und/oder mbstring (Debian/Ubuntu: sudo apt install php-sqlite3 php-mbstring)."; exit 1; }
if [ "$1" = "demo" ]; then
  php -S localhost:8080 >/dev/null 2>&1 &
  server=$!
  trap 'kill $server 2>/dev/null' EXIT INT TERM
  sleep 1
  php tools/demo-data.php http://localhost:8080 || exit 1
  echo "Server läuft auf http://localhost:8080 – zum Beenden Strg+C drücken."
  wait $server
else
  echo "D-Group ERP läuft auf http://localhost:8080 – zum Beenden Strg+C drücken."
  echo "Beispieldaten laden: in einem zweiten Terminal 'php tools/demo-data.php'."
  exec php -S localhost:8080
fi
