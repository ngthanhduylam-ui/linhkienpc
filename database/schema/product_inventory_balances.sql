CREATE TABLE IF NOT EXISTS product_inventory_balances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_product_inventory_product (product_id),
  KEY idx_product_inventory_product (product_id),
  CONSTRAINT fk_product_inventory_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE,
  CONSTRAINT chk_product_inventory_quantity_non_negative CHECK (quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
