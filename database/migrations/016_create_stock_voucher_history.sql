CREATE TABLE IF NOT EXISTS stock_vouchers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  voucher_type ENUM('IN','OUT') NOT NULL,
  voucher_code VARCHAR(50) NULL,
  customer_id BIGINT UNSIGNED NULL,
  supplier_id BIGINT UNSIGNED NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_stock_vouchers_type_time (voucher_type, occurred_at),
  KEY idx_stock_vouchers_customer_time (customer_id, occurred_at),
  KEY idx_stock_vouchers_supplier_time (supplier_id, occurred_at),
  KEY idx_stock_vouchers_admin_time (created_by_admin_id, occurred_at),
  CONSTRAINT fk_stock_vouchers_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE,
  CONSTRAINT fk_stock_vouchers_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE,
  CONSTRAINT fk_stock_vouchers_admin
    FOREIGN KEY (created_by_admin_id) REFERENCES admins(id)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE stock_transactions
  ADD COLUMN voucher_id BIGINT UNSIGNED NULL AFTER id,
  ADD KEY idx_stock_txn_voucher (voucher_id),
  ADD CONSTRAINT fk_stock_txn_voucher
    FOREIGN KEY (voucher_id) REFERENCES stock_vouchers(id)
    ON UPDATE CASCADE;
