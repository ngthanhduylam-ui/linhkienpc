const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { parsePagination, parseNullableInt } = require('../../utils/parsers');
const inventoryService = require('../inventory/inventory.service');

function validateQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('quantity must be a positive integer.', 400, 'VALIDATION_ERROR');
  }
}

async function adjustStock({ adminId, txnType, sku, batch_code = null, quantity, note = null }) {
  validateQuantity(quantity);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const resolved = await inventoryService.resolveSkuBatchForTransaction(connection, { sku, batch_code });

    const [balanceRows] = await connection.query(
      `
        SELECT id, quantity
        FROM inventory_balances
        WHERE product_id = ? AND warranty_batch_id = ?
        FOR UPDATE
      `,
      [resolved.product_id, resolved.warranty_batch_id]
    );

    let nextQuantity = 0;

    if (txnType === 'IN') {
      if (balanceRows.length) {
        nextQuantity = Number(balanceRows[0].quantity) + quantity;
        await connection.query(
          `
            UPDATE inventory_balances
            SET quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [nextQuantity, balanceRows[0].id]
        );
      } else {
        nextQuantity = quantity;
        await connection.query(
          `
            INSERT INTO inventory_balances (product_id, warranty_batch_id, quantity)
            VALUES (?, ?, ?)
          `,
          [resolved.product_id, resolved.warranty_batch_id, nextQuantity]
        );
      }
    } else if (txnType === 'OUT') {
      if (!balanceRows.length) {
        throw new AppError('Insufficient stock.', 422, 'INSUFFICIENT_STOCK');
      }

      const currentQuantity = Number(balanceRows[0].quantity);
      if (currentQuantity < quantity) {
        throw new AppError('Insufficient stock.', 422, 'INSUFFICIENT_STOCK', [
          { field: 'quantity', issue: 'exceeds_available_stock', available: currentQuantity }
        ]);
      }

      nextQuantity = currentQuantity - quantity;
      await connection.query(
        `
          UPDATE inventory_balances
          SET quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [nextQuantity, balanceRows[0].id]
      );
    } else {
      throw new AppError('Invalid transaction type.', 400, 'VALIDATION_ERROR');
    }

    const [txResult] = await connection.query(
      `
        INSERT INTO stock_transactions
          (txn_type, product_id, warranty_batch_id, quantity, note, created_by_admin_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [txnType, resolved.product_id, resolved.warranty_batch_id, quantity, note, adminId]
    );

    const [txRows] = await connection.query(
      `
        SELECT id, txn_type, product_id, warranty_batch_id, quantity, note, created_by_admin_id, occurred_at
        FROM stock_transactions
        WHERE id = ?
        LIMIT 1
      `,
      [txResult.insertId]
    );

    const [balanceAfterRows] = await connection.query(
      `
        SELECT quantity, updated_at
        FROM inventory_balances
        WHERE product_id = ? AND warranty_batch_id = ?
        LIMIT 1
      `,
      [resolved.product_id, resolved.warranty_batch_id]
    );

    await connection.commit();

    return {
      resolved,
      transaction: txRows[0],
      inventory_balance: {
        sku: resolved.sku,
        batch_code: resolved.batch_code,
        quantity: Number(balanceAfterRows[0].quantity),
        updated_at: balanceAfterRows[0].updated_at
      }
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function stockIn({ adminId, sku, batch_code, quantity, note }) {
  return adjustStock({ adminId, txnType: 'IN', sku, batch_code, quantity, note });
}

async function stockOut({ adminId, sku, batch_code, quantity, note }) {
  return adjustStock({ adminId, txnType: 'OUT', sku, batch_code, quantity, note });
}

async function listTransactions(query) {
  const { page, limit, offset } = parsePagination(query);
  const sku = (query.sku || '').trim();
  const batchCode = (query.batch_code || '').trim();
  const txnType = (query.txn_type || '').trim();
  const from = (query.from || '').trim();
  const to = (query.to || '').trim();
  const productId = parseNullableInt(query.product_id, 'product_id');
  const warrantyBatchId = parseNullableInt(query.warranty_batch_id, 'warranty_batch_id');

  const whereParts = ['1=1'];
  const params = [];

  if (sku) {
    whereParts.push('p.sku = ?');
    params.push(sku);
  }
  if (batchCode) {
    whereParts.push('wb.batch_code = ?');
    params.push(batchCode);
  }
  if (txnType) {
    whereParts.push('st.txn_type = ?');
    params.push(txnType);
  }
  if (from) {
    whereParts.push('st.occurred_at >= ?');
    params.push(from);
  }
  if (to) {
    whereParts.push('st.occurred_at <= ?');
    params.push(to);
  }
  if (productId !== null) {
    whereParts.push('st.product_id = ?');
    params.push(productId);
  }
  if (warrantyBatchId !== null) {
    whereParts.push('st.warranty_batch_id = ?');
    params.push(warrantyBatchId);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
      JOIN warranty_batches wb ON wb.id = st.warranty_batch_id
      ${whereSql}
    `,
    params
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
        p.is_active AS product_is_active,
        c.id AS category_id,
        c.name AS category_name,
        c.is_active AS category_is_active,
        wb.id AS batch_id,
        wb.batch_code,
        wb.is_active AS batch_is_active,
        a.id AS admin_id,
        a.username AS admin_username
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
      JOIN categories c ON c.id = p.category_id
      JOIN warranty_batches wb ON wb.id = st.warranty_batch_id
      JOIN admins a ON a.id = st.created_by_admin_id
      ${whereSql}
      ORDER BY st.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      txn_type: row.txn_type,
      product: {
        id: row.product_id,
        sku: row.sku,
        name: row.product_name,
        is_active: row.product_is_active === 1
      },
      category: {
        id: row.category_id,
        name: row.category_name,
        is_active: row.category_is_active === 1
      },
      warranty_batch: {
        id: row.batch_id,
        batch_code: row.batch_code,
        is_active: row.batch_is_active === 1
      },
      quantity: Number(row.quantity),
      note: row.note,
      created_by_admin: {
        id: row.admin_id,
        username: row.admin_username
      },
      occurred_at: row.occurred_at
    })),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

module.exports = {
  stockIn,
  stockOut,
  listTransactions
};
