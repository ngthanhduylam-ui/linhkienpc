const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const BACKUP_SCHEMA_VERSION = 1;
const DEFAULT_NAME_MAX_LENGTH = 255;
const APPLY_CONFIRMATION = 'APPLY_PRODUCT_NAME_SUFFIXES';
const RESTORE_CONFIRMATION = 'RESTORE_PRODUCT_NAMES';
const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), 'linhkienpc-maintenance-backups', 'product-name-suffixes');

function getCharacterLength(value) {
  return Array.from(String(value)).length;
}

function classifySku(sku) {
  const firstToken = String(sku ?? '')
    .trim()
    .split(/[.\-_\s]+/)
    .find(Boolean)
    ?.toLowerCase();

  return firstToken === '2nd' || firstToken === 'new' ? firstToken : null;
}

function getTrailingConditionSuffix(name) {
  const match = String(name ?? '').trimEnd().match(/(?:^|[^a-z0-9])(2nd|new)$/i);
  return match ? match[1].toLowerCase() : null;
}

function planProductNameChange(product, nameMaxLength = DEFAULT_NAME_MAX_LENGTH) {
  const id = Number(product?.id);
  const sku = product?.sku === null || product?.sku === undefined ? '' : String(product.sku);
  const oldName = product?.name === null || product?.name === undefined ? '' : String(product.name);
  const classification = classifySku(sku);
  const trimmedName = oldName.trimEnd();
  const existingSuffix = getTrailingConditionSuffix(trimmedName);
  const base = {
    product_id: id,
    sku,
    old_name: oldName,
    proposed_new_name: oldName,
    classification,
    status: 'unknown_sku',
    reason: 'SKU first token is not 2nd or new.'
  };

  if (!classification) {
    return base;
  }

  if (existingSuffix === classification) {
    return {
      ...base,
      proposed_new_name: trimmedName,
      status: 'already_correct',
      reason: `Name already ends with ${classification}.`
    };
  }

  if (existingSuffix && existingSuffix !== classification) {
    return {
      ...base,
      proposed_new_name: trimmedName,
      status: 'conflict',
      reason: `SKU starts ${classification} but name ends ${existingSuffix}.`
    };
  }

  const proposedName = `${trimmedName} ${classification}`;
  if (getCharacterLength(proposedName) > nameMaxLength) {
    return {
      ...base,
      proposed_new_name: proposedName,
      status: 'length_violation',
      reason: `Proposed name exceeds VARCHAR(${nameMaxLength}).`
    };
  }

  return {
    ...base,
    proposed_new_name: proposedName,
    status: 'change',
    reason: `Append ${classification} from the first SKU token.`
  };
}

function summarizePreview(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.total_products_scanned += 1;
      if (row.classification === '2nd') summary.eligible_2nd += 1;
      if (row.classification === 'new') summary.eligible_new += 1;
      if (row.status === 'already_correct') summary.already_correctly_suffixed += 1;
      if (row.status === 'conflict') summary.conflicting_suffix += 1;
      if (row.status === 'unknown_sku') summary.unknown_or_unclassified_sku += 1;
      if (row.status === 'length_violation') summary.names_exceeding_column_length += 1;
      if (row.status === 'change') summary.rows_that_would_change += 1;
      return summary;
    },
    {
      total_products_scanned: 0,
      eligible_2nd: 0,
      eligible_new: 0,
      already_correctly_suffixed: 0,
      conflicting_suffix: 0,
      unknown_or_unclassified_sku: 0,
      names_exceeding_column_length: 0,
      rows_that_would_change: 0
    }
  );
}

function parseArguments(argv) {
  const options = {
    mode: 'dry-run',
    restoreFile: null,
    confirmation: null,
    outputDir: DEFAULT_OUTPUT_DIR
  };
  let selectedMode = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run' || argument === '--apply') {
      if (selectedMode) throw new Error('Choose only one mode: --dry-run, --apply, or --restore.');
      selectedMode = argument.slice(2);
      options.mode = selectedMode;
      continue;
    }
    if (argument === '--restore') {
      if (selectedMode) throw new Error('Choose only one mode: --dry-run, --apply, or --restore.');
      const restoreFile = argv[index + 1];
      if (!restoreFile || restoreFile.startsWith('--')) throw new Error('--restore requires a backup file path.');
      selectedMode = 'restore';
      options.mode = 'restore';
      options.restoreFile = path.resolve(restoreFile);
      index += 1;
      continue;
    }
    if (argument === '--confirm') {
      const confirmation = argv[index + 1];
      if (!confirmation || confirmation.startsWith('--')) throw new Error('--confirm requires a value.');
      options.confirmation = confirmation;
      index += 1;
      continue;
    }
    if (argument === '--output-dir') {
      const outputDir = argv[index + 1];
      if (!outputDir || outputDir.startsWith('--')) throw new Error('--output-dir requires a directory path.');
      options.outputDir = path.resolve(outputDir);
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

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function writePreviewFile(outputDir, nameMaxLength, rows, summary) {
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `product-name-suffixes-${timestampForFile()}.json`);
  const payload = {
    schema_version: BACKUP_SCHEMA_VERSION,
    operation: 'append_product_name_condition_suffix',
    generated_at: new Date().toISOString(),
    products_table: 'products',
    id_column: 'id',
    sku_column: 'sku',
    name_column: 'name',
    name_max_length: nameMaxLength,
    summary,
    rows
  };
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx'
  });
  return filePath;
}

function printSummary(title, summary) {
  console.log(`\n${title}`);
  for (const [key, value] of Object.entries(summary)) {
    console.log(`- ${key}: ${value}`);
  }
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

async function readProducts(connection) {
  const [rows] = await connection.query('SELECT id, sku, name FROM products ORDER BY id');
  return rows;
}

async function applyChanges(connection, plannedRows) {
  let affectedRows = 0;
  await connection.beginTransaction();
  try {
    for (const row of plannedRows) {
      const [result] = await connection.query(
        'UPDATE products SET name = ? WHERE id = ? AND name = ?',
        [row.proposed_new_name, row.product_id, row.old_name]
      );
      if (result.affectedRows !== 1) {
        throw new Error(`Concurrent edit or missing product detected for id ${row.product_id}.`);
      }
      affectedRows += result.affectedRows;
    }
    if (affectedRows !== plannedRows.length) {
      throw new Error(`Affected-row mismatch: expected ${plannedRows.length}, received ${affectedRows}.`);
    }
    await connection.commit();
    return affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

function validateBackup(payload) {
  if (
    !payload ||
    payload.schema_version !== BACKUP_SCHEMA_VERSION ||
    payload.operation !== 'append_product_name_condition_suffix' ||
    payload.products_table !== 'products' ||
    payload.id_column !== 'id' ||
    payload.sku_column !== 'sku' ||
    payload.name_column !== 'name' ||
    !Number.isInteger(Number(payload.name_max_length)) ||
    Number(payload.name_max_length) < 1 ||
    !Array.isArray(payload.rows)
  ) {
    throw new Error('Backup file structure or schema_version is invalid.');
  }

  const changeRows = payload.rows.filter((row) => row?.status === 'change');
  const seenIds = new Set();
  for (const row of changeRows) {
    if (!Number.isInteger(Number(row.product_id)) || Number(row.product_id) < 1) {
      throw new Error('Backup contains an invalid product_id.');
    }
    if (seenIds.has(Number(row.product_id))) {
      throw new Error(`Backup contains duplicate product id ${row.product_id}.`);
    }
    if (typeof row.old_name !== 'string' || typeof row.proposed_new_name !== 'string') {
      throw new Error(`Backup contains invalid names for product id ${row.product_id}.`);
    }
    if (
      typeof row.sku !== 'string' ||
      !['2nd', 'new'].includes(row.classification) ||
      typeof row.reason !== 'string'
    ) {
      throw new Error(`Backup contains invalid classification data for product id ${row.product_id}.`);
    }
    const recomputed = planProductNameChange(
      { id: row.product_id, sku: row.sku, name: row.old_name },
      Number(payload.name_max_length)
    );
    if (
      recomputed.status !== 'change' ||
      recomputed.classification !== row.classification ||
      recomputed.proposed_new_name !== row.proposed_new_name
    ) {
      throw new Error(`Backup change data does not match SKU rules for product id ${row.product_id}.`);
    }
    seenIds.add(Number(row.product_id));
  }
  return changeRows;
}

async function buildRestorePlan(connection, backupRows, nameMaxLength) {
  if (!backupRows.length) return [];
  const ids = backupRows.map((row) => Number(row.product_id));
  const placeholders = ids.map(() => '?').join(',');
  const [currentRows] = await connection.query(
    `SELECT id, name FROM products WHERE id IN (${placeholders})`,
    ids
  );
  const currentById = new Map(currentRows.map((row) => [Number(row.id), String(row.name)]));

  return backupRows.map((row) => {
    const productId = Number(row.product_id);
    const currentName = currentById.get(productId);
    if (currentName === undefined) {
      return { ...row, restore_status: 'missing', restore_reason: 'Product no longer exists.' };
    }
    if (getCharacterLength(row.old_name) > nameMaxLength) {
      return { ...row, restore_status: 'length_violation', restore_reason: 'Original name exceeds current column length.' };
    }
    if (currentName === row.old_name) {
      return { ...row, restore_status: 'already_restored', restore_reason: 'Original name is already present.' };
    }
    if (currentName !== row.proposed_new_name) {
      return { ...row, restore_status: 'conflict', restore_reason: 'Current name differs from both backup values.' };
    }
    return { ...row, restore_status: 'restore', restore_reason: 'Restore original name.' };
  });
}

function summarizeRestore(rows) {
  return {
    rows_in_backup: rows.length,
    rows_that_would_restore: rows.filter((row) => row.restore_status === 'restore').length,
    already_restored: rows.filter((row) => row.restore_status === 'already_restored').length,
    conflicting_current_names: rows.filter((row) => row.restore_status === 'conflict').length,
    missing_products: rows.filter((row) => row.restore_status === 'missing').length,
    names_exceeding_column_length: rows.filter((row) => row.restore_status === 'length_violation').length
  };
}

async function restoreNames(connection, restoreRows) {
  let affectedRows = 0;
  await connection.beginTransaction();
  try {
    for (const row of restoreRows) {
      const [result] = await connection.query(
        'UPDATE products SET name = ? WHERE id = ? AND name = ?',
        [row.old_name, Number(row.product_id), row.proposed_new_name]
      );
      if (result.affectedRows !== 1) {
        throw new Error(`Concurrent edit or missing product detected for id ${row.product_id}.`);
      }
      affectedRows += result.affectedRows;
    }
    if (affectedRows !== restoreRows.length) {
      throw new Error(`Affected-row mismatch: expected ${restoreRows.length}, received ${affectedRows}.`);
    }
    await connection.commit();
    return affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

function printHelp() {
  console.log(`Usage:
  node backend/scripts/product-name-suffixes.js --dry-run
  node backend/scripts/product-name-suffixes.js --apply --confirm ${APPLY_CONFIRMATION}
  node backend/scripts/product-name-suffixes.js --restore <backup-file>
  node backend/scripts/product-name-suffixes.js --restore <backup-file> --confirm ${RESTORE_CONFIRMATION}`);
}

async function runPreviewOrApply(options, connection) {
  if (options.mode === 'apply' && options.confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`--apply requires --confirm ${APPLY_CONFIRMATION}.`);
  }

  const nameMaxLength = await getNameMaxLength(connection);
  const products = await readProducts(connection);
  const rows = products.map((product) => planProductNameChange(product, nameMaxLength));
  const summary = summarizePreview(rows);
  const previewFile = await writePreviewFile(options.outputDir, nameMaxLength, rows, summary);
  printSummary(options.mode === 'apply' ? 'Apply plan' : 'Dry-run summary', summary);
  console.log(`- preview_backup_file: ${previewFile}`);

  if (options.mode === 'dry-run') {
    console.log('\nDry-run only. No database rows were changed.');
    return;
  }

  if (summary.names_exceeding_column_length > 0) {
    throw new Error('Apply refused because one or more proposed names exceed the column length.');
  }

  const plannedRows = rows.filter((row) => row.status === 'change');
  const affectedRows = await applyChanges(connection, plannedRows);
  console.log(`\nApply committed. Updated rows: ${affectedRows}`);
  console.log(`Restore with: node backend/scripts/product-name-suffixes.js --restore "${previewFile}"`);
}

async function runRestore(options, connection) {
  const raw = await fs.readFile(options.restoreFile, 'utf8');
  const payload = JSON.parse(raw.replace(/^\uFEFF/, ''));
  const backupRows = validateBackup(payload);
  const nameMaxLength = await getNameMaxLength(connection);
  const restorePlan = await buildRestorePlan(connection, backupRows, nameMaxLength);
  const summary = summarizeRestore(restorePlan);
  printSummary('Restore preview', summary);

  if (options.confirmation !== RESTORE_CONFIRMATION) {
    console.log(`\nRestore dry-run only. To apply, add --confirm ${RESTORE_CONFIRMATION}.`);
    return;
  }

  if (
    summary.conflicting_current_names > 0 ||
    summary.missing_products > 0 ||
    summary.names_exceeding_column_length > 0
  ) {
    throw new Error('Restore refused because the preview contains conflicts, missing products, or length violations.');
  }

  const rowsToRestore = restorePlan.filter((row) => row.restore_status === 'restore');
  const affectedRows = await restoreNames(connection, rowsToRestore);
  console.log(`\nRestore committed. Restored rows: ${affectedRows}`);
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
    if (options.mode === 'restore') {
      await runRestore(options, connection);
    } else {
      await runPreviewOrApply(options, connection);
    }
  } finally {
    connection?.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Product-name suffix maintenance failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_CONFIRMATION,
  RESTORE_CONFIRMATION,
  classifySku,
  getTrailingConditionSuffix,
  parseArguments,
  planProductNameChange,
  summarizePreview,
  summarizeRestore,
  validateBackup
};
