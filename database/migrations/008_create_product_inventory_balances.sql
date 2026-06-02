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

INSERT INTO product_inventory_balances (product_id, quantity)
SELECT
  p.id AS product_id,
  GREATEST(
    COALESCE(
      SUM(
        CASE
          WHEN st.txn_type = 'IN' THEN st.quantity
          WHEN st.txn_type = 'OUT' THEN -st.quantity
          ELSE 0
        END
      ),
      0
    ),
    0
  ) AS total_quantity
FROM products p
LEFT JOIN stock_transactions st ON st.product_id = p.id
GROUP BY p.id
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP;
