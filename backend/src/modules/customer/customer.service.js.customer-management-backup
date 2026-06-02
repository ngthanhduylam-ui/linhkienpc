const { pool } = require('../../config/database');
const { escapeLike } = require('../../utils/parsers');

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function listCustomers(query) {
  const keyword = (query.keyword || '').trim();
  const limit = query.limit ? Math.min(Math.max(Number(query.limit) || 20, 1), 100) : 20;
  const whereParts = ['is_active = 1'];
  const params = [];

  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    whereParts.push('(name LIKE ? OR phone LIKE ?)');
    params.push(pattern, pattern);
  }

  const [rows] = await pool.query(
    `
      SELECT id, name, phone, address, is_active, created_at, updated_at
      FROM customers
      WHERE ${whereParts.join(' AND ')}
      ORDER BY id DESC
      LIMIT ?
    `,
    [...params, limit]
  );

  return rows.map(mapCustomer);
}

async function getCustomerById(id) {
  const [rows] = await pool.query(
    `
      SELECT id, name, phone, address, is_active, created_at, updated_at
      FROM customers
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows.length ? mapCustomer(rows[0]) : null;
}

async function createCustomer(payload) {
  const name = payload.name.trim();
  const phone = payload.phone && payload.phone.trim() ? payload.phone.trim() : null;
  const address = payload.address && payload.address.trim() ? payload.address.trim() : null;

  const [result] = await pool.query(
    `
      INSERT INTO customers (name, phone, address)
      VALUES (?, ?, ?)
    `,
    [name, phone, address]
  );

  return getCustomerById(result.insertId);
}

module.exports = {
  listCustomers,
  createCustomer
};
