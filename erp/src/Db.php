<?php
declare(strict_types=1);

namespace Erp;

use PDO;
use Throwable;

/**
 * Datenbankzugriff über PDO. Läuft mit SQLite (keine Einrichtung nötig) und MySQL/MariaDB (üblich bei Strato/IONOS).
 * Alle Geschäftstabellen tragen tenant_id (Mandant); Beträge sind ganze Cent-Werte.
 */
final class Db
{
    private static ?Db $inst = null;
    public PDO $pdo;
    public string $driver;
    private int $depth = 0;

    public static function conn(): Db
    {
        if (self::$inst === null) {
            self::$inst = new self(erp_config()['db']);
        }
        return self::$inst;
    }

    public function __construct(array $cfg)
    {
        $this->driver = $cfg['driver'] === 'mysql' ? 'mysql' : 'sqlite';
        $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
        if ($this->driver === 'mysql') {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['host'] ?? 'localhost', (int) ($cfg['port'] ?? 3306), $cfg['name'] ?? '');
            $this->pdo = new PDO($dsn, $cfg['user'] ?? '', $cfg['pass'] ?? '', $opts);
            $this->pdo->exec("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION', time_zone = '+00:00'");
        } else {
            $path = (string) ($cfg['path'] ?? ':memory:');
            if ($path !== ':memory:' && !is_dir(dirname($path))) {
                mkdir(dirname($path), 0775, true);
            }
            $this->pdo = new PDO('sqlite:' . $path, null, null, $opts);
            $this->pdo->exec('PRAGMA busy_timeout = 8000');
            if (!empty($cfg['wal'])) {
                $this->pdo->exec('PRAGMA journal_mode = WAL');
            }
        }
        $this->ensureSchema();
    }

    public function isMysql(): bool { return $this->driver === 'mysql'; }

    private function exec(string $sql, array $p): \PDOStatement
    {
        // Suchmuster werden mit "!" maskiert (siehe like() in Util.php); das gilt in SQLite und MySQL gleich
        if (str_contains($sql, 'LIKE ?')) $sql = preg_replace("/LIKE \\?(?! ESCAPE)/", "LIKE ? ESCAPE '!'", $sql);
        $st = $this->pdo->prepare($sql);
        $i = 1;
        foreach ($p as $v) {
            if (is_bool($v)) $v = (int) $v;
            $type = is_int($v) ? PDO::PARAM_INT : (is_null($v) ? PDO::PARAM_NULL : PDO::PARAM_STR);
            if (is_float($v)) $v = rtrim(rtrim(number_format($v, 6, '.', ''), '0'), '.');
            $st->bindValue($i++, $v, $type);
        }
        $st->execute();
        return $st;
    }
    public function run(string $sql, array $p = []): int { return $this->exec($sql, $p)->rowCount(); }
    public function get(string $sql, array $p = []): ?array
    {
        $r = $this->exec($sql, $p)->fetch();
        return $r === false ? null : $r;
    }
    public function all(string $sql, array $p = []): array { return $this->exec($sql, $p)->fetchAll(); }
    /** Erste Spalte der ersten Zeile (oder $def). */
    public function val(string $sql, array $p = [], $def = null)
    {
        $r = $this->exec($sql, $p)->fetch(PDO::FETCH_NUM);
        return $r === false ? $def : $r[0];
    }
    /** Fügt eine Zeile ein. Spaltennamen stammen nur aus dem Programmcode, nie aus Benutzereingaben. */
    public function insert(string $table, array $row): int
    {
        $keys = array_keys($row);
        $this->run("INSERT INTO $table (" . implode(',', $keys) . ') VALUES (' . implode(',', array_fill(0, count($keys), '?')) . ')', array_values($row));
        return (int) $this->pdo->lastInsertId();
    }
    public function insertIgnore(string $table, array $row): void
    {
        $keys = array_keys($row);
        $verb = $this->isMysql() ? 'INSERT IGNORE' : 'INSERT OR IGNORE';
        $this->run("$verb INTO $table (" . implode(',', $keys) . ') VALUES (' . implode(',', array_fill(0, count($keys), '?')) . ')', array_values($row));
    }
    public function update(string $table, int $tenantId, int $id, array $row): void
    {
        if (!$row) return;
        $set = implode(', ', array_map(fn($k) => "$k = ?", array_keys($row)));
        $this->run("UPDATE $table SET $set WHERE tenant_id = ? AND id = ?", [...array_values($row), $tenantId, $id]);
    }
    /** Zeilensperre bei MySQL (SQLite sperrt bereits die ganze Datei in der Transaktion). */
    public function forUpdate(): string { return $this->isMysql() ? ' FOR UPDATE' : ''; }

    /** Transaktion; verschachtelt über SAVEPOINT. Bei einem Fehler wird alles zurückgerollt. */
    public function tx(callable $fn)
    {
        if ($this->depth > 0) {
            $name = 'sp' . $this->depth;
            $this->pdo->exec("SAVEPOINT $name");
            $this->depth++;
            try {
                $r = $fn();
                $this->pdo->exec("RELEASE SAVEPOINT $name");
                return $r;
            } catch (Throwable $e) {
                $this->pdo->exec("ROLLBACK TO SAVEPOINT $name");
                $this->pdo->exec("RELEASE SAVEPOINT $name");
                throw $e;
            } finally {
                $this->depth--;
            }
        }
        $this->pdo->exec($this->isMysql() ? 'START TRANSACTION' : 'BEGIN IMMEDIATE');
        $this->depth = 1;
        try {
            $r = $fn();
            $this->pdo->exec('COMMIT');
            return $r;
        } catch (Throwable $e) {
            try { $this->pdo->exec('ROLLBACK'); } catch (Throwable) {}
            throw $e;
        } finally {
            $this->depth = 0;
        }
    }

    private function ensureSchema(): void
    {
        try {
            $this->pdo->query('SELECT 1 FROM tenants LIMIT 1')->fetch();
            return;
        } catch (Throwable) {
            // Tabellen fehlen noch: Erstinstallation
        }
        foreach (Schema::statements($this->isMysql()) as $sql) {
            $this->pdo->exec($sql);
        }
    }
}
