const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { escapeLike, parsePagination } = require('../../utils/parsers');

function mapCustomer(row) {
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

function mapTransaction(row) {
  return {
    id: row.id,
    txn_type: row.txn_type,
    quantity: Number(row.quantity || 0),
    note: row.note,
    occurred_at: row.occurred_at,
    product: {
      id: row.product_id,
      sku: row.sku,
      name: row.product_name
    },
    created_by_admin: {
      id: row.admin_id,
      username: row.admin_username
    }
  };
}

async function listCustomers(query) {
  const { page, limit, offset } = parsePagination({
    page: query.page || 1,
    limit: query.limit || 20
  });
  const keyword = (query.keyword || '').trim();
  const whereParts = ['cu.is_active = 1'];
  const params = [];

  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    whereParts.push('(cu.name LIKE ? OR cu.phone LIKE ?)');
    params.push(pattern, pattern);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM customers cu
      ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
      SELECT
        cu.id,
        cu.name,
        cu.phone,
        cu.address,
        cu.is_active,
        cu.created_at,
        cu.updated_at,
        COUNT(st.id) AS transaction_count,
        MAX(st.occurred_at) AS last_transaction_at
      FROM customers cu
      LEFT JOIN stock_transactions st ON st.customer_id = cu.id
      ${whereSql}
      GROUP BY cu.id
      ORDER BY last_transaction_at DESC, cu.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapCustomer),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

async function getCustomerById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        cu.id,
        cu.name,
        cu.phone,
        cu.address,
        cu.is_active,
        cu.created_at,
        cu.updated_at,
        COUNT(st.id) AS transaction_count,
        MAX(st.occurred_at) AS last_transaction_at
      FROM customers cu
      LEFT JOIN stock_transactions st ON st.customer_id = cu.id
      WHERE cu.id = ?
      GROUP BY cu.id
      LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
  }

  return mapCustomer(rows[0]);
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

async function listCustomerTransactions(id, query) {
  await getCustomerById(id);

  const { page, limit, offset } = parsePagination({
    page: query.page || 1,
    limit: query.limit || 10
  });

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM stock_transactions
      WHERE customer_id = ?
    `,
    [id]
  );

  const [rows] = await pool.query(
    `
      SELECT
        st.id,
        st.txn_type,
        st.quantity,
        st.note,
        st.occurred_at,
        p.id AS product_id,
        p.sku,
        p.name AS product_name,
        a.id AS admin_id,
        a.username AS admin_username
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
      JOIN admins a ON a.id = st.created_by_admin_id
      WHERE st.customer_id = ?
      ORDER BY st.id DESC
      LIMIT ? OFFSET ?
    `,
    [id, limit, offset]
  );

  return {
    items: rows.map(mapTransaction),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

module.exports = {
  listCustomers,
  getCustomerById,
  createCustomer,
  listCustomerTransactions
};
