<?php
declare(strict_types=1);

namespace Erp;

/** Tabellen für SQLite und MySQL/MariaDB. Platzhalter: {PK} Primärschlüssel, {TS} Zeitstempel, {NOCASE} Groß-/Kleinschreibung egal. */
final class Schema
{
    private const TABLES = [
        'tenants' => ["id {PK}, name VARCHAR(200) NOT NULL, plan VARCHAR(20) NOT NULL DEFAULT 'starter', settings TEXT, active INTEGER NOT NULL DEFAULT 1, created_at {TS}", []],
        'users' => ["id {PK}, tenant_id INTEGER NOT NULL, email VARCHAR(190) NOT NULL {NOCASE}, name VARCHAR(160) NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, active INTEGER NOT NULL DEFAULT 1, last_login VARCHAR(19), created_at {TS}, UNIQUE (email)", [['ix_users_tenant', 'tenant_id']]],
        'sessions' => ["token_hash VARCHAR(64) NOT NULL PRIMARY KEY, user_id INTEGER NOT NULL, tenant_id INTEGER NOT NULL, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL", [['ix_sessions_user', 'user_id']]],
        'rate_hits' => ["id {PK}, k VARCHAR(190) NOT NULL, ts BIGINT NOT NULL", [['ix_rate', 'k, ts']]],
        'counters' => ["tenant_id INTEGER NOT NULL, k VARCHAR(60) NOT NULL, value INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, k)", []],
        'audit_log' => ["id {PK}, tenant_id INTEGER NOT NULL, user_id INTEGER, user_name VARCHAR(160), ts {TS}, entity VARCHAR(40) NOT NULL, entity_id INTEGER, action VARCHAR(40) NOT NULL, detail VARCHAR(500)", [['ix_audit', 'tenant_id, id']]],

        'customers' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(30) NOT NULL, name VARCHAR(200) NOT NULL, kind VARCHAR(10) NOT NULL DEFAULT 'company', status VARCHAR(12) NOT NULL DEFAULT 'customer', email VARCHAR(190), phone VARCHAR(60), website VARCHAR(200), street VARCHAR(200), zip VARCHAR(20), city VARCHAR(120), country VARCHAR(2) NOT NULL DEFAULT 'DE', vat_id VARCHAR(30), payment_days INTEGER NOT NULL DEFAULT 14, discount_pct DOUBLE NOT NULL DEFAULT 0, credit_limit_cents INTEGER NOT NULL DEFAULT 0, tags VARCHAR(200), notes TEXT, account_id INTEGER, created_at {TS}, UNIQUE (tenant_id, number)", [['ix_customers_name', 'tenant_id, name']]],
        'suppliers' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(30) NOT NULL, name VARCHAR(200) NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'active', email VARCHAR(190), phone VARCHAR(60), website VARCHAR(200), street VARCHAR(200), zip VARCHAR(20), city VARCHAR(120), country VARCHAR(2) NOT NULL DEFAULT 'DE', vat_id VARCHAR(30), iban VARCHAR(40), bic VARCHAR(20), payment_days INTEGER NOT NULL DEFAULT 14, lead_days INTEGER NOT NULL DEFAULT 3, notes TEXT, account_id INTEGER, created_at {TS}, UNIQUE (tenant_id, number)", [['ix_suppliers_name', 'tenant_id, name']]],
        'contacts' => ["id {PK}, tenant_id INTEGER NOT NULL, party_type VARCHAR(10) NOT NULL, party_id INTEGER NOT NULL, name VARCHAR(160) NOT NULL, role VARCHAR(120), email VARCHAR(190), phone VARCHAR(60), is_primary INTEGER NOT NULL DEFAULT 0", [['ix_contacts', 'tenant_id, party_type, party_id']]],
        'activities' => ["id {PK}, tenant_id INTEGER NOT NULL, party_type VARCHAR(10) NOT NULL, party_id INTEGER NOT NULL, kind VARCHAR(10) NOT NULL DEFAULT 'note', text TEXT NOT NULL, due_date VARCHAR(10), done INTEGER NOT NULL DEFAULT 0, user_id INTEGER, user_name VARCHAR(160), created_at {TS}", [['ix_activities', 'tenant_id, party_type, party_id'], ['ix_activities_due', 'tenant_id, done, due_date']]],

        'products' => ["id {PK}, tenant_id INTEGER NOT NULL, sku VARCHAR(40) NOT NULL, name VARCHAR(200) NOT NULL, description TEXT, category VARCHAR(100), unit VARCHAR(12) NOT NULL DEFAULT 'Stk', price_cents INTEGER NOT NULL DEFAULT 0, cost_cents INTEGER NOT NULL DEFAULT 0, avg_cost_cents INTEGER NOT NULL DEFAULT 0, tax_rate DOUBLE NOT NULL DEFAULT 19, track_stock INTEGER NOT NULL DEFAULT 1, min_stock DOUBLE NOT NULL DEFAULT 0, reorder_qty DOUBLE NOT NULL DEFAULT 0, supplier_id INTEGER, barcode VARCHAR(60), weight_g INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at {TS}, UNIQUE (tenant_id, sku)", [['ix_products_name', 'tenant_id, name']]],
        'warehouses' => ["id {PK}, tenant_id INTEGER NOT NULL, name VARCHAR(120) NOT NULL, code VARCHAR(20) NOT NULL, address VARCHAR(300), is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, UNIQUE (tenant_id, code)", []],
        'stock_levels' => ["tenant_id INTEGER NOT NULL, product_id INTEGER NOT NULL, warehouse_id INTEGER NOT NULL, qty DOUBLE NOT NULL DEFAULT 0, bin VARCHAR(40), PRIMARY KEY (product_id, warehouse_id)", [['ix_levels_tenant', 'tenant_id, warehouse_id']]],
        'stock_movements' => ["id {PK}, tenant_id INTEGER NOT NULL, ts {TS}, product_id INTEGER NOT NULL, warehouse_id INTEGER NOT NULL, delta DOUBLE NOT NULL, kind VARCHAR(20) NOT NULL, ref_type VARCHAR(20), ref_id INTEGER, ref_number VARCHAR(40), note VARCHAR(300), unit_cost_cents INTEGER, user_id INTEGER", [['ix_moves', 'tenant_id, product_id, id']]],
        'inventory_counts' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(40) NOT NULL, warehouse_id INTEGER NOT NULL, status VARCHAR(10) NOT NULL DEFAULT 'open', created_at {TS}, finished_at VARCHAR(19), user_id INTEGER, UNIQUE (tenant_id, number)", []],
        'inventory_count_lines' => ["id {PK}, tenant_id INTEGER NOT NULL, count_id INTEGER NOT NULL, product_id INTEGER NOT NULL, expected DOUBLE NOT NULL, counted DOUBLE", [['ix_icl', 'tenant_id, count_id']]],

        'documents' => ["id {PK}, tenant_id INTEGER NOT NULL, type VARCHAR(12) NOT NULL, number VARCHAR(40), status VARCHAR(12) NOT NULL, customer_id INTEGER NOT NULL, parent_id INTEGER, date VARCHAR(10) NOT NULL, due_date VARCHAR(10), valid_until VARCHAR(10), reference VARCHAR(200), notes TEXT, bill_to TEXT, ship_to TEXT, warehouse_id INTEGER, net_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0, gross_cents INTEGER NOT NULL DEFAULT 0, paid_cents INTEGER NOT NULL DEFAULT 0, credited_cents INTEGER NOT NULL DEFAULT 0, journal_entry_id INTEGER, created_by INTEGER, created_at {TS}, issued_at VARCHAR(19), UNIQUE (tenant_id, type, number)", [['ix_documents', 'tenant_id, type, id'], ['ix_documents_cust', 'tenant_id, customer_id'], ['ix_documents_parent', 'tenant_id, parent_id']]],
        'document_lines' => ["id {PK}, tenant_id INTEGER NOT NULL, document_id INTEGER NOT NULL, position INTEGER NOT NULL, product_id INTEGER, sku VARCHAR(40), description VARCHAR(500) NOT NULL, qty DOUBLE NOT NULL, unit VARCHAR(12) NOT NULL DEFAULT 'Stk', price_cents INTEGER NOT NULL DEFAULT 0, discount_pct DOUBLE NOT NULL DEFAULT 0, tax_rate DOUBLE NOT NULL DEFAULT 19, net_cents INTEGER NOT NULL DEFAULT 0, qty_delivered DOUBLE NOT NULL DEFAULT 0, qty_invoiced DOUBLE NOT NULL DEFAULT 0, qty_credited DOUBLE NOT NULL DEFAULT 0, parent_line_id INTEGER, stock_issued INTEGER NOT NULL DEFAULT 0", [['ix_doclines', 'tenant_id, document_id'], ['ix_doclines_product', 'tenant_id, product_id']]],

        'purchase_orders' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(40) NOT NULL, supplier_id INTEGER NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'draft', date VARCHAR(10) NOT NULL, expected_date VARCHAR(10), warehouse_id INTEGER, reference VARCHAR(200), notes TEXT, net_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0, gross_cents INTEGER NOT NULL DEFAULT 0, created_by INTEGER, created_at {TS}, UNIQUE (tenant_id, number)", [['ix_po_supplier', 'tenant_id, supplier_id']]],
        'po_lines' => ["id {PK}, tenant_id INTEGER NOT NULL, po_id INTEGER NOT NULL, position INTEGER NOT NULL, product_id INTEGER, sku VARCHAR(40), description VARCHAR(500) NOT NULL, qty DOUBLE NOT NULL, unit VARCHAR(12) NOT NULL DEFAULT 'Stk', cost_cents INTEGER NOT NULL DEFAULT 0, tax_rate DOUBLE NOT NULL DEFAULT 19, net_cents INTEGER NOT NULL DEFAULT 0, qty_received DOUBLE NOT NULL DEFAULT 0, qty_invoiced DOUBLE NOT NULL DEFAULT 0", [['ix_polines', 'tenant_id, po_id'], ['ix_polines_product', 'tenant_id, product_id']]],
        'goods_receipts' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(40) NOT NULL, po_id INTEGER, supplier_id INTEGER NOT NULL, warehouse_id INTEGER NOT NULL, date VARCHAR(10) NOT NULL, note VARCHAR(300), user_id INTEGER, created_at {TS}, UNIQUE (tenant_id, number)", []],
        'goods_receipt_lines' => ["id {PK}, tenant_id INTEGER NOT NULL, receipt_id INTEGER NOT NULL, po_line_id INTEGER, product_id INTEGER, description VARCHAR(500), qty DOUBLE NOT NULL, cost_cents INTEGER NOT NULL DEFAULT 0", [['ix_grl', 'tenant_id, receipt_id']]],
        'supplier_invoices' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(40) NOT NULL, supplier_id INTEGER NOT NULL, po_id INTEGER, supplier_ref VARCHAR(80) NOT NULL, date VARCHAR(10) NOT NULL, due_date VARCHAR(10), net_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0, gross_cents INTEGER NOT NULL DEFAULT 0, paid_cents INTEGER NOT NULL DEFAULT 0, status VARCHAR(12) NOT NULL DEFAULT 'open', note VARCHAR(300), journal_entry_id INTEGER, created_by INTEGER, created_at {TS}, UNIQUE (tenant_id, number)", [['ix_si_supplier', 'tenant_id, supplier_id']]],
        'supplier_invoice_lines' => ["id {PK}, tenant_id INTEGER NOT NULL, invoice_id INTEGER NOT NULL, po_line_id INTEGER, description VARCHAR(500) NOT NULL, qty DOUBLE NOT NULL DEFAULT 1, net_cents INTEGER NOT NULL DEFAULT 0, tax_rate DOUBLE NOT NULL DEFAULT 19, account_id INTEGER NOT NULL", [['ix_sil', 'tenant_id, invoice_id']]],
        'payments' => ["id {PK}, tenant_id INTEGER NOT NULL, kind VARCHAR(10) NOT NULL, party_id INTEGER NOT NULL, ref_type VARCHAR(20) NOT NULL, ref_id INTEGER NOT NULL, date VARCHAR(10) NOT NULL, amount_cents INTEGER NOT NULL, method VARCHAR(20), account_id INTEGER NOT NULL, reference VARCHAR(200), journal_entry_id INTEGER, reversed INTEGER NOT NULL DEFAULT 0, created_by INTEGER, created_at {TS}", [['ix_payments', 'tenant_id, ref_type, ref_id']]],

        'carriers' => ["id {PK}, tenant_id INTEGER NOT NULL, name VARCHAR(100) NOT NULL, tracking_url VARCHAR(300), active INTEGER NOT NULL DEFAULT 1", [['ix_carriers', 'tenant_id']]],
        'shipments' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(40) NOT NULL, direction VARCHAR(10) NOT NULL DEFAULT 'outbound', delivery_id INTEGER, po_id INTEGER, party_name VARCHAR(200), address TEXT, carrier_id INTEGER, tracking_no VARCHAR(80), status VARCHAR(12) NOT NULL DEFAULT 'planned', ship_date VARCHAR(10), eta VARCHAR(10), delivered_at VARCHAR(19), packages INTEGER NOT NULL DEFAULT 1, weight_g INTEGER NOT NULL DEFAULT 0, cost_cents INTEGER NOT NULL DEFAULT 0, notes VARCHAR(500), created_at {TS}, UNIQUE (tenant_id, number)", [['ix_shipments_status', 'tenant_id, status']]],
        'shipment_events' => ["id {PK}, tenant_id INTEGER NOT NULL, shipment_id INTEGER NOT NULL, ts {TS}, status VARCHAR(12) NOT NULL, note VARCHAR(300), user_name VARCHAR(160)", [['ix_shev', 'tenant_id, shipment_id']]],

        'accounts' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(12) NOT NULL, name VARCHAR(200) NOT NULL, type VARCHAR(10) NOT NULL, kind VARCHAR(10) NOT NULL DEFAULT 'general', party_id INTEGER, system_key VARCHAR(30), active INTEGER NOT NULL DEFAULT 1, iban VARCHAR(40), bic VARCHAR(20), bank_name VARCHAR(120), UNIQUE (tenant_id, number)", [['ix_accounts_sys', 'tenant_id, system_key']]],
        'journal_entries' => ["id {PK}, tenant_id INTEGER NOT NULL, number VARCHAR(40) NOT NULL, date VARCHAR(10) NOT NULL, text VARCHAR(300) NOT NULL, source VARCHAR(20) NOT NULL DEFAULT 'manual', ref_type VARCHAR(20), ref_id INTEGER, reverses_id INTEGER, reversed_by_id INTEGER, created_by INTEGER, created_at {TS}, UNIQUE (tenant_id, number)", [['ix_journal', 'tenant_id, date, id']]],
        'journal_lines' => ["id {PK}, tenant_id INTEGER NOT NULL, entry_id INTEGER NOT NULL, account_id INTEGER NOT NULL, debit_cents BIGINT NOT NULL DEFAULT 0, credit_cents BIGINT NOT NULL DEFAULT 0, text VARCHAR(200)", [['ix_jlines_acc', 'tenant_id, account_id'], ['ix_jlines_entry', 'entry_id']]],
    ];

    /** Tabellen, die Daten eines Mandanten enthalten (Spalte tenant_id). */
    public static function tenantTables(): array
    {
        return array_keys(array_filter(self::TABLES, static fn($t) => str_contains($t[0], 'tenant_id')));
    }

    public static function statements(bool $mysql): array
    {
        $out = [];
        foreach (self::TABLES as $name => [$cols, $indexes]) {
            $cols = strtr($cols, [
                '{PK}' => $mysql ? 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT',
                '{TS}' => $mysql ? 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP' : "TEXT NOT NULL DEFAULT (datetime('now'))",
                '{NOCASE}' => $mysql ? '' : 'COLLATE NOCASE',
            ]);
            if ($mysql) {
                $inline = '';
                foreach ($indexes as [$ixName, $ixCols]) $inline .= ", INDEX $ixName ($ixCols)";
                $out[] = "CREATE TABLE IF NOT EXISTS $name ($cols$inline) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            } else {
                $out[] = "CREATE TABLE IF NOT EXISTS $name ($cols)";
                foreach ($indexes as [$ixName, $ixCols]) $out[] = "CREATE INDEX IF NOT EXISTS $ixName ON $name ($ixCols)";
            }
        }
        return $out;
    }
}
