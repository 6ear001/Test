<?php
declare(strict_types=1);

namespace Erp;

final class Routes
{
    public static function register(Router $r): void
    {
        Api\AuthApi::register($r);
        Api\CrmApi::register($r);
        Api\CatalogApi::register($r);
        Api\SalesApi::register($r);
        Api\PurchasingApi::register($r);
        Api\LogisticsApi::register($r);
        Api\FinanceApi::register($r);
        Api\ReportApi::register($r);
    }
}
