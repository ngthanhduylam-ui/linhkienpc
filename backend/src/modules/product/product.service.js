const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { parsePagination, parseNullableInt, parseBooleanQuery, escapeLike } = require('../../utils/parsers');

async function getProductById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        p.id, p.sku, p.name, p.category_id, p.spec_summary, p.is_active, p.created_at, p.updated_at,
        c.code AS category_code, c.name AS category_name, c.is_active AS category_is_active
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    throw new AppError('Product not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  const row = rows[0];
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
        c.code AS category_code, c.name AS category_name, c.is_active AS category_is_active
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

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

  try {
    const [result] = await pool.query(
      `
        INSERT INTO products (sku, name, category_id, spec_summary, is_active)
        VALUES (?, ?, ?, ?, ?)
      `,
      [sku.trim(), name.trim(), category_id, spec_summary, is_active ? 1 : 0]
    );
    return getProductById(result.insertId);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('SKU already exists.', 409, 'SKU_ALREADY_EXISTS');
    }
    throw error;
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
    whereParts.push('(p.sku LIKE ? OR p.name LIKE ? OR wb_search.batch_code LIKE ?)');
    params.push(pattern, pattern, pattern);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await pool.query(
    `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      LEFT JOIN warranty_batches wb_search
        ON wb_search.product_id = p.id
       AND wb_search.is_active = 1
      ${whereSql}
    `,
    params
  );

  const [products] = await pool.query(
    `
      SELECT p.id, p.sku, p.name
      FROM products p
      LEFT JOIN warranty_batches wb_search
        ON wb_search.product_id = p.id
       AND wb_search.is_active = 1
      ${whereSql}
      GROUP BY p.id, p.sku, p.name
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  if (!products.length) {
    return {
      items: [],
      page,
      limit,
      total: Number(countRows[0].total || 0),
      searchMode: 'fuzzy_contains'
    };
  }

  const productIds = products.map((item) => item.id);
  const placeholders = productIds.map(() => '?').join(',');

  const [batchRows] = await pool.query(
    `
      SELECT
        wb.product_id,
        wb.batch_code,
        COALESCE(ib.quantity, 0) AS quantity
      FROM warranty_batches wb
      LEFT JOIN inventory_balances ib
        ON ib.product_id = wb.product_id
       AND ib.warranty_batch_id = wb.id
      WHERE wb.product_id IN (${placeholders})
        AND wb.is_active = 1
      ORDER BY wb.batch_code ASC
    `,
    productIds
  );

  const batchMap = new Map();
  for (const row of batchRows) {
    if (!batchMap.has(row.product_id)) {
      batchMap.set(row.product_id, []);
    }
    batchMap.get(row.product_id).push({
      batch_code: row.batch_code,
      quantity: Number(row.quantity || 0)
    });
  }

  return {
    items: products.map((product) => {
      const batches = batchMap.get(product.id) || [];
      const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
      return {
        sku: product.sku,
        name: product.name,
        total_quantity: totalQuantity,
        batches
      };
    }),
    page,
    limit,
    total: Number(countRows[0].total || 0),
    searchMode: 'fuzzy_contains'
  };
}

async function getPublicInventoryBySku(sku) {
  const [products] = await pool.query(
    `
      SELECT id, sku, name, is_active
      FROM products
      WHERE sku = ? AND is_active = 1
      LIMIT 1
    `,
    [sku]
  );

  if (!products.length) {
    throw new AppError('SKU not found.', 404, 'SKU_NOT_FOUND');
  }

  const product = products[0];
  const [rows] = await pool.query(
    `
      SELECT
        wb.id AS warranty_batch_id,
        wb.batch_code,
        wb.is_active,
        COALESCE(ib.quantity, 0) AS quantity,
        COALESCE(ib.updated_at, wb.updated_at) AS updated_at
      FROM warranty_batches wb
      LEFT JOIN inventory_balances ib
        ON ib.product_id = wb.product_id
       AND ib.warranty_batch_id = wb.id
      WHERE wb.product_id = ?
        AND wb.is_active = 1
      ORDER BY wb.batch_code ASC
    `,
    [product.id]
  );

  return {
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      is_active: product.is_active === 1
    },
    batches: rows.map((row) => ({
      warranty_batch_id: row.warranty_batch_id,
      batch_code: row.batch_code,
      is_active: row.is_active === 1,
      quantity: Number(row.quantity),
      updated_at: row.updated_at
    }))
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
