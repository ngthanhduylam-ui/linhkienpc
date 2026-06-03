const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { escapeLike, parsePagination, parseNullableInt } = require('../../utils/parsers');
const { NO_NOTE_WARRANTY_KEY, getAdjustedNoteGroups, normalizeNoteKey } = require('../../utils/inventoryNoteGroups');

function validateQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('quantity must be a positive integer.', 400, 'VALIDATION_ERROR');
  }
}

function normalizeWarrantyNote(note) {
  if (note === NO_NOTE_WARRANTY_KEY) {
    return '';
  }
  return normalizeNoteKey(note);
}

async function resolveProductBySku(connection, sku) {
  const [rows] = await connection.query(
    `
      SELECT id, sku, is_active
      FROM products
      WHERE sku = ?
      LIMIT 1
    `,
    [sku]
  );

  if (!rows.length) {
    throw new AppError('SKU not found.', 404, 'SKU_NOT_FOUND');
  }

  const product = rows[0];
  if (product.is_active !== 1) {
    throw new AppError('Product is inactive.', 400, 'PRODUCT_INACTIVE');
  }

  return {
    product_id: product.id,
    sku: product.sku
  };
}

async function lockProductBalance(connection, productId) {
  const [rows] = await connection.query(
    `
      SELECT id, quantity
      FROM product_inventory_balances
      WHERE product_id = ?
      FOR UPDATE
    `,
    [productId]
  );
  return rows[0] || null;
}

async function resolveCustomerId(connection, customerId) {
  if (customerId === undefined || customerId === null || customerId === '') {
    return null;
  }

  const parsedCustomerId = Number(customerId);
  if (!Number.isInteger(parsedCustomerId) || parsedCustomerId < 1) {
    throw new AppError('customer_id must be a positive integer.', 400, 'VALIDATION_ERROR');
  }

  const [rows] = await connection.query(
    `
      SELECT id, is_active
      FROM customers
      WHERE id = ?
      LIMIT 1
    `,
    [parsedCustomerId]
  );

  if (!rows.length) {
    throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
  }

  if (rows[0].is_active !== 1) {
    throw new AppError('Customer is inactive.', 400, 'CUSTOMER_INACTIVE');
  }

  return parsedCustomerId;
}

async function resolveSupplierId(connection, supplierId) {
  if (supplierId === undefined || supplierId === null || supplierId === '') {
    return null;
  }

  const parsedSupplierId = Number(supplierId);
  if (!Number.isInteger(parsedSupplierId) || parsedSupplierId < 1) {
    throw new AppError('supplier_id must be a positive integer.', 400, 'VALIDATION_ERROR');
  }

  const [rows] = await connection.query(
    `
      SELECT id, is_active
      FROM suppliers
      WHERE id = ?
      LIMIT 1
    `,
    [parsedSupplierId]
  );

  if (!rows.length) {
    throw new AppError('Supplier not found.', 404, 'SUPPLIER_NOT_FOUND');
  }

  if (rows[0].is_active !== 1) {
    throw new AppError('Supplier is inactive.', 400, 'SUPPLIER_INACTIVE');
  }

  return parsedSupplierId;
}

async function adjustStock({
  adminId,
  txnType,
  sku,
  quantity,
  note = null,
  warrantyNote = null,
  customerId = null,
  supplierId = null
}) {
  validateQuantity(quantity);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const resolved = await resolveProductBySku(connection, sku);
    const resolvedCustomerId = await resolveCustomerId(connection, customerId);
    const resolvedSupplierId = await resolveSupplierId(connection, supplierId);
    const currentBalance = await lockProductBalance(connection, resolved.product_id);
    const currentQuantity = Number(currentBalance?.quantity || 0);

    let nextQuantity = currentQuantity;
    let transactionNote = note && note.trim() ? note.trim() : null;

    if (txnType === 'IN') {
      nextQuantity = currentQuantity + quantity;
    } else if (txnType === 'OUT') {
      if (currentQuantity < quantity) {
        throw new AppError('Insufficient stock.', 422, 'INSUFFICIENT_STOCK', [
          { field: 'quantity', issue: 'exceeds_available_stock', available: currentQuantity }
        ]);
      }

      const remainingNoteGroups = await getAdjustedNoteGroups(resolved.product_id, connection);
      const hasWarrantySelection =
        warrantyNote !== undefined &&
        warrantyNote !== null &&
        (warrantyNote === NO_NOTE_WARRANTY_KEY || String(warrantyNote).trim() !== '');
      const selectedWarrantyNote = normalizeWarrantyNote(hasWarrantySelection ? warrantyNote : note);

      if (remainingNoteGroups.length && !hasWarrantySelection) {
        throw new AppError('Warranty note selection is required.', 400, 'WARRANTY_NOTE_REQUIRED', [
          { field: 'warranty_note', issue: 'required_when_warranty_groups_exist' }
        ]);
      }

      if (remainingNoteGroups.length && hasWarrantySelection) {
        const selectedGroup = remainingNoteGroups.find((group) => group.note_key === selectedWarrantyNote);
        if (!selectedGroup) {
          throw new AppError('Warranty note group not found.', 404, 'WARRANTY_NOTE_NOT_FOUND', [
            { field: 'warranty_note', issue: 'not_found' }
          ]);
        }
        if (selectedGroup.quantity < quantity) {
          throw new AppError('Insufficient warranty note stock.', 422, 'INSUFFICIENT_WARRANTY_NOTE_STOCK', [
            {
              field: 'quantity',
              issue: 'exceeds_selected_warranty_note_stock',
              warranty_note: selectedWarrantyNote,
              available: selectedGroup.quantity
            }
          ]);
        }
        transactionNote = selectedWarrantyNote ? selectedWarrantyNote : null;
      }

      nextQuantity = currentQuantity - quantity;
    } else {
      throw new AppError('Invalid transaction type.', 400, 'VALIDATION_ERROR');
    }

    if (currentBalance) {
      await connection.query(
        `
          UPDATE product_inventory_balances
          SET quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [nextQuantity, currentBalance.id]
      );
    } else {
      await connection.query(
        `
          INSERT INTO product_inventory_balances (product_id, quantity)
          VALUES (?, ?)
        `,
        [resolved.product_id, nextQuantity]
      );
    }

    const [txResult] = await connection.query(
      `
        INSERT INTO stock_transactions
          (txn_type, product_id, warranty_batch_id, customer_id, supplier_id, quantity, note, created_by_admin_id)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
      `,
      [txnType, resolved.product_id, resolvedCustomerId, resolvedSupplierId, quantity, transactionNote, adminId]
    );

    const [txRows] = await connection.query(
      `
        SELECT id, txn_type, product_id, customer_id, supplier_id, quantity, note, created_by_admin_id, occurred_at
        FROM stock_transactions
        WHERE id = ?
        LIMIT 1
      `,
      [txResult.insertId]
    );

    const [balanceRows] = await connection.query(
      `
        SELECT quantity, updated_at
        FROM product_inventory_balances
        WHERE product_id = ?
        LIMIT 1
      `,
      [resolved.product_id]
    );

    await connection.commit();

    return {
      resolved,
      transaction: txRows[0],
      inventory_balance: {
        sku: resolved.sku,
        quantity: Number(balanceRows[0].quantity),
        updated_at: balanceRows[0].updated_at
      }
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function stockIn({ adminId, sku, quantity, note, supplierId }) {
  return adjustStock({ adminId, txnType: 'IN', sku, quantity, note, supplierId });
}

async function stockOut({ adminId, sku, quantity, note, warrantyNote, customerId }) {
  return adjustStock({ adminId, txnType: 'OUT', sku, quantity, note, warrantyNote, customerId });
}

async function listTransactions(query) {
  const { page, limit, offset } = parsePagination(query);
  const keyword = (query.keyword || query.search || query.sku || '').trim();
  const txnType = (query.txn_type || '').trim();
  const from = (query.from || '').trim();
  const to = (query.to || '').trim();
  const productId = parseNullableInt(query.product_id, 'product_id');
  const noteKeyword = (query.note || query.batch_code || '').trim();

  const whereParts = ['1=1'];
  const params = [];

  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    whereParts.push('(p.sku LIKE ? OR p.name LIKE ?)');
    params.push(pattern, pattern);
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
  if (noteKeyword) {
    whereParts.push('st.note LIKE ?');
    params.push(`%${noteKeyword}%`);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
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
        cu.id AS customer_id,
        cu.name AS customer_name,
        cu.phone AS customer_phone,
        cu.address AS customer_address,
        su.id AS supplier_id,
        su.name AS supplier_name,
        su.phone AS supplier_phone,
        su.address AS supplier_address,
        a.id AS admin_id,
        a.username AS admin_username
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN warranty_batches wb ON wb.id = st.warranty_batch_id
      LEFT JOIN customers cu ON cu.id = st.customer_id
      LEFT JOIN suppliers su ON su.id = st.supplier_id
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
      warranty_batch: row.batch_id
        ? {
            id: row.batch_id,
            batch_code: row.batch_code,
            is_active: row.batch_is_active === 1
          }
        : null,
      customer: row.customer_id
        ? {
            id: row.customer_id,
            name: row.customer_name,
            phone: row.customer_phone,
            address: row.customer_address
          }
        : null,
      supplier: row.supplier_id
        ? {
            id: row.supplier_id,
            name: row.supplier_name,
            phone: row.supplier_phone,
            address: row.supplier_address
          }
        : null,
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
