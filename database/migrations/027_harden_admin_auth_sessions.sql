ALTER TABLE admins
  ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER is_active;

ALTER TABLE admin_refresh_tokens
  ADD COLUMN family_id CHAR(36) NULL AFTER admin_id,
  ADD COLUMN token_jti CHAR(36) NULL AFTER family_id,
  ADD COLUMN replaced_by_jti CHAR(36) NULL AFTER token_jti,
  ADD COLUMN revoked_reason VARCHAR(64) NULL AFTER revoked_at,
  ADD COLUMN rotated_at DATETIME NULL AFTER revoked_reason;

UPDATE admin_refresh_tokens
SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
    revoked_reason = COALESCE(revoked_reason, 'auth_schema_migration'),
    family_id = UUID(),
    token_jti = UUID()
WHERE family_id IS NULL OR token_jti IS NULL;

ALTER TABLE admin_refresh_tokens
  MODIFY family_id CHAR(36) NOT NULL,
  MODIFY token_jti CHAR(36) NOT NULL,
  ADD KEY idx_refresh_token_hash (token_hash),
  ADD UNIQUE KEY uk_refresh_token_jti (token_jti),
  ADD KEY idx_refresh_family (family_id),
  ADD KEY idx_refresh_family_active (family_id, revoked_at),
  ADD KEY idx_refresh_admin_active (admin_id, revoked_at);
