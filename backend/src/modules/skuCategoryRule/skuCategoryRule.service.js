const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');

const MAX_TOKEN_LENGTH = 64;

function normalizeToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validateToken(value) {
  const token = normalizeToken(value);

  if (!token) {
    throw new AppError('Token is required.', 400, 'VALIDATION_ERROR', [
      { field: 'body.token', issue: 'token is required' }
    ]);
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new AppError('Token must be at most 64 characters.', 400, 'VALIDATION_ERROR', [
      { field: 'body.token', issue: 'token exceeds 64 characters' }
    ]);
  }
  if (token.includes('.')) {
    throw new AppError('Token cannot contain a dot.', 400, 'VALIDATION_ERROR', [
      { field: 'body.token', issue: 'token cannot contain a dot' }
    ]);
  }
  if (/\s/.test(token)) {
    throw new AppError('Token cannot contain whitespace.', 400, 'VALIDATION_ERROR', [
      { field: 'body.token', issue: 'token cannot contain whitespace' }
    ]);
  }

  return token;
}

function validateCategoryId(value) {
  const categoryId = Number(value);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    throw new AppError('A valid category is required.', 400, 'VALIDATION_ERROR', [
      { field: 'body.category_id', issue: 'category_id must be a positive integer' }
    ]);
  }
  return categoryId;
}

function mapRule(row) {
  return {
    id: Number(row.id),
    token: row.token,
    category_id: row.category_id === null ? null : Number(row.category_id),
    category_name: row.category_name || null,
    category_is_active: row.category_is_active === null ? null : row.category_is_active === 1,
    category_available: row.category_id !== null && row.category_name !== null && row.category_is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function ensureCategoryExists(categoryId) {
  const [rows] = await pool.query(
    'SELECT id FROM categories WHERE id = ? LIMIT 1',
    [categoryId]
  );
  if (!rows.length) {
    throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
  }
}

async function ensureTokenAvailable(token, excludeId = null) {
  const params = [token];
  let excludeSql = '';
  if (excludeId !== null) {
    excludeSql = ' AND id <> ?';
    params.push(excludeId);
  }

  const [rows] = await pool.query(
    `SELECT id FROM sku_category_rules WHERE token = ?${excludeSql} LIMIT 1`,
    params
  );
  if (rows.length) {
    throw new AppError(
      'Token already has a category suggestion rule.',
      409,
      'SKU_CATEGORY_RULE_TOKEN_EXISTS',
      [{ field: 'body.token', issue: 'token must be unique' }]
    );
  }
}

async function listRules() {
  const [rows] = await pool.query(`
    SELECT
      r.id,
      r.token,
      r.category_id,
      c.name AS category_name,
      c.is_active AS category_is_active,
      r.created_at,
      r.updated_at
    FROM sku_category_rules r
    LEFT JOIN categories c ON c.id = r.category_id
    ORDER BY r.token ASC, r.id ASC
  `);
  return rows.map(mapRule);
}

async function getRuleById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        r.id,
        r.token,
        r.category_id,
        c.name AS category_name,
        c.is_active AS category_is_active,
        r.created_at,
        r.updated_at
      FROM sku_category_rules r
      LEFT JOIN categories c ON c.id = r.category_id
      WHERE r.id = ?
      LIMIT 1
    `,
    [id]
  );
  if (!rows.length) {
    throw new AppError('SKU category rule not found.', 404, 'RESOURCE_NOT_FOUND');
  }
  return mapRule(rows[0]);
}

function translateDuplicateError(error) {
  if (error?.code === 'ER_DUP_ENTRY') {
    throw new AppError(
      'Token already has a category suggestion rule.',
      409,
      'SKU_CATEGORY_RULE_TOKEN_EXISTS',
      [{ field: 'body.token', issue: 'token must be unique' }]
    );
  }
  throw error;
}

async function createRule(payload) {
  const token = validateToken(payload?.token);
  const categoryId = validateCategoryId(payload?.category_id);
  await ensureCategoryExists(categoryId);
  await ensureTokenAvailable(token);

  try {
    const [result] = await pool.query(
      'INSERT INTO sku_category_rules (token, category_id) VALUES (?, ?)',
      [token, categoryId]
    );
    return getRuleById(result.insertId);
  } catch (error) {
    translateDuplicateError(error);
  }
}

async function updateRule(id, payload) {
  const current = await getRuleById(id);
  const token = payload?.token === undefined ? current.token : validateToken(payload.token);
  const categoryId = payload?.category_id === undefined
    ? validateCategoryId(current.category_id)
    : validateCategoryId(payload.category_id);
  await ensureCategoryExists(categoryId);
  await ensureTokenAvailable(token, id);

  try {
    const [result] = await pool.query(
      'UPDATE sku_category_rules SET token = ?, category_id = ? WHERE id = ?',
      [token, categoryId, id]
    );
    if (result.affectedRows !== 1) {
      throw new AppError('SKU category rule not found.', 404, 'RESOURCE_NOT_FOUND');
    }
    return getRuleById(id);
  } catch (error) {
    translateDuplicateError(error);
  }
}

async function deleteRule(id) {
  const current = await getRuleById(id);
  const [result] = await pool.query('DELETE FROM sku_category_rules WHERE id = ?', [id]);
  if (result.affectedRows !== 1) {
    throw new AppError('SKU category rule not found.', 404, 'RESOURCE_NOT_FOUND');
  }
  return current;
}

module.exports = {
  normalizeToken,
  validateToken,
  validateCategoryId,
  ensureTokenAvailable,
  listRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule
};
