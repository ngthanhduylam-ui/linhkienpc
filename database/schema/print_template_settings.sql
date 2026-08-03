CREATE TABLE IF NOT EXISTS print_template_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  document_type ENUM('sale_delivery_note') NOT NULL,
  active_template ENUM('system', 'custom') NOT NULL DEFAULT 'system',
  custom_template_config JSON NULL,
  custom_template_schema_version SMALLINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_print_template_settings_document_type (document_type),
  CONSTRAINT chk_print_template_custom_pair CHECK (
    (custom_template_config IS NULL AND custom_template_schema_version IS NULL)
    OR
    (custom_template_config IS NOT NULL AND custom_template_schema_version IS NOT NULL AND custom_template_schema_version > 0)
  ),
  CONSTRAINT chk_print_template_custom_selection CHECK (
    active_template = 'system' OR custom_template_config IS NOT NULL
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
