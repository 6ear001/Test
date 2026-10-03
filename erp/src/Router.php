<?php
declare(strict_types=1);

namespace Erp;

final class Router
{
    private array $routes = [];

    /** $perm: null = öffentlich, 'auth' = jeder Angemeldete, sonst z. B. 'sales:w'. $tx: Anfrage in einer Transaktion ausführen. */
    public function add(string $method, string $path, ?string $perm, callable $fn, bool $tx = true): void
    {
        $regex = preg_replace_callback('#:(\w+)#', static function ($m) {
            $digits = $m[1] === 'id' || str_ends_with($m[1], 'Id');
            return '(?P<' . $m[1] . '>' . ($digits ? '\d+' : '[^/]+') . ')';
        }, $path);
        $this->routes[] = ['method' => $method, 'regex' => '#^' . $regex . '$#', 'perm' => $perm, 'fn' => $fn, 'tx' => $tx];
    }
    public function get(string $p, ?string $perm, callable $fn): void { $this->add('GET', $p, $perm, $fn, false); }
    public function post(string $p, ?string $perm, callable $fn, bool $tx = true): void { $this->add('POST', $p, $perm, $fn, $tx); }
    public function put(string $p, ?string $perm, callable $fn): void { $this->add('PUT', $p, $perm, $fn); }
    public function delete(string $p, ?string $perm, callable $fn): void { $this->add('DELETE', $p, $perm, $fn); }

    /** @return array{0: array, 1: array}|null */
    public function match(string $method, string $path): ?array
    {
        foreach ($this->routes as $r) {
            if ($r['method'] === $method && preg_match($r['regex'], $path, $m)) {
                $params = [];
                foreach ($m as $k => $v) {
                    if (is_string($k)) $params[$k] = $v;
                }
                return [$r, $params];
            }
        }
        return null;
    }
}
