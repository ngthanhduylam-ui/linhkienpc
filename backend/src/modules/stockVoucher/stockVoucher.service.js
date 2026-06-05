const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { escapeLike, parsePagination } = require('../../utils/parsers');

function mapVoucherLabel(voucherType) {
  return voucherType === 'IN' ? 'Nhập hàng' : 'Xuất & Giao hàng';
}

function mapPartner(row) {
  if (row.voucher_type === 'IN' && row.supplier_id) {
    return {
      type: 'SUPPLIER',
      id: row.supplier_id,
      name: row.supplier_name,
      phone: row.supplier_phone,
      address: row.supplier_address
    };
  }

  if (row.voucher_type === 'OUT' && row.customer_id) {
    return {
      type: 'CUSTOMER',
      id: row.customer_id,
      name: row.customer_name,
      phone: row.customer_phone,
      address: row.customer_address
    };
  }

  if (row.supplier_id) {
    return {
      type: 'SUPPLIER',
      id: row.supplier_id,
      name: row.supplier_name,
      phone: row.supplier_phone,
      address: row.supplier_address
    };
  }

  if (row.customer_id) {
    return {
      type: 'CUSTOMER',
      id: row.customer_id,
      name: row.customer_name,
      phone: row.customer_phone,
      address: row.customer_address
    };
  }

  return null;
}

function mapAdmin(row) {
  return {
    id: row.admin_id,
    username: row.admin_username
  };
}

function mapVoucher(row) {
  return {
    id: row.id,
    voucher_type: row.voucher_type,
    voucher_label: mapVoucherLabel(row.voucher_type),
    voucher_code: row.voucher_code,
    occurred_at: row.occurred_at,
    note: row.note,
    partner: mapPartner(row),
    item_count: Number(row.item_count || 0),
    total_quantity: Number(row.total_quantity || 0),
    admin: mapAdmin(row)
  };
}

function buildVoucherWhere(query) {
  const type = (query.type || query.voucher_type || '').trim().toUpperCase();
  const keyword = (query.keyword || query.search || '').trim();
  const whereParts = ['1=1'];
  const params = [];

  if (type) {
    if (!['IN', 'OUT'].includes(type)) {
      throw new AppError('type must be IN or OUT.', 400, 'VALIDATION_ERROR');
    }
    whereParts.push('sv.voucher_type = ?');
    params.push(type);
  }

  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    whereParts.push(`
      (
        cu.name LIKE ?
        OR cu.phone LIKE ?
        OR su.name LIKE ?
        OR su.phone LIKE ?
        OR EXISTS (
          SELECT 1
          FROM stock_transactions st_keyword
          JOIN products p_keyword ON p_keyword.id = st_keyword.product_id
          WHERE st_keyword.voucher_id = sv.id
            AND (p_keyword.name LIKE ? OR p_keyword.sku LIKE ?)
        )
      )
    `);
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }

  return {
    whereSql: `WHERE ${whereParts.join(' AND ')}`,
    params
  };
}

async function listStockVouchers(query = {}) {
  const { page, limit, offset } = parsePagination(query);
  const { whereSql, params } = buildVoucherWhere(query);

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM stock_vouchers sv
      LEFT JOIN customers cu ON cu.id = sv.customer_id
      LEFT JOIN suppliers su ON su.id = sv.supplier_id
      ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
      SELECT
        sv.id,
        sv.voucher_type,
        sv.voucher_code,
        sv.customer_id,
        sv.supplier_id,
        sv.occurred_at,
        sv.note,
        cu.name AS customer_name,
        cu.phone AS customer_phone,
        cu.address AS customer_address,
        su.name AS supplier_name,
        su.phone AS supplier_phone,
        su.address AS supplier_address,
        a.id AS admin_id,
        a.username AS admin_username,
        COUNT(st.id) AS item_count,
        COALESCE(SUM(st.quantity), 0) AS total_quantity
      FROM stock_vouchers sv
      LEFT JOIN customers cu ON cu.id = sv.customer_id
      LEFT JOIN suppliers su ON su.id = sv.supplier_id
      JOIN admins a ON a.id = sv.created_by_admin_id
      LEFT JOIN stock_transactions st ON st.voucher_id = sv.id
      ${whereSql}
      GROUP BY sv.id
      ORDER BY sv.occurred_at DESC, sv.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapVoucher),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

async function getStockVoucherById(id) {
  const [voucherRows] = await pool.query(
    `
      SELECT
        sv.id,
        sv.voucher_type,
        sv.voucher_code,
        sv.customer_id,
        sv.supplier_id,
        sv.occurred_at,
        sv.note,
        cu.name AS customer_name,
        cu.phone AS customer_phone,
        cu.address AS customer_address,
        su.name AS supplier_name,
        su.phone AS supplier_phone,
        su.address AS supplier_address,
        a.id AS admin_id,
        a.username AS admin_username,
        COUNT(st.id) AS item_count,
        COALESCE(SUM(st.quantity), 0) AS total_quantity
      FROM stock_vouchers sv
      LEFT JOIN customers cu ON cu.id = sv.customer_id
      LEFT JOIN suppliers su ON su.id = sv.supplier_id
      JOIN admins a ON a.id = sv.created_by_admin_id
      LEFT JOIN stock_transactions st ON st.voucher_id = sv.id
      WHERE sv.id = ?
      GROUP BY sv.id
      LIMIT 1
    `,
    [id]
  );

  if (!voucherRows.length) {
    throw new AppError('Stock voucher not found.', 404, 'STOCK_VOUCHER_NOT_FOUND');
  }

  const [itemRows] = await pool.query(
    `
      SELECT
        st.id AS transaction_id,
        st.txn_type,
        st.quantity,
        st.note,
        st.occurred_at,
        p.id AS product_id,
        p.sku,
        p.name AS product_name
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
      WHERE st.voucher_id = ?
      ORDER BY st.id ASC
    `,
    [id]
  );

  return {
    ...mapVoucher(voucherRows[0]),
    items: itemRows.map((row) => ({
      transaction_id: row.transaction_id,
      txn_type: row.txn_type,
      quantity: Number(row.quantity || 0),
      note: row.note,
      warranty_note: row.note,
      occurred_at: row.occurred_at,
      product: {
        id: row.product_id,
        sku: row.sku,
        name: row.product_name
      }
    }))
  };
}

module.exports = {
  listStockVouchers,
  getStockVoucherById
};
