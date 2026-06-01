const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../src/config/database');

const MIGRATION_TABLE = 'schema_migrations';
const migrationsDir = path.resolve(__dirname, '../../database/migrations');

async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function getAppliedMigrations() {
  const [rows] = await pool.query(`SELECT file_name FROM ${MIGRATION_TABLE}`);
  return new Set(rows.map((row) => row.file_name));
}

async function applyMigration(fileName) {
  const filePath = path.join(migrationsDir, fileName);
  const rawSql = await fs.readFile(filePath, 'utf8');

const statements = rawSql
  .replace(/^\uFEFF/, '')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();

  for (const statement of statements) {
    await connection.query(statement);
  }
    await connection.query(
      `INSERT INTO ${MIGRATION_TABLE} (file_name) VALUES (?)`,
      [fileName]
    );
    await connection.commit();
    console.log(`Applied migration: ${fileName}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function run() {
  await ensureMigrationTable();

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied = await getAppliedMigrations();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Skipped migration: ${file}`);
      continue;
    }
    await applyMigration(file);
  }

  console.log('Migration completed.');
  await pool.end();
}

run().catch(async (error) => {
  console.error('Migration failed:', error.message);
  await pool.end();
  process.exit(1);
});
