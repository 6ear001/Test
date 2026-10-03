<?php
declare(strict_types=1);

namespace Erp;

/** Alles, was ein Endpunkt über die Anfrage wissen muss. */
final class Ctx
{
    public int $tenantId = 0;
    public ?array $user = null;
    public array $params = [];

    public function __construct(public Db $db, public string $method, public array $query, public array $body) {}

    public function id(string $name = 'id'): int { return (int) ($this->params[$name] ?? 0); }
    public function q(string $key, ?string $def = null): ?string
    {
        $v = $this->query[$key] ?? $def;
        return is_string($v) && $v !== '' ? $v : $def;
    }
    public function settings(): array { return get_settings($this->db, $this->tenantId); }
    public function userId(): ?int { return isset($this->user['id']) ? (int) $this->user['id'] : null; }
}
