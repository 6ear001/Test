<?php
declare(strict_types=1);

namespace Erp\Api;

use Erp\{Accounting, Auth, Ctx, Db, Router};
use function Erp\{audit, bad, can, conflict, forbidden, get_settings, not_found, perms_of, roles, save_settings, today, vdate, vemail, vint, vstr};
use const Erp\PLANS as PLAN_LIST;

/** Registrierung, Anmeldung, Firmendaten, Benutzer, Tarif, Protokoll, Betreiber-Konsole. */
final class AuthApi
{
    private const DUMMY_HASH = '$2y$10$qOx8KklKVQQRsjmyFjLzSeFMiP59C8Um6V0hOFnYpz9TobDBnI8b.';

    public static function me(Db $db, array $u): array
    {
        $plan = PLAN_LIST[$u['plan']] ?? PLAN_LIST['starter'];
        return [
            'user' => ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role'], 'role_label' => roles()[$u['role']]['label'] ?? $u['role']],
            'tenant' => ['id' => $u['tenant_id'], 'name' => $u['tenant_name'], 'plan' => $u['plan'], 'plan_label' => $plan['label']],
            'perms' => perms_of($u['role']),
        ];
    }

    public static function register(Router $r): void
    {
        // ----- Öffentlich: Registrierung und Anmeldung -----
        $r->post('/auth/signup', null, function (Ctx $c) {
            $cfg = \erp_config();
            if (!$cfg['allow_signup']) throw forbidden('Die Registrierung ist deaktiviert.');
            $ip = Auth::clientIp();
            [$max, $win] = $cfg['signup_limit'];
            if (Auth::limited($c->db, "signup:$ip", (int) $max, (int) $win)) throw new \Erp\HttpError(429, 'Zu viele Registrierungen. Bitte später erneut versuchen.');
            $company = vstr($c->body, 'company', 'Firmenname', 200, true);
            $name = vstr($c->body, 'name', 'Name', 160, true);
            $email = vemail($c->body) ?? throw bad('E-Mail fehlt');
            $pw = (string) ($c->body['password'] ?? '');
            if ($msg = Auth::policy($pw)) throw bad($msg);
            if ($c->db->get('SELECT id FROM users WHERE email = ?', [$email])) throw conflict('Diese E-Mail ist bereits registriert.');
            $hash = password_hash($pw, PASSWORD_DEFAULT);
            $user = $c->db->tx(function () use ($c, $company, $name, $email, $hash) {
                $tid = $c->db->insert('tenants', ['name' => $company, 'plan' => 'starter', 'settings' => json_encode(['company_name' => $company, 'email' => $email]), 'active' => 1]);
                Accounting::seedTenant($c->db, $tid);
                $uid = $c->db->insert('users', ['tenant_id' => $tid, 'email' => $email, 'name' => $name, 'password_hash' => $hash, 'role' => 'admin', 'active' => 1]);
                return $c->db->get('SELECT u.id, u.tenant_id, u.email, u.name, u.role, t.plan, t.name AS tenant_name FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ?', [$uid]);
            });
            Auth::start($c->db, $user);
            return self::me($c->db, $user);
        }, false);

        $r->post('/auth/login', null, function (Ctx $c) {
            $cfg = \erp_config();
            $email = strtolower((string) ($c->body['email'] ?? ''));
            $pw = (string) ($c->body['password'] ?? '');
            [$max, $win] = $cfg['login_limit'];
            $k1 = 'login-ip:' . Auth::clientIp();
            $k2 = 'login-mail:' . hash('sha256', $email);
            if (Auth::limited($c->db, $k1, (int) $max * 3, (int) $win) || Auth::limited($c->db, $k2, (int) $max, (int) $win)) {
                throw new \Erp\HttpError(429, 'Zu viele Anmeldeversuche. Bitte in ein paar Minuten erneut versuchen.');
            }
            $u = $c->db->get('SELECT u.id, u.tenant_id, u.email, u.name, u.role, u.password_hash, u.active, t.plan, t.name AS tenant_name, t.active AS tenant_active FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.email = ?', [$email]);
            $ok = password_verify($pw, $u['password_hash'] ?? self::DUMMY_HASH);
            if (!$u || !$ok || !(int) $u['active'] || !(int) $u['tenant_active']) throw new \Erp\HttpError(401, 'E-Mail oder Passwort ist falsch.');
            Auth::clearLimit($c->db, $k2);
            foreach (['id', 'tenant_id'] as $f) $u[$f] = (int) $u[$f];
            Auth::start($c->db, $u);
            return self::me($c->db, $u);
        }, false);

        $r->post('/auth/logout', 'auth', function (Ctx $c) {
            Auth::end($c->db);
            return ['ok' => true];
        }, false);
        // Öffentlich, damit die Oberfläche beim Start ohne Fehlermeldung prüfen kann, ob eine Sitzung besteht
        $r->get('/auth/me', null, function (Ctx $c) {
            $u = Auth::user($c->db);
            return $u ? self::me($c->db, $u) : ['user' => null];
        });

        $r->post('/auth/password', 'auth', function (Ctx $c) {
            $row = $c->db->get('SELECT password_hash FROM users WHERE id = ?', [$c->user['id']]);
            if (!password_verify((string) ($c->body['current'] ?? ''), $row['password_hash'])) throw bad('Das aktuelle Passwort ist falsch.');
            $new = (string) ($c->body['new'] ?? '');
            if ($msg = Auth::policy($new)) throw bad($msg);
            $c->db->run('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $c->user['id']]);
            Auth::endAllFor($c->db, $c->user['id']);
            Auth::start($c->db, $c->user);
            audit($c, 'user', $c->user['id'], 'password');
            return ['ok' => true];
        });

        // ----- Firmendaten: für Belege lesbar für alle, ändern nur Administratoren -----
        $r->get('/company', 'auth', function (Ctx $c) {
            $s = $c->settings();
            unset($s['books_closed_until']);
            return $s;
        });
        $r->get('/settings', 'admin:r', fn(Ctx $c) => $c->settings());
        $r->put('/settings', 'admin:w', function (Ctx $c) {
            $b = $c->body;
            $patch = [];
            foreach (['company_name' => 200, 'street' => 200, 'zip' => 20, 'city' => 120, 'country' => 2, 'email' => 190, 'phone' => 60, 'website' => 200, 'vat_id' => 30, 'tax_no' => 30, 'bic' => 20, 'bank_name' => 120, 'register' => 200, 'managing_director' => 200, 'doc_footer' => 600] as $k => $max) {
                if (array_key_exists($k, $b)) $patch[$k] = vstr($b, $k, $k, $max) ?? '';
            }
            if (array_key_exists('company_name', $patch) && $patch['company_name'] === '') throw bad('Firmenname fehlt');
            if (array_key_exists('email', $patch) && $patch['email'] !== '' && !filter_var($patch['email'], FILTER_VALIDATE_EMAIL)) throw bad('E-Mail ist ungültig');
            if (array_key_exists('iban', $b)) {
                $iban = strtoupper(preg_replace('/\s+/', '', (string) ($b['iban'] ?? '')));
                if ($iban !== '' && !preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/', $iban)) throw bad('IBAN ist ungültig');
                $patch['iban'] = $iban;
            }
            if (array_key_exists('payment_days', $b)) $patch['payment_days'] = vint($b, 'payment_days', 'Zahlungsziel', 0, 365, false, 14);
            if (array_key_exists('allow_negative_stock', $b)) $patch['allow_negative_stock'] = (bool) $b['allow_negative_stock'];
            if (array_key_exists('books_closed_until', $b)) $patch['books_closed_until'] = vdate($b, 'books_closed_until', 'Festschreibung bis');
            $next = save_settings($c->db, $c->tenantId, $patch);
            audit($c, 'settings', null, 'update', implode(',', array_keys($patch)));
            return $next;
        });

        // ----- Benutzer -----
        $r->get('/users', 'admin:r', function (Ctx $c) {
            $rows = $c->db->all('SELECT id, name, email, role, active, last_login, created_at FROM users WHERE tenant_id = ? ORDER BY name', [$c->tenantId]);
            return ['rows' => $rows, 'roles' => array_map(fn($k, $v) => ['key' => $k, 'label' => $v['label']], array_keys(roles()), roles())];
        });
        $r->post('/users', 'admin:w', function (Ctx $c) {
            $name = vstr($c->body, 'name', 'Name', 160, true);
            $email = vemail($c->body) ?? throw bad('E-Mail fehlt');
            $role = \Erp\voneof($c->body['role'] ?? '', array_keys(roles()), 'Rolle');
            $pw = (string) ($c->body['password'] ?? '');
            if ($msg = Auth::policy($pw)) throw bad($msg);
            if ($c->db->get('SELECT id FROM users WHERE email = ?', [$email])) throw conflict('Diese E-Mail ist bereits vergeben.');
            $plan = PLAN_LIST[$c->user['plan']] ?? PLAN_LIST['starter'];
            $count = (int) $c->db->val('SELECT COUNT(*) FROM users WHERE tenant_id = ? AND active = 1', [$c->tenantId]);
            if ($count >= $plan['users']) throw conflict("Ihr Tarif {$plan['label']} erlaubt höchstens {$plan['users']} Benutzer.");
            $id = $c->db->insert('users', ['tenant_id' => $c->tenantId, 'email' => $email, 'name' => $name, 'password_hash' => password_hash($pw, PASSWORD_DEFAULT), 'role' => $role, 'active' => 1]);
            audit($c, 'user', $id, 'create', "$email ($role)");
            return ['id' => $id];
        });
        $r->put('/users/:id', 'admin:w', function (Ctx $c) {
            $u = $c->db->get('SELECT * FROM users WHERE id = ? AND tenant_id = ?', [$c->id(), $c->tenantId]) ?? throw not_found('Benutzer');
            $row = [];
            if (isset($c->body['name'])) $row['name'] = vstr($c->body, 'name', 'Name', 160, true);
            if (isset($c->body['role'])) $row['role'] = \Erp\voneof($c->body['role'], array_keys(roles()), 'Rolle');
            if (isset($c->body['active'])) $row['active'] = $c->body['active'] ? 1 : 0;
            if (!empty($c->body['password'])) {
                if ($msg = Auth::policy((string) $c->body['password'])) throw bad($msg);
                $row['password_hash'] = password_hash((string) $c->body['password'], PASSWORD_DEFAULT);
            }
            $newRole = $row['role'] ?? $u['role'];
            $newActive = $row['active'] ?? (int) $u['active'];
            if ((int) $u['id'] === $c->user['id'] && ($newRole !== 'admin' || !$newActive)) throw conflict('Sie können sich nicht selbst die Administrator-Rechte entziehen oder sperren.');
            if ($newActive && !(int) $u['active']) {
                $plan = PLAN_LIST[$c->user['plan']] ?? PLAN_LIST['starter'];
                if ((int) $c->db->val('SELECT COUNT(*) FROM users WHERE tenant_id = ? AND active = 1', [$c->tenantId]) >= $plan['users']) throw conflict("Ihr Tarif {$plan['label']} erlaubt höchstens {$plan['users']} Benutzer.");
            }
            $c->db->update('users', $c->tenantId, (int) $u['id'], $row);
            if (!$newActive || isset($row['password_hash']) || isset($row['role'])) Auth::endAllFor($c->db, (int) $u['id']);
            audit($c, 'user', (int) $u['id'], 'update', implode(',', array_keys($row)));
            return ['ok' => true];
        });

        $r->get('/plan', 'admin:r', function (Ctx $c) {
            $plan = PLAN_LIST[$c->user['plan']] ?? PLAN_LIST['starter'];
            $month = date('Y-m') . '-01 00:00:00';
            return [
                'plan' => $c->user['plan'], 'label' => $plan['label'], 'limits' => $plan,
                'usage' => [
                    'users' => (int) $c->db->val('SELECT COUNT(*) FROM users WHERE tenant_id = ? AND active = 1', [$c->tenantId]),
                    'docs_this_month' => (int) $c->db->val("SELECT COUNT(*) FROM documents WHERE tenant_id = ? AND type IN ('quote','order','invoice') AND created_at >= ?", [$c->tenantId, $month]),
                ],
                'plans' => PLAN_LIST,
            ];
        });
        $r->get('/audit', 'admin:r', function (Ctx $c) {
            $limit = max(1, min(500, (int) ($c->q('limit') ?? 200)));
            return ['rows' => $c->db->all("SELECT id, ts, user_name, entity, entity_id, action, detail FROM audit_log WHERE tenant_id = ? ORDER BY id DESC LIMIT $limit", [$c->tenantId])];
        });

        // ----- Betreiber-Konsole (SaaS-Anbieter): Mandanten ansehen, Tarif ändern, sperren -----
        $op = function (Ctx $c): void {
            $key = (string) (\erp_config()['operator_key'] ?? '');
            $given = (string) ($_SERVER['HTTP_X_OPERATOR_KEY'] ?? '');
            if ($key === '' || strlen($key) < 20) throw not_found('Endpunkt');
            if (Auth::limited($c->db, 'operator:' . Auth::clientIp(), 20, 600)) throw new \Erp\HttpError(429, 'Zu viele Versuche');
            if (!hash_equals($key, $given)) throw new \Erp\HttpError(401, 'Ungültiger Schlüssel');
        };
        $r->get('/operator/tenants', null, function (Ctx $c) use ($op) {
            $op($c);
            return ['rows' => $c->db->all('SELECT t.id, t.name, t.plan, t.active, t.created_at, (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.active = 1) AS users FROM tenants t ORDER BY t.id')];
        });
        $r->post('/operator/tenants', null, function (Ctx $c) use ($op) {
            $op($c);
            $company = vstr($c->body, 'company', 'Firmenname', 200, true);
            $name = vstr($c->body, 'name', 'Name', 160, true);
            $email = vemail($c->body) ?? throw bad('E-Mail fehlt');
            $plan = \Erp\voneof($c->body['plan'] ?? 'starter', array_keys(PLAN_LIST), 'Tarif');
            $pw = (string) ($c->body['password'] ?? '');
            if ($msg = Auth::policy($pw)) throw bad($msg);
            if ($c->db->get('SELECT id FROM users WHERE email = ?', [$email])) throw conflict('Diese E-Mail ist bereits registriert.');
            $hash = password_hash($pw, PASSWORD_DEFAULT);
            return $c->db->tx(function () use ($c, $company, $name, $email, $plan, $hash) {
                $tid = $c->db->insert('tenants', ['name' => $company, 'plan' => $plan, 'settings' => json_encode(['company_name' => $company, 'email' => $email]), 'active' => 1]);
                Accounting::seedTenant($c->db, $tid);
                $c->db->insert('users', ['tenant_id' => $tid, 'email' => $email, 'name' => $name, 'password_hash' => $hash, 'role' => 'admin', 'active' => 1]);
                return ['id' => $tid];
            });
        }, false);
        $r->add('PUT', '/operator/tenants/:id', null, function (Ctx $c) use ($op) {
            $op($c);
            $t = $c->db->get('SELECT id FROM tenants WHERE id = ?', [$c->id()]) ?? throw not_found('Mandant');
            $row = [];
            if (isset($c->body['plan'])) $row['plan'] = \Erp\voneof($c->body['plan'], array_keys(PLAN_LIST), 'Tarif');
            if (isset($c->body['active'])) $row['active'] = $c->body['active'] ? 1 : 0;
            if ($row) $c->db->run('UPDATE tenants SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($row))) . ' WHERE id = ?', [...array_values($row), $t['id']]);
            return ['ok' => true];
        });
    }
}
