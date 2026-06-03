const { pool } = require('../src/config/database');

const TABLES_TO_RESET = [
  'stock_transactions',
  'inventory_balances',
  'product_inventory_balances',
  'products',
  'customers',
  'suppliers'
];

async function countRows(connection, tableName) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
  return Number(rows[0].total || 0);
}

async function printCounts(connection, title) {
  console.log(`\n${title}`);
  for (const tableName of TABLES_TO_RESET) {
    const total = await countRows(connection, tableName);
    console.log(`- ${tableName}: ${total}`);
  }
}

async function resetTable(connection, tableName) {
  await connection.query(`DELETE FROM \`${tableName}\``);
  await connection.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
}

async function run() {
  const connection = await pool.getConnection();

  try {
    await printCounts(connection, 'So ban ghi truoc khi reset:');

    await connection.beginTransaction();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const tableName of TABLES_TO_RESET) {
      await resetTable(connection, tableName);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();

    await printCounts(connection, 'So ban ghi sau khi reset:');
    console.log('\nReset du lieu test hoan tat.');
    console.log('Khong xoa cau truc database, admin, categories hoac migrations.');
  } catch (error) {
    await connection.rollback();
    try {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (restoreError) {
      console.error('Khong the bat lai FOREIGN_KEY_CHECKS:', restoreError.message);
    }
    console.error('\nReset du lieu test that bai:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

run();
