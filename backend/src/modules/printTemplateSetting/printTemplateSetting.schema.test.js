const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../../../..');
const migrationPath = path.join(repositoryRoot, 'database/migrations/024_create_print_template_settings.sql');
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

test('canonical schema matches the migration table and is sourced by schema.sql', () => {
  const migrationSql = read(migrationPath);
  const schemaSql = read(schemaPath);
  const rootSchemaSql = read(rootSchemaPath);
  const createTable = (sql) => sql.match(/CREATE TABLE IF NOT EXISTS print_template_settings[\s\S]*?COLLATE=utf8mb4_unicode_ci;/i)?.[0];
  assert.equal(createTable(schemaSql), createTable(migrationSql));
  assert.match(rootSchemaSql, /SOURCE database\/schema\/print_template_settings\.sql;/);
});
