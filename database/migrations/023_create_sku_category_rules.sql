CREATE TABLE IF NOT EXISTS sku_category_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(64) NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sku_category_rules_token (token),
  KEY idx_sku_category_rules_category (category_id),
  CONSTRAINT fk_sku_category_rules_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO sku_category_rules (token, category_id)
SELECT seeds.token, seeds.category_id
FROM (
  SELECT 'lcd' AS token, COALESCE(
    MAX(CASE WHEN c.name = 'Màn hình' THEN c.id END),
    MAX(CASE WHEN c.name = 'LCD' THEN c.id END)
  ) AS category_id
  FROM categories c
  WHERE c.name IN ('Màn hình', 'LCD')

  UNION ALL

  SELECT mapping.token, MAX(c.id) AS category_id
  FROM (
    SELECT 'bb' AS token, 'Barebone' AS category_name
    UNION ALL SELECT 'barebone', 'Barebone'
    UNION ALL SELECT 'case', 'Case'
    UNION ALL SELECT 'psu', 'Nguồn'
    UNION ALL SELECT 'nguon', 'Nguồn'
    UNION ALL SELECT 'hdd', 'HDD'
    UNION ALL SELECT 'ssd', 'SSD'
    UNION ALL SELECT 'vga', 'VGA'
    UNION ALL SELECT 'ram', 'RAM'
    UNION ALL SELECT 'main', 'Mainboard'
    UNION ALL SELECT 'mainboard', 'Mainboard'
    UNION ALL SELECT 'cpu', 'CPU'
    UNION ALL SELECT 'fcpu', 'Tản nhiệt CPU'
    UNION ALL SELECT 'lap', 'Laptop'
    UNION ALL SELECT 'laptop', 'Laptop'
  ) mapping
  INNER JOIN categories c ON c.name = mapping.category_name
  GROUP BY mapping.token
) seeds
WHERE seeds.category_id IS NOT NULL;
