const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('migration 027 adds auth_version and refresh-family metadata only to canonical auth tables', () => {
  const sql = read('database/migrations/027_harden_admin_auth_sessions.sql');
  assert.match(sql, /ALTER TABLE admins[\s\S]*auth_version INT UNSIGNED NOT NULL DEFAULT 1/i);
  assert.match(sql, /ALTER TABLE admin_refresh_tokens/i);
  for (const column of ['family_id', 'token_jti', 'replaced_by_jti', 'revoked_reason', 'rotated_at']) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, 'i'));
  }
  assert.match(sql, /revoked_reason = COALESCE\(revoked_reason, 'auth_schema_migration'\)/i);
  assert.match(sql, /UPDATE admin_refresh_tokens/i);
  assert.doesNotMatch(sql, /print_template|builder|products|inventory|stock_|customers/i);
});

test('canonical auth schema mirrors migration fields and indexes', () => {
  const admins = read('database/schema/admins.sql');
  const refresh = read('database/schema/admin_refresh_tokens.sql');
  assert.match(admins, /auth_version INT UNSIGNED NOT NULL DEFAULT 1/i);
  assert.match(refresh, /family_id CHAR\(36\) NOT NULL/i);
  assert.match(refresh, /token_jti CHAR\(36\) NOT NULL/i);
  assert.match(refresh, /UNIQUE KEY uk_refresh_token_jti/i);
  assert.match(refresh, /KEY idx_refresh_token_hash/i);
  assert.match(refresh, /KEY idx_refresh_family_active/i);
});
