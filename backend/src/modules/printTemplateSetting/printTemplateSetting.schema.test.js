const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const migrationPath = path.join(repositoryRoot, 'database/migrations/024_create_print_template_settings.sql');
const builderMigrationPath = path.join(repositoryRoot, 'database/migrations/025_add_print_template_builder_draft.sql');
const schemaPath = path.join(repositoryRoot, 'database/schema/print_template_settings.sql');
const rootSchemaPath = path.join(repositoryRoot, 'database/schema/schema.sql');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('migration defines one constrained row per supported document type', () => {
  const sql = read(migrationPath);
  assert.match(sql, /document_type\s+ENUM\('sale_delivery_note'\)\s+NOT NULL/i);
  assert.match(sql, /UNIQUE KEY\s+uk_print_template_settings_document_type\s*\(document_type\)/i);
  assert.match(sql, /active_template\s+ENUM\('system',\s*'custom'\)\s+NOT NULL\s+DEFAULT\s+'system'/i);
  assert.match(sql, /custom_template_config\s+JSON\s+NULL/i);
  assert.match(sql, /custom_template_schema_version\s+SMALLINT UNSIGNED\s+NULL/i);
});

test('migration safely creates the absent singleton without resetting an existing row', () => {
  const sql = read(migrationPath);
  assert.match(sql, /INSERT INTO print_template_settings/i);
  assert.match(sql, /WHERE NOT EXISTS\s*\([\s\S]*document_type = 'sale_delivery_note'/i);
  assert.doesNotMatch(sql, /ON DUPLICATE KEY UPDATE/i);
  assert.doesNotMatch(sql, /UPDATE\s+print_template_settings\s+SET\s+active_template/i);
});

test('database constraints require config/version pairing and config before custom selection', () => {
  const sql = read(migrationPath);
  assert.match(sql, /custom_template_config IS NULL AND custom_template_schema_version IS NULL/i);
  assert.match(sql, /custom_template_config IS NOT NULL AND custom_template_schema_version IS NOT NULL/i);
  assert.match(sql, /active_template = 'system' OR custom_template_config IS NOT NULL/i);
});

test('migration cannot mutate product, voucher, customer, or transaction tables', () => {
  const sql = read(migrationPath);
  assert.doesNotMatch(sql, /(?:INSERT INTO|UPDATE|DELETE FROM)\s+(?:products|stock_vouchers|stock_transactions|customers)\b/i);
});

test('canonical schema includes the base table plus isolated Builder Draft fields and is sourced by schema.sql', () => {
  const migrationSql = read(migrationPath);
  const builderMigrationSql = read(builderMigrationPath);
  const schemaSql = read(schemaPath);
  const rootSchemaSql = read(rootSchemaPath);
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS print_template_settings/i);
  assert.match(builderMigrationSql, /ALTER TABLE print_template_settings/i);
  for (const field of [
    'builder_draft_config',
    'builder_draft_schema_version',
    'builder_draft_revision',
    'builder_draft_updated_at'
  ]) {
    assert.match(schemaSql, new RegExp(`${field}\\s+`, 'i'));
    assert.match(builderMigrationSql, new RegExp(`ADD COLUMN\\s+${field}\\s+`, 'i'));
  }
  assert.match(rootSchemaSql, /SOURCE database\/schema\/print_template_settings\.sql;/);
});

test('migration 025 adds only Builder Draft storage and never changes active or Custom data', () => {
  const sql = read(builderMigrationPath);
  assert.match(sql, /builder_draft_revision\s+INT UNSIGNED\s+NOT NULL\s+DEFAULT\s+0/i);
  assert.match(sql, /builder_draft_config\s+JSON\s+NULL/i);
  assert.match(sql, /builder_draft_updated_at\s+DATETIME\s+NULL/i);
  assert.doesNotMatch(sql, /UPDATE\s+print_template_settings/i);
  assert.doesNotMatch(sql, /active_template\s*=/i);
  assert.doesNotMatch(sql, /custom_template_config\s*=/i);
  assert.doesNotMatch(sql, /products|stock_vouchers|stock_transactions|customers/i);
});
