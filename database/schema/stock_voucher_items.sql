CREATE TABLE IF NOT EXISTS stock_voucher_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  voucher_id BIGINT UNSIGNED NOT NULL,
  stock_transaction_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  sku_snapshot VARCHAR(120) NOT NULL,
  product_name_snapshot VARCHAR(255) NOT NULL,
  warranty_note_snapshot VARCHAR(500) NULL,
  sale_note_snapshot VARCHAR(500) NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(15,0) NULL,
  line_total DECIMAL(15,0) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_stock_voucher_items_voucher (voucher_id),
  UNIQUE KEY uk_stock_voucher_items_stock_txn (stock_transaction_id),
  KEY idx_stock_voucher_items_product (product_id),
  KEY idx_stock_voucher_items_sku_snapshot (sku_snapshot),
  CONSTRAINT fk_stock_voucher_items_voucher
    FOREIGN KEY (voucher_id) REFERENCES stock_vouchers(id)
    ON UPDATE CASCADE,
  CONSTRAINT fk_stock_voucher_items_stock_txn
    FOREIGN KEY (stock_transaction_id) REFERENCES stock_transactions(id)
    ON UPDATE CASCADE,
  CONSTRAINT fk_stock_voucher_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE,
  CONSTRAINT chk_stock_voucher_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_stock_voucher_items_unit_price_non_negative CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT chk_stock_voucher_items_line_total_non_negative CHECK (line_total IS NULL OR line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
