const CATEGORY_NAME = 'Mainboard';
const APPLY_CONFIRMATION = 'APPLY_MAINBOARD_PREFIX_RENAME';
const MATCHING_PRODUCTS_SQL = `
  SELECT p.id, p.name, c.name AS category_name
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE BINARY c.name = ?
    AND (
      BINARY p.name = 'MB'
      OR BINARY p.name LIKE 'MB %'
    )
  ORDER BY p.id
`;

function getCharacterLength(value) {
  return Array.from(String(value)).length;
}

function planProductNameChange(product) {
  if (product?.category_name !== CATEGORY_NAME) return null;

  const oldName = product?.name === null || product?.name === undefined ? '' : String(product.name);
  if (!/^MB(?=\s|$)/.test(oldName)) return null;

  return {
    product_id: Number(product.id),
    old_name: oldName,
    proposed_new_name: oldName.replace(/^MB(?=\s|$)/, CATEGORY_NAME)
  };
}

function parseArguments(argv) {
  const options = { mode: 'dry-run', confirmation: null };
  let selectedMode = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run' || argument === '--apply') {
      if (selectedMode) throw new Error('Choose only one mode: --dry-run or --apply.');
      selectedMode = argument.slice(2);
      options.mode = selectedMode;
      continue;
    }
    if (argument === '--confirm') {
      const confirmation = argv[index + 1];
      if (!confirmation || confirmation.startsWith('--')) throw new Error('--confirm requires a value.');
      options.confirmation = confirmation;
      index += 1;
      continue;
    }
    if (argument === '--help') {
      options.mode = 'help';
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

async function getNameMaxLength(connection) {
  const [rows] = await connection.query(
    `
      SELECT CHARACTER_MAXIMUM_LENGTH AS max_length
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND COLUMN_NAME = 'name'
      LIMIT 1
    `
  );
  const maxLength = Number(rows[0]?.max_length);
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error('Cannot verify products.name maximum length.');
  }
  return maxLength;
}

async function readMatchingProducts(connection, { forUpdate = false } = {}) {
  const lockSql = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(`${MATCHING_PRODUCTS_SQL}${lockSql}`, [CATEGORY_NAME]);
  return rows;
}

function buildPlan(products) {
  return products.map(planProductNameChange).filter(Boolean);
}

function assertNamesFit(plan, nameMaxLength) {
  const invalid = plan.find((row) => getCharacterLength(row.proposed_new_name) > nameMaxLength);
  if (invalid) {
    throw new Error(
      `Proposed name exceeds VARCHAR(${nameMaxLength}) for product id ${invalid.product_id}.`
    );
  }
}

function printPlan(plan) {
  console.log('\nMainboard product-name prefix plan');
  for (const row of plan) {
    console.log(`- product_id: ${row.product_id}`);
    console.log(`  old_name: ${row.old_name}`);
    console.log(`  proposed_new_name: ${row.proposed_new_name}`);
  }
  console.log(`- total_matched_count: ${plan.length}`);
}

async function applyChanges(connection, nameMaxLength) {
  await connection.beginTransaction();
  try {
    const plan = buildPlan(await readMatchingProducts(connection, { forUpdate: true }));
    assertNamesFit(plan, nameMaxLength);

    let affectedRows = 0;
    for (const row of plan) {
      const [result] = await connection.query(
        'UPDATE products SET name = ? WHERE id = ? AND BINARY name = ?',
        [row.proposed_new_name, row.product_id, row.old_name]
      );
      if (result.affectedRows !== 1) {
        throw new Error(`Concurrent edit or missing product detected for id ${row.product_id}.`);
      }
      affectedRows += result.affectedRows;
    }

    if (affectedRows !== plan.length) {
      throw new Error(`Affected-row mismatch: expected ${plan.length}, received ${affectedRows}.`);
    }

    const remainingMatches = await readMatchingProducts(connection);
    if (remainingMatches.length !== 0) {
      throw new Error(`Post-update verification failed: ${remainingMatches.length} matching rows remain.`);
    }

    await connection.commit();
    return { plan, affectedRows };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

function printHelp() {
  console.log(`Usage:
  node backend/scripts/rename-mainboard-product-prefix.js --dry-run
  node backend/scripts/rename-mainboard-product-prefix.js --apply --confirm ${APPLY_CONFIRMATION}`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === 'help') {
    printHelp();
    return;
  }
  if (options.mode === 'apply' && options.confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`--apply requires --confirm ${APPLY_CONFIRMATION}.`);
  }

  const { pool } = require('../src/config/database');
  let connection = null;
  try {
    connection = await pool.getConnection();
    const nameMaxLength = await getNameMaxLength(connection);

    if (options.mode === 'apply') {
      const result = await applyChanges(connection, nameMaxLength);
      printPlan(result.plan);
      console.log(`\nApply committed. Updated rows: ${result.affectedRows}`);
      return;
    }

    const plan = buildPlan(await readMatchingProducts(connection));
    assertNamesFit(plan, nameMaxLength);
    printPlan(plan);
    console.log('\nDry-run only. No database rows were changed.');
  } finally {
    connection?.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Mainboard product-name maintenance failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_CONFIRMATION,
  CATEGORY_NAME,
  MATCHING_PRODUCTS_SQL,
  applyChanges,
  buildPlan,
  parseArguments,
  planProductNameChange
};
