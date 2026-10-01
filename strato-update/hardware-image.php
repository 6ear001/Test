<?php
require __DIR__ . '/config.php';
require __DIR__ . '/security-lib.php';

$id = $_GET['id'] ?? '';
// Strikt als GUID validieren, bevor es in die Backend-URL eingesetzt wird
// (verhindert Missbrauch als offenes Relay auf beliebige Pfade).
if (!is_string($id) || !preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $id)) {
    http_response_code(400);
    exit;
}

dg_proxy_image('/hardware/image/' . $id, 300);
