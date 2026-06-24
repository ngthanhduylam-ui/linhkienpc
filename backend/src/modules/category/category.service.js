const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { parsePagination, parseBooleanQuery, escapeLike } = require('../../utils/parsers');

async function listCategories(query) {
  const { page, limit, offset } = parsePagination(query);
  const isActive = parseBooleanQuery(query.is_active, true);
  const q = (query.q || '').trim();

  const whereParts = [];
  const params = [];

  if (isActive !== null) {
    whereParts.push('c.is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    whereParts.push('(c.code LIKE ? OR c.name LIKE ?)');
    params.push(pattern, pattern);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM categories c ${whereSql}`, params);

  const [rows] = await pool.query(
    `
      SELECT c.id, c.code, c.name, c.description, c.is_active, c.created_at, c.updated_at
      FROM categories c
      ${whereSql}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map((row) => ({ ...row, is_active: row.is_active === 1 })),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

async function getCategoryById(id) {
  const [rows] = await pool.query(
    `
      SELECT id, code, name, description, is_active, created_at, updated_at
      FROM categories
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    throw new AppError('Category not found.', 404, 'RESOURCE_NOT_FOUND');
  }

  return { ...rows[0], is_active: rows[0].is_active === 1 };
}

async function createCategory(payload) {
  const { code, name, description = null, is_active = true } = payload;

  try {
    const [result] = await pool.query(
      `
        INSERT INTO categories (code, name, description, is_active)
        VALUES (?, ?, ?, ?)
      `,
      [code.trim(), name.trim(), description ? description.trim() : null, is_active ? 1 : 0]
    );
    return getCategoryById(result.insertId);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('uk_categories_code')) {
        throw new AppError('Category code already exists.', 409, 'CATEGORY_CODE_ALREADY_EXISTS');
      }
      if (error.message.includes('uk_categories_name')) {
        throw new AppError('Category name already exists.', 409, 'CATEGORY_NAME_ALREADY_EXISTS');
      }
    }
    throw error;
  }
}

async function updateCategory(id, payload) {
  const current = await getCategoryById(id);

  const updates = {
    code: payload.code !== undefined ? payload.code.trim() : current.code,
    name: payload.name !== undefined ? payload.name.trim() : current.name,
    description: payload.description !== undefined ? payload.description : current.description,
    is_active: payload.is_active !== undefined ? (payload.is_active ? 1 : 0) : (current.is_active ? 1 : 0)
  };

  try {
    await pool.query(
      `
        UPDATE categories
        SET code = ?, name = ?, description = ?, is_active = ?
        WHERE id = ?
      `,
      [updates.code, updates.name, updates.description, updates.is_active, id]
    );
    return getCategoryById(id);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('uk_categories_code')) {
        throw new AppError('Category code already exists.', 409, 'CATEGORY_CODE_ALREADY_EXISTS');
      }
      if (error.message.includes('uk_categories_name')) {
        throw new AppError('Category name already exists.', 409, 'CATEGORY_NAME_ALREADY_EXISTS');
      }
    }
    throw error;
  }
}

async function setCategoryActive(id, isActive) {
  await getCategoryById(id);
  await pool.query('UPDATE categories SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return getCategoryById(id);
}

async function deleteCategory(id) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [categoryRows] = await connection.query(
      `
        SELECT id, code, name, description, is_active, created_at, updated_at
        FROM categories
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [id]
    );

    if (!categoryRows.length) {
      throw new AppError('Category not found.', 404, 'RESOURCE_NOT_FOUND');
    }

    const [usageRows] = await connection.query(
      'SELECT COUNT(*) AS total FROM products WHERE category_id = ?',
      [id]
    );
    const usageCount = Number(usageRows[0]?.total || 0);
    if (usageCount > 0) {
      throw new AppError(
        'Không thể xoá loại sản phẩm vì đang có sản phẩm sử dụng.',
        409,
        'CATEGORY_IN_USE',
        [{ field: 'params.id', issue: 'category is used by products', product_count: usageCount }]
      );
    }

    const [deleteResult] = await connection.query('DELETE FROM categories WHERE id = ?', [id]);
    if (deleteResult.affectedRows !== 1) {
      throw new AppError('Category not found.', 404, 'RESOURCE_NOT_FOUND');
    }

    await connection.commit();
    return { ...categoryRows[0], is_active: categoryRows[0].is_active === 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  setCategoryActive,
  deleteCategory
};
