const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { parsePagination, parseNullableInt, parseBooleanQuery, escapeLike } = require('../../utils/parsers');

async function getInventoryOverview(query) {
  const { page, limit, offset } = parsePagination(query);
  const productId = parseNullableInt(query.product_id, 'product_id');
  const categoryId = parseNullableInt(query.category_id, 'category_id');
  const includeInactive = parseBooleanQuery(query.include_inactive, false);
  const batchCode = (query.batch_code || '').trim();

  const whereParts = ['1=1'];
  const params = [];

  if (!includeInactive) {
    whereParts.push('p.is_active = 1');
    whereParts.push('wb.is_active = 1');
  }

  if (productId !== null) {
    whereParts.push('p.id = ?');
    params.push(productId);
  }

  if (categoryId !== null) {
    whereParts.push('p.category_id = ?');
    params.push(categoryId);
  }

  if (batchCode) {
    whereParts.push('wb.batch_code LIKE ?');
    params.push(`%${escapeLike(batchCode)}%`);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM inventory_balances ib
      JOIN products p ON p.id = ib.product_id
      JOIN warranty_batches wb ON wb.id = ib.warranty_batch_id
      ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
      SELECT
        ib.id,
        ib.product_id,
        ib.warranty_batch_id,
        ib.quantity,
        ib.updated_at,
        p.sku,
        p.name AS product_name,
        p.is_active AS product_is_active,
        c.id AS category_id,
        c.code AS category_code,
        c.name AS category_name,
        c.is_active AS category_is_active,
        wb.batch_code,
        wb.is_active AS batch_is_active
      FROM inventory_balances ib
      JOIN products p ON p.id = ib.product_id
      JOIN categories c ON c.id = p.category_id
      JOIN warranty_batches wb ON wb.id = ib.warranty_batch_id
      ${whereSql}
      ORDER BY ib.updated_at DESC, ib.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map((row) => ({
      inventory_id: row.id,
      product_id: row.product_id,
      warranty_batch_id: row.warranty_batch_id,
      sku: row.sku,
      product_name: row.product_name,
      product_is_active: row.product_is_active === 1,
      category: {
        id: row.category_id,
        code: row.category_code,
        name: row.category_name,
        is_active: row.category_is_active === 1
      },
      batch_code: row.batch_code,
      batch_is_active: row.batch_is_active === 1,
      quantity: Number(row.quantity),
      updated_at: row.updated_at
    })),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

async function resolveSkuBatchForTransaction(connection, { sku, batch_code }) {
  const [products] = await connection.query(
    `
      SELECT id, sku, is_active
      FROM products
      WHERE sku = ?
      LIMIT 1
    `,
    [sku]
  );

  if (!products.length) {
    throw new AppError('SKU not found.', 404, 'SKU_NOT_FOUND');
  }

  const product = products[0];
  if (product.is_active !== 1) {
    throw new AppError('Product is inactive.', 400, 'PRODUCT_INACTIVE');
  }

  if (batch_code) {
    const [rows] = await connection.query(
      `
        SELECT id, batch_code, is_active
        FROM warranty_batches
        WHERE product_id = ? AND batch_code = ?
        LIMIT 1
      `,
      [product.id, batch_code]
    );

    if (!rows.length) {
      throw new AppError('Batch code not found for SKU.', 404, 'BATCH_CODE_NOT_FOUND_FOR_SKU');
    }

    if (rows[0].is_active !== 1) {
      throw new AppError('Batch is inactive.', 400, 'BATCH_INACTIVE');
    }

    return {
      product_id: product.id,
      warranty_batch_id: rows[0].id,
      sku: product.sku,
      batch_code: rows[0].batch_code
    };
  }

  const [activeBatches] = await connection.query(
    `
      SELECT id, batch_code
      FROM warranty_batches
      WHERE product_id = ? AND is_active = 1
      ORDER BY id ASC
    `,
    [product.id]
  );

  if (!activeBatches.length) {
    throw new AppError('No active batch found for SKU.', 400, 'BATCH_CODE_NOT_FOUND_FOR_SKU');
  }

  if (activeBatches.length > 1) {
    throw new AppError('SKU has multiple active batches. batch_code is required.', 400, 'BATCH_CODE_REQUIRED');
  }

  return {
    product_id: product.id,
    warranty_batch_id: activeBatches[0].id,
    sku: product.sku,
    batch_code: activeBatches[0].batch_code
  };
}

module.exports = {
  getInventoryOverview,
  resolveSkuBatchForTransaction
};
