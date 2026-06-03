CREATE TABLE IF NOT EXISTS inventory_note_adjustments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  from_note VARCHAR(500) NULL,
  to_note VARCHAR(500) NULL,
  quantity INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  created_by_admin_id BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_note_adjust_product_time (product_id, occurred_at),
  KEY idx_inventory_note_adjust_from_note (product_id, from_note),
  KEY idx_inventory_note_adjust_to_note (product_id, to_note),
  KEY idx_inventory_note_adjust_admin_time (created_by_admin_id, occurred_at),
  CONSTRAINT fk_inventory_note_adjust_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE,
  CONSTRAINT fk_inventory_note_adjust_admin
    FOREIGN KEY (created_by_admin_id) REFERENCES admins(id)
    ON UPDATE CASCADE,
  CONSTRAINT chk_inventory_note_adjust_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
