CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_id BIGINT UNSIGNED NOT NULL,
  family_id CHAR(36) NOT NULL,
  token_jti CHAR(36) NOT NULL,
  replaced_by_jti CHAR(36) NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(64) NULL,
  rotated_at DATETIME NULL,
  KEY idx_refresh_admin (admin_id),
  KEY idx_refresh_expires (expires_at),
  KEY idx_refresh_token_hash (token_hash),
  UNIQUE KEY uk_refresh_token_jti (token_jti),
  KEY idx_refresh_family (family_id),
  KEY idx_refresh_family_active (family_id, revoked_at),
  KEY idx_refresh_admin_active (admin_id, revoked_at),
  CONSTRAINT fk_refresh_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
