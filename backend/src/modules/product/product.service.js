const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { parsePagination, parseNullableInt, parseBooleanQuery, escapeLike } = require('../../utils/parsers');
const { buildAdjustedNoteGroupMap } = require('../../utils/inventoryNoteGroups');

const MAX_SEARCH_TOKENS = 8;
const DEFAULT_PUBLIC_SUGGESTION_LIMIT = 6;
const MAX_PUBLIC_SUGGESTION_LIMIT = 12;
const MAX_PUBLIC_SUGGESTION_EXCLUSIONS = 24;
const COMPACT_SKU_SQL = "REPLACE(REPLACE(REPLACE(LOWER(p.sku), '.', ''), '-', ''), ' ', '')";
const COMPACT_NAME_SQL = "REPLACE(REPLACE(REPLACE(LOWER(p.name), '.', ''), '-', ''), ' ', '')";

function getSearchTokens(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TOKENS);
}

function compactSearchToken(value) {
  return value.replace(/[.\-\s]/g, '');
}

function buildProductTokenSearch(tokens, { includeCategory = false, includeWarrantyNote = false } = {}) {
  const clauses = [];
  const params = [];

  for (const token of tokens) {
    const escapedToken = escapeLike(token);
    const rawPattern = `%${escapedToken}%`;
    const compactToken = compactSearchToken(token);
    const tokenClauses = [
      'LOWER(p.sku) LIKE ?',
      'LOWER(p.name) LIKE ?'
    ];
    const tokenParams = [rawPattern, rawPattern];

    if (compactToken) {
      const compactPattern = `%${escapeLike(compactToken)}%`;
      tokenClauses.push(`${COMPACT_SKU_SQL} LIKE ?`, `${COMPACT_NAME_SQL} LIKE ?`);
      tokenParams.push(compactPattern, compactPattern);
    }

    if (includeCategory) {
      tokenClauses.push('LOWER(c.name) LIKE ?');
      tokenParams.push(rawPattern);
    }

    if (includeWarrantyNote) {
      tokenClauses.push(`EXISTS (
        SELECT 1
        FROM stock_transactions stx
        WHERE stx.product_id = p.id
          AND stx.txn_type = 'IN'
          AND LOWER(stx.note) LIKE ?
      )`);
      tokenParams.push(rawPattern);
    }

    clauses.push(`(${tokenClauses.join(' OR ')})`);
    params.push(...tokenParams);
  }

  return { clauses, params };
}

function mapSalePrice(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

function mapImageSummary(row) {
  const imageCount = Number(row.image_count || 0);
  return {
    image_count: imageCount,
    primary_image_id: row.primary_image_id ? Number(row.primary_image_id) : null
  };
}

function mapPublicCondition(sku) {
  const firstToken = String(sku || '').trim().toLowerCase().split(/[.\s_-]+/)[0];
  if (firstToken === '2nd') return '2nd';
  if (firstToken === 'new') return 'new';
  return null;
}

function parsePublicSuggestionLimit(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_PUBLIC_SUGGESTION_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PUBLIC_SUGGESTION_LIMIT) {
    throw new AppError(
      `limit must be an integer between 1 and ${MAX_PUBLIC_SUGGESTION_LIMIT}.`,
      400,
      'VALIDATION_ERROR'
    );
  }
  return parsed;
}

function parsePublicSuggestionExclusions(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value) || typeof value !== 'string') {
    throw new AppError('exclude_ids must be a comma-separated list of positive integers.', 400, 'VALIDATION_ERROR');
  }

  const parts = value.split(',').map((item) => item.trim());
  if (parts.length > MAX_PUBLIC_SUGGESTION_EXCLUSIONS) {
    throw new AppError(
      `exclude_ids cannot contain more than ${MAX_PUBLIC_SUGGESTION_EXCLUSIONS} values.`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const ids = [];
  const usedIds = new Set();
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      throw new AppError('exclude_ids must be a comma-separated list of positive integers.', 400, 'VALIDATION_ERROR');
    }
    const id = Number(part);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new AppError('exclude_ids must be a comma-separated list of positive integers.', 400, 'VALIDATION_ERROR');
    }
    if (!usedIds.has(id)) {
      usedIds.add(id);
      ids.push(id);
    }
  }
  return ids;
}

async function getProductById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        p.id, p.sku, p.name, p.category_id, p.spec_summary, p.sale_price, p.is_active, p.created_at, p.updated_at,
        c.code AS category_code, c.name AS category_name, c.is_active AS category_is_active,
        COALESCE(pib.quantity, 0) AS total_quantity,
        COALESCE(pim.image_count, 0) AS image_count,
        pim.primary_image_id
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      LEFT JOIN (
        SELECT
          product_id,
          COUNT(*) AS image_count,
          MAX(CASE WHEN sort_order = 1 THEN id END) AS primary_image_id
        FROM product_images
        GROUP BY product_id
      ) pim ON pim.product_id = p.id
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
    sale_price: mapSalePrice(row.sale_price),
    total_quantity: Number(row.total_quantity || 0),
    note_groups: noteGroupMap.get(row.id) || [],
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...mapImageSummary(row)
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
  const searchTokens = getSearchTokens(query.q);
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
  if (searchTokens.length) {
    const search = buildProductTokenSearch(searchTokens, { includeCategory: true });
    whereParts.push(...search.clauses);
    params.push(...search.params);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ${whereSql}
    `,
    params
  );
  const [rows] = await pool.query(
    `
      SELECT
        p.id, p.sku, p.name, p.category_id, p.spec_summary, p.sale_price, p.is_active, p.created_at, p.updated_at,
        c.code AS category_code, c.name AS category_name, c.is_active AS category_is_active,
        COALESCE(pib.quantity, 0) AS total_quantity,
        COALESCE(pim.image_count, 0) AS image_count,
        pim.primary_image_id
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      LEFT JOIN (
        SELECT
          product_id,
          COUNT(*) AS image_count,
          MAX(CASE WHEN sort_order = 1 THEN id END) AS primary_image_id
        FROM product_images
        GROUP BY product_id
      ) pim ON pim.product_id = p.id
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
      sale_price: mapSalePrice(row.sale_price),
      total_quantity: Number(row.total_quantity || 0),
      note_groups: noteGroupMap.get(row.id) || [],
      is_active: row.is_active === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
      ...mapImageSummary(row)
    })),
    page,
    limit,
    total: Number(countRows[0].total || 0),
    total_pages: Math.max(1, Math.ceil(Number(countRows[0].total || 0) / limit))
  };
}

async function createProduct(payload) {
  const { sku, name, category_id, spec_summary = null, sale_price = null, is_active = true } = payload;
  await ensureCategoryExists(category_id);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
      INSERT INTO products (sku, name, category_id, spec_summary, sale_price, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [sku.trim(), name.trim(), category_id, spec_summary, sale_price, is_active ? 1 : 0]
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
    sale_price: payload.sale_price !== undefined ? payload.sale_price : current.sale_price,
    is_active: payload.is_active !== undefined ? (payload.is_active ? 1 : 0) : (current.is_active ? 1 : 0)
  };

  try {
    await pool.query(
      `
        UPDATE products
        SET sku = ?, name = ?, category_id = ?, spec_summary = ?, sale_price = ?, is_active = ?
        WHERE id = ?
      `,
      [updates.sku, updates.name, updates.category_id, updates.spec_summary, updates.sale_price, updates.is_active, id]
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
  const searchTokens = getSearchTokens(query.q);
  const categoryId = parseNullableInt(query.category_id, 'category_id');
  const productId = parseNullableInt(query.product_id, 'product_id');

  if (!searchTokens.length && categoryId === null && productId === null) {
    return {
      items: [],
      page,
      limit,
      total: 0,
      hasHiddenOutOfStockMatches: false,
      searchMode: 'fuzzy_contains'
    };
  }

  const search = buildProductTokenSearch(searchTokens, { includeWarrantyNote: true });
  const whereParts = [
    'p.is_active = 1',
    'COALESCE(pib.quantity, 0) > 0'
  ];
  const params = [];

  if (categoryId !== null) {
    whereParts.push('p.category_id = ?');
    params.push(categoryId);
  }

  if (productId !== null) {
    whereParts.push('p.id = ?');
    params.push(productId);
  }

  whereParts.push(...search.clauses);
  params.push(...search.params);

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM products p
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      ${whereSql}
    `,
    params
  );
  const total = Number(countRows[0].total || 0);
  let hasHiddenOutOfStockMatches = false;

  if (total === 0 && searchTokens.length > 0) {
    const hiddenWhereParts = [
      'p.is_active = 1',
      'COALESCE(pib.quantity, 0) = 0'
    ];
    const hiddenParams = [];

    if (categoryId !== null) {
      hiddenWhereParts.push('p.category_id = ?');
      hiddenParams.push(categoryId);
    }

    if (productId !== null) {
      hiddenWhereParts.push('p.id = ?');
      hiddenParams.push(productId);
    }

    hiddenWhereParts.push(...search.clauses);
    hiddenParams.push(...search.params);

    const hiddenWhereSql = `WHERE ${hiddenWhereParts.join(' AND ')}`;
    const [hiddenMatchRows] = await pool.query(
      `
        SELECT EXISTS(
          SELECT 1
          FROM products p
          LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
          ${hiddenWhereSql}
          LIMIT 1
        ) AS has_hidden_match
      `,
      hiddenParams
    );
    hasHiddenOutOfStockMatches = Boolean(hiddenMatchRows[0]?.has_hidden_match);
  }

  const [products] = await pool.query(
    `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.spec_summary,
        c.name AS category_name,
        p.sale_price,
        COALESCE(pib.quantity, 0) AS total_quantity,
        COALESCE(pim.image_count, 0) AS image_count,
        pim.primary_image_id
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      LEFT JOIN (
        SELECT
          product_id,
          COUNT(*) AS image_count,
          MAX(CASE WHEN sort_order = 1 THEN id END) AS primary_image_id
        FROM product_images
        GROUP BY product_id
      ) pim ON pim.product_id = p.id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const noteGroupMap = await buildAdjustedNoteGroupMap(products.map((item) => item.id));

  return {
    items: products.map((product) => ({
      id: Number(product.id),
      name: product.name,
      condition: mapPublicCondition(product.sku),
      category_name: product.category_name,
      spec_summary: product.spec_summary,
      sale_price: mapSalePrice(product.sale_price),
      total_quantity: Number(product.total_quantity || 0),
      note_groups: noteGroupMap.get(product.id) || [],
      ...mapImageSummary(product)
    })),
    page,
    limit,
    total,
    hasHiddenOutOfStockMatches,
    searchMode: 'fuzzy_contains'
  };
}

async function queryRandomAvailableProducts(limit, excludedIds) {
  if (limit < 1) return [];

  const exclusionSql = excludedIds.length
    ? `AND p.id NOT IN (${excludedIds.map(() => '?').join(', ')})`
    : '';
  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.sku,
        p.name,
        c.name AS category_name,
        p.sale_price,
        COALESCE(pib.quantity, 0) AS total_quantity,
        COALESCE(pim.image_count, 0) AS image_count,
        pim.primary_image_id
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      LEFT JOIN (
        SELECT
          product_id,
          COUNT(*) AS image_count,
          MAX(CASE WHEN sort_order = 1 THEN id END) AS primary_image_id
        FROM product_images
        GROUP BY product_id
      ) pim ON pim.product_id = p.id
      WHERE p.is_active = 1
        AND COALESCE(pib.quantity, 0) > 0
        ${exclusionSql}
      ORDER BY RAND()
      LIMIT ?
    `,
    [...excludedIds, limit]
  );
  return rows;
}

async function listPublicCatalogueSuggestions(query) {
  const limit = parsePublicSuggestionLimit(query.limit);
  const excludedIds = parsePublicSuggestionExclusions(query.exclude_ids);
  const preferredRows = await queryRandomAvailableProducts(limit, excludedIds);
  let rows = preferredRows;

  if (rows.length < limit) {
    const selectedIds = rows.map((row) => Number(row.id));
    const fallbackRows = await queryRandomAvailableProducts(limit - rows.length, selectedIds);
    rows = [...rows, ...fallbackRows];
  }

  return {
    items: rows.map((product) => ({
      id: Number(product.id),
      name: product.name,
      condition: mapPublicCondition(product.sku),
      category_name: product.category_name,
      sale_price: mapSalePrice(product.sale_price),
      total_quantity: Number(product.total_quantity || 0),
      ...mapImageSummary(product)
    })),
    limit,
    excludedCount: excludedIds.length
  };
}

async function getPublicInventoryBySku(sku) {
  const [products] = await pool.query(
    `
      SELECT
        p.id, p.sku, p.name, p.is_active,
        COALESCE(pib.quantity, 0) AS total_quantity,
        COALESCE(pim.image_count, 0) AS image_count,
        pim.primary_image_id
      FROM products p
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      LEFT JOIN (
        SELECT
          product_id,
          COUNT(*) AS image_count,
          MAX(CASE WHEN sort_order = 1 THEN id END) AS primary_image_id
        FROM product_images
        GROUP BY product_id
      ) pim ON pim.product_id = p.id
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
      name: product.name,
      condition: mapPublicCondition(product.sku),
      total_quantity: Number(product.total_quantity || 0),
      is_active: product.is_active === 1,
      ...mapImageSummary(product)
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
  listPublicCatalogueSuggestions,
  getPublicInventoryBySku
};
