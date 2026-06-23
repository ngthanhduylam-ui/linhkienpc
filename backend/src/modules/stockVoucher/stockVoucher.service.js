const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { escapeLike, parsePagination } = require('../../utils/parsers');

function mapMoney(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value);
}

function mapVoucherLabel(voucherType) {
  return voucherType === 'IN' ? 'Nhập hàng' : 'Bán hàng';
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
    total_amount: mapMoney(row.total_amount),
    partner: mapPartner(row),
    item_count: Number(row.item_count || 0),
    total_quantity: Number(row.total_quantity || 0),
    admin: mapAdmin(row),
    preview_items: row.preview_items || []
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
        sv.voucher_code LIKE ?
        OR cu.name LIKE ?
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
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  return {
    whereSql: `WHERE ${whereParts.join(' AND ')}`,
    params
  };
}

async function attachPreviewItems(vouchers) {
  if (!vouchers.length) return vouchers;

  const voucherIds = vouchers.map((voucher) => voucher.id);
  const [snapshotRows] = await pool.query(
    `
      SELECT
        svi.voucher_id,
        svi.quantity,
        svi.warranty_note_snapshot AS note,
        svi.sale_note_snapshot AS sale_note,
        svi.sku_snapshot AS sku,
        svi.product_name_snapshot AS product_name,
        svi.reference_unit_price,
        svi.discount_amount,
        svi.unit_price,
        svi.line_total
      FROM stock_voucher_items svi
      WHERE svi.voucher_id IN (?)
      ORDER BY svi.voucher_id DESC, svi.id ASC
    `,
    [voucherIds]
  );

  const previewByVoucher = new Map();
  snapshotRows.forEach((row) => {
    const current = previewByVoucher.get(row.voucher_id) || [];
    if (current.length >= 3) return;

    current.push({
      product_name: row.product_name,
      sku: row.sku,
      quantity: Number(row.quantity || 0),
      note: row.note,
      sale_note: row.sale_note,
      reference_unit_price: mapMoney(row.reference_unit_price),
      discount_amount: mapMoney(row.discount_amount) || 0,
      unit_price: mapMoney(row.unit_price),
      line_total: mapMoney(row.line_total)
    });
    previewByVoucher.set(row.voucher_id, current);
  });

  const fallbackVoucherIds = voucherIds.filter((voucherId) => !previewByVoucher.has(voucherId));
  if (!fallbackVoucherIds.length) {
    return vouchers.map((voucher) => ({
      ...voucher,
      preview_items: previewByVoucher.get(voucher.id) || []
    }));
  }

  const [previewRows] = await pool.query(
    `
      SELECT
        st.voucher_id,
        st.quantity,
        st.note,
        p.sku,
        p.name AS product_name
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
      WHERE st.voucher_id IN (?)
      ORDER BY st.voucher_id DESC, st.id ASC
    `,
    [fallbackVoucherIds]
  );

  previewRows.forEach((row) => {
    const current = previewByVoucher.get(row.voucher_id) || [];
    if (current.length >= 3) return;

    current.push({
      product_name: row.product_name,
      sku: row.sku,
      quantity: Number(row.quantity || 0),
      note: row.note,
      sale_note: null,
      reference_unit_price: null,
      discount_amount: 0,
      unit_price: null,
      line_total: null
    });
    previewByVoucher.set(row.voucher_id, current);
  });

  return vouchers.map((voucher) => ({
    ...voucher,
    preview_items: previewByVoucher.get(voucher.id) || []
  }));
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
        sv.total_amount,
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

  const vouchers = await attachPreviewItems(rows.map(mapVoucher));

  return {
    items: vouchers,
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
        sv.total_amount,
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
        svi.stock_transaction_id AS transaction_id,
        svi.product_id,
        svi.sku_snapshot AS sku,
        svi.product_name_snapshot AS product_name,
        svi.warranty_note_snapshot AS note,
        svi.sale_note_snapshot AS sale_note,
        svi.quantity,
        svi.reference_unit_price,
        svi.discount_amount,
        svi.unit_price,
        svi.line_total
      FROM stock_voucher_items svi
      WHERE svi.voucher_id = ?
      ORDER BY svi.id ASC
    `,
    [id]
  );

  if (itemRows.length > 0) {
    return {
      ...mapVoucher(voucherRows[0]),
      items: itemRows.map((row) => ({
        transaction_id: row.transaction_id,
        txn_type: voucherRows[0].voucher_type,
        quantity: Number(row.quantity || 0),
        note: row.note,
        warranty_note: row.note,
        sale_note: row.sale_note,
        reference_unit_price: mapMoney(row.reference_unit_price),
        discount_amount: mapMoney(row.discount_amount) || 0,
        unit_price: mapMoney(row.unit_price),
        line_total: mapMoney(row.line_total),
        occurred_at: voucherRows[0].occurred_at,
        sku: row.sku,
        product_name: row.product_name,
        product: {
          id: row.product_id,
          sku: row.sku,
          name: row.product_name
        }
      }))
    };
  }

  const [legacyItemRows] = await pool.query(
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
    items: legacyItemRows.map((row) => ({
      transaction_id: row.transaction_id,
      txn_type: row.txn_type,
      quantity: Number(row.quantity || 0),
      note: row.note,
      warranty_note: row.note,
      sale_note: null,
      reference_unit_price: null,
      discount_amount: 0,
      unit_price: null,
      line_total: null,
      occurred_at: row.occurred_at,
      sku: row.sku,
      product_name: row.product_name,
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
