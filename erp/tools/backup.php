<?php
declare(strict_types=1);

/**
 * Sicherung der Datenbank (SQLite): php tools/backup.php [Zielordner]
 * Erzeugt eine vollständige, konsistente Kopie, auch während der Betrieb läuft.
 * Bei MySQL/MariaDB bitte mysqldump bzw. die Datensicherung im Strato-/IONOS-Kundenbereich nutzen.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/src/bootstrap.php';

$cfg = erp_config()['db'];
if (($cfg['driver'] ?? 'sqlite') !== 'sqlite') {
    fwrite(STDERR, "Die Datenbank ist MySQL/MariaDB. Bitte mysqldump verwenden, z. B.:\n  mysqldump -h HOST -u BENUTZER -p DATENBANK > erp-sicherung.sql\n");
    exit(2);
}
$dir = $argv[1] ?? dirname(__DIR__) . '/storage/backups';
if (!is_dir($dir) && !mkdir($dir, 0770, true)) { fwrite(STDERR, "Ordner nicht anlegbar: $dir\n"); exit(1); }
$target = rtrim($dir, '/') . '/erp-' . date('Ymd-His') . '.sqlite';
Erp\Db::conn()->pdo->exec("VACUUM INTO '" . str_replace("'", "''", $target) . "'");
echo "Sicherung erstellt: $target (" . number_format((int) filesize($target) / 1024, 0, ',', '.') . " KB)\n";
// Alte Sicherungen (älter als 30 Tage) aufräumen
foreach (glob($dir . '/erp-*.sqlite') ?: [] as $f) if (filemtime($f) < time() - 30 * 86400) @unlink($f);
