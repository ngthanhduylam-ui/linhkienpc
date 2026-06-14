CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  spec_summary TEXT NULL,
  sale_price DECIMAL(15,0) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_products_sku (sku),
  KEY idx_products_name (name),
  FULLTEXT KEY ft_products_name (name),
  KEY idx_products_category_active (category_id, is_active),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON UPDATE CASCADE,
  CONSTRAINT chk_products_sale_price_non_negative CHECK (sale_price IS NULL OR sale_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
