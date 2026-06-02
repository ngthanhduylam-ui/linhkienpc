const { pool } = require('../../config/database');
const { parsePagination, parseNullableInt, parseBooleanQuery, escapeLike } = require('../../utils/parsers');

async function getInventoryOverview(query) {
  const { page, limit, offset } = parsePagination(query);
  const productId = parseNullableInt(query.product_id, 'product_id');
  const categoryId = parseNullableInt(query.category_id, 'category_id');
  const includeInactive = parseBooleanQuery(query.include_inactive, false);
  const q = (query.q || '').trim();

  const whereParts = ['1=1'];
  const params = [];

  if (!includeInactive) {
    whereParts.push('p.is_active = 1');
  }

  if (productId !== null) {
    whereParts.push('p.id = ?');
    params.push(productId);
  }

  if (categoryId !== null) {
    whereParts.push('p.category_id = ?');
    params.push(categoryId);
  }

  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    whereParts.push('(p.sku LIKE ? OR p.name LIKE ?)');
    params.push(pattern, pattern);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM products p
      ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
      SELECT
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        p.is_active AS product_is_active,
        c.id AS category_id,
        c.code AS category_code,
        c.name AS category_name,
        c.is_active AS category_is_active,
        COALESCE(pib.quantity, 0) AS total_quantity,
        COALESCE(pib.updated_at, p.updated_at) AS updated_at
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map((row) => ({
      product_id: row.product_id,
      sku: row.sku,
      product_name: row.product_name,
      product_is_active: row.product_is_active === 1,
      category: {
        id: row.category_id,
        code: row.category_code,
        name: row.category_name,
        is_active: row.category_is_active === 1
      },
      total_quantity: Number(row.total_quantity || 0),
      updated_at: row.updated_at
    })),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

module.exports = {
  getInventoryOverview
};
