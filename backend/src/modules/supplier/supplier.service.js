const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { escapeLike, parsePagination } = require('../../utils/parsers');

function mapSupplier(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    is_active: row.is_active === 1,
    transaction_count: Number(row.transaction_count || 0),
    last_transaction_at: row.last_transaction_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function listSuppliers(query) {
  const { page, limit, offset } = parsePagination({
    page: query.page || 1,
    limit: query.limit || 20
  });
  const keyword = (query.keyword || '').trim();
  const whereParts = [];
  const params = [];

  if (query.is_active !== undefined) {
    const rawActive = String(query.is_active).trim().toLowerCase();
    if (!['true', 'false', '1', '0'].includes(rawActive)) {
      throw new AppError('is_active must be true or false.', 400, 'VALIDATION_ERROR');
    }
    whereParts.push('s.is_active = ?');
    params.push(['true', '1'].includes(rawActive) ? 1 : 0);
  }

  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    whereParts.push('(s.name LIKE ? OR s.phone LIKE ?)');
    params.push(pattern, pattern);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM suppliers s
      ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
      SELECT
        s.id,
        s.name,
        s.phone,
        s.address,
        s.is_active,
        s.created_at,
        s.updated_at,
        COUNT(st.id) AS transaction_count,
        MAX(st.occurred_at) AS last_transaction_at
      FROM suppliers s
      LEFT JOIN stock_transactions st ON st.supplier_id = s.id
      ${whereSql}
      GROUP BY s.id
      ORDER BY last_transaction_at DESC, s.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapSupplier),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

async function getSupplierById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        s.id,
        s.name,
        s.phone,
        s.address,
        s.is_active,
        s.created_at,
        s.updated_at,
        COUNT(st.id) AS transaction_count,
        MAX(st.occurred_at) AS last_transaction_at
      FROM suppliers s
      LEFT JOIN stock_transactions st ON st.supplier_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
      LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    throw new AppError('Supplier not found.', 404, 'SUPPLIER_NOT_FOUND');
  }

  return mapSupplier(rows[0]);
}

async function createSupplier(payload) {
  const name = payload.name.trim();
  const phone = payload.phone && payload.phone.trim() ? payload.phone.trim() : null;
  const address = payload.address && payload.address.trim() ? payload.address.trim() : null;

  const [result] = await pool.query(
    `
      INSERT INTO suppliers (name, phone, address)
      VALUES (?, ?, ?)
    `,
    [name, phone, address]
  );

  return getSupplierById(result.insertId);
}

async function updateSupplier(id, payload) {
  await getSupplierById(id);

  const name = payload.name.trim();
  const phone = payload.phone && payload.phone.trim() ? payload.phone.trim() : null;
  const address = payload.address && payload.address.trim() ? payload.address.trim() : null;

  await pool.query(
    `
      UPDATE suppliers
      SET name = ?, phone = ?, address = ?
      WHERE id = ?
    `,
    [name, phone, address, id]
  );

  return getSupplierById(id);
}

async function setSupplierActive(id, isActive) {
  await getSupplierById(id);
  await pool.query('UPDATE suppliers SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  return getSupplierById(id);
}

module.exports = {
  listSuppliers,
  createSupplier,
  updateSupplier,
  setSupplierActive
};
