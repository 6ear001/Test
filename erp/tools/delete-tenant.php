<?php
declare(strict_types=1);

/**
 * Löscht einen Mandanten samt aller Daten endgültig (z. B. auf Kundenwunsch nach Art. 17 DSGVO):
 *   php tools/delete-tenant.php <Mandanten-ID> --yes
 * Vorher unbedingt eine Sicherung erstellen (tools/backup.php).
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/src/bootstrap.php';

$id = (int) ($argv[1] ?? 0);
if ($id < 1) { fwrite(STDERR, "Aufruf: php tools/delete-tenant.php <Mandanten-ID> --yes\n"); exit(2); }
$db = Erp\Db::conn();
$t = $db->get('SELECT id, name FROM tenants WHERE id = ?', [$id]);
if (!$t) { fwrite(STDERR, "Mandant $id gibt es nicht.\n"); exit(1); }
if (!in_array('--yes', $argv, true)) { fwrite(STDERR, "Mandant {$t['id']} „{$t['name']}“ würde mit ALLEN Daten gelöscht. Zur Bestätigung --yes anhängen.\n"); exit(2); }
$db->tx(function () use ($db, $id) {
    foreach (Erp\Schema::tenantTables() as $table) $db->run("DELETE FROM $table WHERE tenant_id = ?", [$id]);
    $db->run('DELETE FROM tenants WHERE id = ?', [$id]);
});
echo "Mandant $id gelöscht.\n";
