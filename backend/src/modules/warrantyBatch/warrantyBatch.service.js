const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { parsePagination, parseBooleanQuery } = require('../../utils/parsers');

async function ensureProductExists(productId) {
  const [rows] = await pool.query('SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
  if (!rows.length) {
    throw new AppError('Product not found.', 404, 'RESOURCE_NOT_FOUND');
  }
}

async function getBatchById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        wb.id, wb.product_id, wb.batch_code, wb.warranty_end_month, wb.warranty_end_year,
        wb.is_active, wb.created_at, wb.updated_at, COALESCE(ib.quantity, 0) AS quantity
      FROM warranty_batches wb
      LEFT JOIN inventory_balances ib
        ON ib.product_id = wb.product_id
       AND ib.warranty_batch_id = wb.id
      WHERE wb.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    throw new AppError('Warranty batch not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const row = rows[0];
  return {
    id: row.id,
    product_id: row.product_id,
    batch_code: row.batch_code,
    warranty_end_month: row.warranty_end_month,
    warranty_end_year: row.warranty_end_year,
    is_active: row.is_active === 1,
    quantity: Number(row.quantity),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function listBatchesByProduct(productId, query) {
  await ensureProductExists(productId);
  const { page, limit, offset } = parsePagination(query);
  const isActive = parseBooleanQuery(query.is_active, true);

  const whereParts = ['wb.product_id = ?'];
  const params = [productId];

  if (isActive !== null) {
    whereParts.push('wb.is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM warranty_batches wb ${whereSql}`, params);

  const [rows] = await pool.query(
    `
      SELECT
        wb.id, wb.product_id, wb.batch_code, wb.warranty_end_month, wb.warranty_end_year,
        wb.is_active, wb.created_at, wb.updated_at, COALESCE(ib.quantity, 0) AS quantity
      FROM warranty_batches wb
      LEFT JOIN inventory_balances ib
        ON ib.product_id = wb.product_id
       AND ib.warranty_batch_id = wb.id
      ${whereSql}
      ORDER BY wb.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      product_id: row.product_id,
      batch_code: row.batch_code,
      warranty_end_month: row.warranty_end_month,
      warranty_end_year: row.warranty_end_year,
      is_active: row.is_active === 1,
      quantity: Number(row.quantity),
      created_at: row.created_at,
      updated_at: row.updated_at
    })),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

async function createBatch(productId, payload) {
  await ensureProductExists(productId);
  const { batch_code, warranty_end_month = null, warranty_end_year = null, is_active = true } = payload;

  try {
    const [result] = await pool.query(
      `
        INSERT INTO warranty_batches (product_id, batch_code, warranty_end_month, warranty_end_year, is_active)
        VALUES (?, ?, ?, ?, ?)
      `,
      [productId, batch_code.trim(), warranty_end_month, warranty_end_year, is_active ? 1 : 0]
    );

    await pool.query(
      `
        INSERT INTO inventory_balances (product_id, warranty_batch_id, quantity)
        VALUES (?, ?, 0)
        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
      `,
      [productId, result.insertId]
    );

    return getBatchById(result.insertId);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('Batch code already exists for this SKU.', 409, 'BATCH_CODE_ALREADY_EXISTS_FOR_PRODUCT');
    }
    throw error;
  }
}

async function updateBatch(id, payload) {
  const current = await getBatchById(id);

  const updates = {
    batch_code: payload.batch_code !== undefined ? payload.batch_code.trim() : current.batch_code,
    warranty_end_month: payload.warranty_end_month !== undefined ? payload.warranty_end_month : current.warranty_end_month,
    warranty_end_year: payload.warranty_end_year !== undefined ? payload.warranty_end_year : current.warranty_end_year,
    is_active: payload.is_active !== undefined ? (payload.is_active ? 1 : 0) : (current.is_active ? 1 : 0)
  };

  try {
    await pool.query(
      `
        UPDATE warranty_batches
        SET batch_code = ?, warranty_end_month = ?, warranty_end_year = ?, is_active = ?
        WHERE id = ?
      `,
      [updates.batch_code, updates.warranty_end_month, updates.warranty_end_year, updates.is_active, id]
    );
    return getBatchById(id);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('Batch code already exists for this SKU.', 409, 'BATCH_CODE_ALREADY_EXISTS_FOR_PRODUCT');
    }
    throw error;
  }
}

async function setBatchActive(id, isActive) {
  await getBatchById(id);
  await pool.query('UPDATE warranty_batches SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return getBatchById(id);
}

module.exports = {
  listBatchesByProduct,
  createBatch,
  getBatchById,
  updateBatch,
  setBatchActive
};
