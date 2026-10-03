<?php
declare(strict_types=1);

// Einstiegspunkt der API (alle Aufrufe unter /api/... werden per .htaccess hierher geleitet).
require __DIR__ . '/src/bootstrap.php';
\Erp\Kernel::handle();
