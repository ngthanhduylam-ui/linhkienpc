const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { parsePagination, parseNullableInt, parseBooleanQuery, escapeLike } = require('../../utils/parsers');
const { buildAdjustedNoteGroupMap } = require('../../utils/inventoryNoteGroups');

async function getProductById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        p.id, p.sku, p.name, p.category_id, p.spec_summary, p.is_active, p.created_at, p.updated_at,
        c.code AS category_code, c.name AS category_name, c.is_active AS category_is_active,
        COALESCE(pib.quantity, 0) AS total_quantity
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      WHERE p.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    throw new AppError('Product not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const row = rows[0];
  const noteGroupMap = await buildAdjustedNoteGroupMap([row.id]);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category_id: row.category_id,
    category: {
      id: row.category_id,
      code: row.category_code,
      name: row.category_name,
      is_active: row.category_is_active === 1
    },
    category_is_active: row.category_is_active === 1,
    spec_summary: row.spec_summary,
    total_quantity: Number(row.total_quantity || 0),
    note_groups: noteGroupMap.get(row.id) || [],
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function ensureCategoryExists(categoryId) {
  const [rows] = await pool.query('SELECT id FROM categories WHERE id = ? LIMIT 1', [categoryId]);
  if (!rows.length) {
    throw new AppError('Category not found.', 404, 'RESOURCE_NOT_FOUND');
  }
}

async function listAdminProducts(query) {
  const { page, limit, offset } = parsePagination(query);
  const q = (query.q || '').trim();
  const categoryId = parseNullableInt(query.category_id, 'category_id');
  const isActive = parseBooleanQuery(query.is_active, true);

  const whereParts = [];
  const params = [];

  if (isActive !== null) {
    whereParts.push('p.is_active = ?');
    params.push(isActive ? 1 : 0);
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

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${whereSql}`, params);
  const [rows] = await pool.query(
    `
      SELECT
        p.id, p.sku, p.name, p.category_id, p.spec_summary, p.is_active, p.created_at, p.updated_at,
        c.code AS category_code, c.name AS category_name, c.is_active AS category_is_active,
        COALESCE(pib.quantity, 0) AS total_quantity
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );
  const noteGroupMap = await buildAdjustedNoteGroupMap(rows.map((row) => row.id));

  return {
    items: rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      category_id: row.category_id,
      category: {
        id: row.category_id,
        code: row.category_code,
        name: row.category_name,
        is_active: row.category_is_active === 1
      },
      category_is_active: row.category_is_active === 1,
      spec_summary: row.spec_summary,
      total_quantity: Number(row.total_quantity || 0),
      note_groups: noteGroupMap.get(row.id) || [],
      is_active: row.is_active === 1,
      created_at: row.created_at,
      updated_at: row.updated_at
    })),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

async function createProduct(payload) {
  const { sku, name, category_id, spec_summary = null, is_active = true } = payload;
  await ensureCategoryExists(category_id);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
      INSERT INTO products (sku, name, category_id, spec_summary, is_active)
      VALUES (?, ?, ?, ?, ?)
    `,
      [sku.trim(), name.trim(), category_id, spec_summary, is_active ? 1 : 0]
    );

    await connection.query(
      `
      INSERT INTO product_inventory_balances (product_id, quantity)
      VALUES (?, 0)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
    `,
      [result.insertId]
    );

    await connection.commit();

    return getProductById(result.insertId);
  } catch (error) {
    await connection.rollback();
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('SKU already exists.', 409, 'SKU_ALREADY_EXISTS');
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function updateProduct(id, payload) {
  const current = await getProductById(id);

  let nextCategoryId = current.category_id;
  if (payload.category_id !== undefined) {
    await ensureCategoryExists(payload.category_id);
    nextCategoryId = payload.category_id;
  }

  const updates = {
    sku: payload.sku !== undefined ? payload.sku.trim() : current.sku,
    name: payload.name !== undefined ? payload.name.trim() : current.name,
    category_id: nextCategoryId,
    spec_summary: payload.spec_summary !== undefined ? payload.spec_summary : current.spec_summary,
    is_active: payload.is_active !== undefined ? (payload.is_active ? 1 : 0) : (current.is_active ? 1 : 0)
  };

  try {
    await pool.query(
      `
        UPDATE products
        SET sku = ?, name = ?, category_id = ?, spec_summary = ?, is_active = ?
        WHERE id = ?
      `,
      [updates.sku, updates.name, updates.category_id, updates.spec_summary, updates.is_active, id]
    );
    return getProductById(id);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('SKU already exists.', 409, 'SKU_ALREADY_EXISTS');
    }
    throw error;
  }
}

async function setProductActive(id, isActive) {
  await getProductById(id);
  await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return getProductById(id);
}

async function searchPublicProducts(query) {
  const { page, limit, offset } = parsePagination(query);
  const q = (query.q || '').trim();

  const whereParts = ['p.is_active = 1'];
  const params = [];

  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    whereParts.push(`(
      p.sku LIKE ?
      OR p.name LIKE ?
      OR EXISTS (
        SELECT 1
        FROM stock_transactions stx
        WHERE stx.product_id = p.id
          AND stx.txn_type = 'IN'
          AND stx.note LIKE ?
      )
    )`);
    params.push(pattern, pattern, pattern);
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

  const [products] = await pool.query(
    `
      SELECT
        p.id,
        p.sku,
        p.name,
        COALESCE(pib.quantity, 0) AS total_quantity
      FROM products p
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const noteGroupMap = await buildAdjustedNoteGroupMap(products.map((item) => item.id));

  return {
    items: products.map((product) => ({
      sku: product.sku,
      name: product.name,
      total_quantity: Number(product.total_quantity || 0),
      note_groups: noteGroupMap.get(product.id) || []
    })),
    page,
    limit,
    total: Number(countRows[0].total || 0),
    searchMode: 'fuzzy_contains'
  };
}

async function getPublicInventoryBySku(sku) {
  const [products] = await pool.query(
    `
      SELECT p.id, p.sku, p.name, p.is_active, COALESCE(pib.quantity, 0) AS total_quantity
      FROM products p
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      WHERE p.sku = ? AND p.is_active = 1
      LIMIT 1
    `,
    [sku]
  );

  if (!products.length) {
    throw new AppError('SKU not found.', 404, 'SKU_NOT_FOUND');
  }

  const product = products[0];
  const noteGroupMap = await buildAdjustedNoteGroupMap([product.id]);

  return {
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      total_quantity: Number(product.total_quantity || 0),
      is_active: product.is_active === 1
    },
    note_groups: noteGroupMap.get(product.id) || []
  };
}

module.exports = {
  listAdminProducts,
  getProductById,
  createProduct,
  updateProduct,
  setProductActive,
  searchPublicProducts,
  getPublicInventoryBySku
};
