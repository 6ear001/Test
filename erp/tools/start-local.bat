@echo off
rem Startet das ERP lokal auf http://localhost:8080 (PHP muss installiert sein). Mit "start-local.bat demo" werden Beispieldaten geladen.
chcp 65001 >nul
cd /d "%~dp0.."
where php >nul 2>nul
if errorlevel 1 (
  echo PHP wurde nicht gefunden. Bitte PHP installieren ^(https://windows.php.net/download^) und den PHP-Ordner zum PATH hinzufuegen,
  echo oder XAMPP verwenden. Details: README.md, Abschnitt "Lokal testen".
  pause
  exit /b 1
)
php -r "exit(extension_loaded('pdo_sqlite') && extension_loaded('mbstring') ? 0 : 1);"
if errorlevel 1 (
  echo In der php.ini muessen diese Zeilen aktiv sein ^(Semikolon am Zeilenanfang entfernen^):
  echo   extension=pdo_sqlite
  echo   extension=sqlite3
  echo   extension=mbstring
  pause
  exit /b 1
)
if /i "%~1"=="demo" (
  start "D-Group ERP Server" php -S localhost:8080
  timeout /t 2 /nobreak >nul
  php tools\demo-data.php http://localhost:8080
  start "" "http://localhost:8080"
  echo.
  echo Der Server laeuft im zweiten Fenster. Zum Beenden dieses zweite Fenster schliessen.
  pause
  exit /b 0
)
echo.
echo D-Group ERP laeuft auf http://localhost:8080
echo Beispieldaten laden: in einem zweiten Fenster "php tools\demo-data.php" ausfuehren.
echo Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
echo.
start "" "http://localhost:8080"
php -S localhost:8080
