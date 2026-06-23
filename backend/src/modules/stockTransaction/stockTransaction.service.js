const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { escapeLike, parsePagination, parseNullableInt } = require('../../utils/parsers');
const { NO_NOTE_WARRANTY_KEY, getAdjustedNoteGroups, normalizeNoteKey } = require('../../utils/inventoryNoteGroups');

const MAX_MONEY_AMOUNT = 999999999999999n;

function validateQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('quantity must be a positive integer.', 400, 'VALIDATION_ERROR');
  }
}

function databaseMoneyToBigInt(value, fieldName) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new AppError(`${fieldName} must be a non-negative integer.`, 500, 'INVALID_MONEY_AMOUNT');
  }

  const parsed = BigInt(normalized);
  if (parsed > MAX_MONEY_AMOUNT) {
    throw new AppError(`${fieldName} exceeds supported amount.`, 500, 'MONEY_AMOUNT_OVERFLOW');
  }

  return parsed;
}

function requestMoneyToBigInt(value, fieldName, item) {
  const details = [
    {
      sku: item.sku,
      product_id: item.product_id,
      field: fieldName,
      issue: 'must_be_non_negative_integer_within_supported_amount'
    }
  ];

  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
  ) {
    throw new AppError(`${fieldName} must be a non-negative integer.`, 400, 'INVALID_MONEY_AMOUNT', details);
  }

  const parsed = BigInt(value);
  if (parsed > MAX_MONEY_AMOUNT) {
    throw new AppError(`${fieldName} exceeds supported amount.`, 400, 'MONEY_AMOUNT_OVERFLOW', details);
  }

  return parsed;
}

function moneyToSql(value) {
  return value === null || value === undefined ? null : value.toString();
}

function moneyToResponse(value) {
  return value === null || value === undefined ? null : Number(value);
}

function buildSaleSnapshot(item) {
  const referenceUnitPrice = databaseMoneyToBigInt(item.sale_price, 'sale_price');
  const discountAmount = requestMoneyToBigInt(item.discount_amount ?? 0, 'discount_amount', item);
  const hasReferencePrice = referenceUnitPrice !== null;
  let finalUnitPrice;

  if (hasReferencePrice) {
    if (item.manual_unit_price !== undefined) {
      throw new AppError('manual_unit_price is only accepted when the product has no reference price.', 400, 'VALIDATION_ERROR', [
        {
          sku: item.sku,
          product_id: item.product_id,
          field: 'manual_unit_price',
          issue: 'not_allowed_when_reference_price_exists'
        }
      ]);
    }
    if (discountAmount > referenceUnitPrice) {
      throw new AppError('discount_amount cannot exceed the reference price.', 400, 'INVALID_DISCOUNT_AMOUNT', [
        {
          sku: item.sku,
          product_id: item.product_id,
          field: 'discount_amount',
          issue: 'exceeds_reference_price'
        }
      ]);
    }
    finalUnitPrice = referenceUnitPrice - discountAmount;
  } else {
    if (discountAmount !== 0n) {
      throw new AppError('discount_amount must be 0 when the product has no reference price.', 400, 'INVALID_DISCOUNT_AMOUNT', [
        {
          sku: item.sku,
          product_id: item.product_id,
          field: 'discount_amount',
          issue: 'requires_reference_price'
        }
      ]);
    }
    if (item.manual_unit_price === undefined) {
      throw new AppError('manual_unit_price is required when the product has no reference price.', 400, 'MANUAL_UNIT_PRICE_REQUIRED', [
        {
          sku: item.sku,
          product_id: item.product_id,
          field: 'manual_unit_price',
          issue: 'required'
        }
      ]);
    }
    finalUnitPrice = requestMoneyToBigInt(item.manual_unit_price, 'manual_unit_price', item);
  }

  const lineTotal = finalUnitPrice * BigInt(item.quantity);
  if (lineTotal > MAX_MONEY_AMOUNT) {
    throw new AppError('line_total exceeds supported amount.', 400, 'MONEY_AMOUNT_OVERFLOW', [
      {
        sku: item.sku,
        product_id: item.product_id,
        field: 'line_total',
        issue: 'exceeds_supported_amount'
      }
    ]);
  }

  return {
    reference_unit_price: referenceUnitPrice,
    discount_amount: discountAmount,
    unit_price: finalUnitPrice,
    line_total: lineTotal
  };
}

function calculateVoucherTotalAmount(items) {
  let total = 0n;

  for (const item of items) {
    if (item.line_total === null || item.line_total === undefined) {
      return null;
    }
    total += item.line_total;
    if (total > MAX_MONEY_AMOUNT) {
      throw new AppError('total_amount exceeds supported amount.', 400, 'MONEY_AMOUNT_OVERFLOW', [
        {
          field: 'total_amount',
          issue: 'exceeds_supported_amount'
        }
      ]);
    }
  }

  return total;
}

function normalizeWarrantyNote(note) {
  if (note === NO_NOTE_WARRANTY_KEY) {
    return '';
  }
  return normalizeNoteKey(note);
}

function normalizeSaleNote(note) {
  if (note === undefined || note === null) {
    return null;
  }

  const trimmed = String(note).trim();
  return trimmed ? trimmed : null;
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

async function lockProductBalances(connection, productIds) {
  const uniqueProductIds = [...new Set(productIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    .sort((a, b) => a - b);

  if (!uniqueProductIds.length) {
    return new Map();
  }

  const placeholders = uniqueProductIds.map(() => '?').join(',');
  const [rows] = await connection.query(
    `
      SELECT id, product_id, quantity
      FROM product_inventory_balances
      WHERE product_id IN (${placeholders})
      ORDER BY product_id ASC
      FOR UPDATE
    `,
    uniqueProductIds
  );

  return new Map(rows.map((row) => [Number(row.product_id), row]));
}

async function resolveProductsBySku(connection, items) {
  const skuKeys = [...new Set(items.map((item) => item.sku.trim().toLowerCase()))];
  if (!skuKeys.length) {
    return new Map();
  }

  const placeholders = skuKeys.map(() => '?').join(',');
  const [rows] = await connection.query(
    `
      SELECT id, sku, name, sale_price, is_active
      FROM products
      WHERE LOWER(sku) IN (${placeholders})
    `,
    skuKeys
  );

  const productMap = new Map(rows.map((row) => [String(row.sku).trim().toLowerCase(), row]));
  const missingOrInactive = [];

  items.forEach((item, index) => {
    const skuKey = item.sku.trim().toLowerCase();
    const product = productMap.get(skuKey);

    if (!product) {
      missingOrInactive.push({ index, sku: item.sku, issue: 'not_found' });
      return;
    }

    if (product.is_active !== 1) {
      missingOrInactive.push({ index, sku: item.sku, issue: 'inactive' });
    }
  });

  if (missingOrInactive.length > 0) {
    throw new AppError('One or more SKUs are invalid.', 404, 'SKU_NOT_FOUND', missingOrInactive);
  }

  return productMap;
}

async function createStockVoucher(connection, { voucherType, adminId, customerId = null, supplierId = null }) {
  const [result] = await connection.query(
    `
      INSERT INTO stock_vouchers
        (voucher_type, customer_id, supplier_id, created_by_admin_id)
      VALUES (?, ?, ?, ?)
    `,
    [voucherType, customerId, supplierId, adminId]
  );

  const voucherId = result.insertId;
  const voucherCode = `${voucherType}-${String(voucherId).padStart(6, '0')}`;

  await connection.query(
    `
      UPDATE stock_vouchers
      SET voucher_code = ?
      WHERE id = ?
    `,
    [voucherCode, voucherId]
  );

  return {
    id: voucherId,
    voucher_code: voucherCode,
    voucher_type: voucherType
  };
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

async function bulkStockIn({ adminId, supplierId = null, items = [] }) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new AppError('items must be a non-empty array with at most 100 items.', 400, 'VALIDATION_ERROR');
  }

  for (const [index, item] of items.entries()) {
    validateQuantity(item.quantity);
    if (!item.sku || typeof item.sku !== 'string' || !item.sku.trim()) {
      throw new AppError('sku is required.', 400, 'VALIDATION_ERROR', [{ field: `items[${index}].sku`, issue: 'required' }]);
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const resolvedSupplierId = await resolveSupplierId(connection, supplierId);
    const productMap = await resolveProductsBySku(connection, items);
    const resolvedItems = items.map((item) => {
      const product = productMap.get(item.sku.trim().toLowerCase());
      return {
        sku: product.sku,
        product_id: Number(product.id),
        product_name: product.name,
        quantity: Number(item.quantity),
        note: item.note && item.note.trim() ? item.note.trim() : null
      };
    });
    const voucher = await createStockVoucher(connection, {
      voucherType: 'IN',
      adminId,
      supplierId: resolvedSupplierId
    });

    const productIds = [...new Set(resolvedItems.map((item) => item.product_id))].sort((a, b) => a - b);
    const balanceMap = await lockProductBalances(connection, productIds);
    const runningQuantityByProduct = new Map();
    const finalQuantityByProduct = new Map();

    for (const productId of productIds) {
      const currentQuantity = Number(balanceMap.get(productId)?.quantity || 0);
      runningQuantityByProduct.set(productId, currentQuantity);
      finalQuantityByProduct.set(productId, currentQuantity);
    }

    const responseItems = [];
    for (const item of resolvedItems) {
      const nextQuantity = Number(runningQuantityByProduct.get(item.product_id) || 0) + item.quantity;
      runningQuantityByProduct.set(item.product_id, nextQuantity);
      finalQuantityByProduct.set(item.product_id, nextQuantity);
      responseItems.push({
        sku: item.sku,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        note: item.note,
        transaction_id: null,
        new_total_quantity: nextQuantity
      });
    }

    for (const productId of productIds) {
      await connection.query(
        `
          INSERT INTO product_inventory_balances (product_id, quantity)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP
        `,
        [productId, Number(finalQuantityByProduct.get(productId) || 0)]
      );
    }

    for (const [index, item] of resolvedItems.entries()) {
      const [txResult] = await connection.query(
        `
          INSERT INTO stock_transactions
            (voucher_id, txn_type, product_id, warranty_batch_id, customer_id, supplier_id, quantity, note, created_by_admin_id)
          VALUES (?, 'IN', ?, NULL, NULL, ?, ?, ?, ?)
        `,
        [voucher.id, item.product_id, resolvedSupplierId, item.quantity, item.note, adminId]
      );

      responseItems[index].transaction_id = txResult.insertId;
    }

    await connection.commit();

    return {
      txn_type: 'IN',
      voucher_id: voucher.id,
      voucher_code: voucher.voucher_code,
      supplier_id: resolvedSupplierId,
      items: responseItems
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function stockOut({ adminId, sku, quantity, note, warrantyNote, customerId }) {
  return adjustStock({ adminId, txnType: 'OUT', sku, quantity, note, warrantyNote, customerId });
}

function hasWarrantySelection(warrantyNote) {
  return (
    warrantyNote !== undefined &&
    warrantyNote !== null &&
    (warrantyNote === NO_NOTE_WARRANTY_KEY || String(warrantyNote).trim() !== '')
  );
}

function aggregateQuantity(map, key, quantity) {
  map.set(key, Number(map.get(key) || 0) + Number(quantity || 0));
}

async function bulkStockOut({ adminId, customerId = null, items = [] }) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new AppError('items must be a non-empty array with at most 100 items.', 400, 'VALIDATION_ERROR');
  }

  for (const [index, item] of items.entries()) {
    validateQuantity(item.quantity);
    if (!item.sku || typeof item.sku !== 'string' || !item.sku.trim()) {
      throw new AppError('sku is required.', 400, 'VALIDATION_ERROR', [{ field: `items[${index}].sku`, issue: 'required' }]);
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const resolvedCustomerId = await resolveCustomerId(connection, customerId);
    const productMap = await resolveProductsBySku(connection, items);
    const resolvedItems = items.map((item, index) => {
      const product = productMap.get(item.sku.trim().toLowerCase());
      const warrantySelected = hasWarrantySelection(item.warranty_note);
      const warrantyNoteKey = warrantySelected ? normalizeWarrantyNote(item.warranty_note) : '';

      return {
        index,
        sku: product.sku,
        product_id: Number(product.id),
        product_name: product.name,
        sale_price: product.sale_price,
        discount_amount: item.discount_amount ?? 0,
        manual_unit_price: item.manual_unit_price,
        quantity: Number(item.quantity),
        warranty_note: item.warranty_note,
        sale_note: normalizeSaleNote(item.sale_note),
        warranty_note_key: warrantyNoteKey,
        has_warranty_selection: warrantySelected,
        transaction_note: warrantySelected && warrantyNoteKey ? warrantyNoteKey : null
      };
    });
    resolvedItems.forEach((item) => {
      const priceSnapshot = buildSaleSnapshot(item);
      item.unit_price = priceSnapshot.unit_price;
      item.reference_unit_price = priceSnapshot.reference_unit_price;
      item.discount_amount = priceSnapshot.discount_amount;
      item.line_total = priceSnapshot.line_total;
    });
    const totalAmount = calculateVoucherTotalAmount(resolvedItems);
    const voucher = await createStockVoucher(connection, {
      voucherType: 'OUT',
      adminId,
      customerId: resolvedCustomerId
    });

    const productIds = [...new Set(resolvedItems.map((item) => item.product_id))].sort((a, b) => a - b);
    const balanceMap = await lockProductBalances(connection, productIds);
    const requestedByProduct = new Map();
    const finalQuantityByProduct = new Map();

    for (const item of resolvedItems) {
      aggregateQuantity(requestedByProduct, item.product_id, item.quantity);
    }

    const stockErrors = [];
    for (const productId of productIds) {
      const currentQuantity = Number(balanceMap.get(productId)?.quantity || 0);
      const requestedQuantity = Number(requestedByProduct.get(productId) || 0);
      if (currentQuantity < requestedQuantity) {
        const firstItem = resolvedItems.find((item) => item.product_id === productId);
        stockErrors.push({
          sku: firstItem?.sku,
          product_id: productId,
          requested: requestedQuantity,
          available: currentQuantity
        });
      }
      finalQuantityByProduct.set(productId, currentQuantity - requestedQuantity);
    }

    if (stockErrors.length > 0) {
      throw new AppError('Insufficient stock.', 422, 'INSUFFICIENT_STOCK', stockErrors);
    }

    const noteGroupsByProduct = new Map();
    for (const productId of productIds) {
      noteGroupsByProduct.set(productId, await getAdjustedNoteGroups(productId, connection));
    }

    const requestedByProductNote = new Map();
    const warrantyValidationErrors = [];

    for (const item of resolvedItems) {
      const groups = noteGroupsByProduct.get(item.product_id) || [];
      if (groups.length > 0 && !item.has_warranty_selection) {
        warrantyValidationErrors.push({
          index: item.index,
          sku: item.sku,
          field: 'warranty_note',
          issue: 'required_when_warranty_groups_exist'
        });
        continue;
      }

      if (groups.length === 0 && item.has_warranty_selection && item.warranty_note_key !== '') {
        warrantyValidationErrors.push({
          index: item.index,
          sku: item.sku,
          field: 'warranty_note',
          issue: 'not_found',
          warranty_note: item.warranty_note_key
        });
        continue;
      }

      if (groups.length > 0) {
        const groupKey = JSON.stringify([item.product_id, item.warranty_note_key]);
        aggregateQuantity(requestedByProductNote, groupKey, item.quantity);
      }
    }

    if (warrantyValidationErrors.length > 0) {
      throw new AppError('Warranty note validation failed.', 400, 'WARRANTY_NOTE_VALIDATION_FAILED', warrantyValidationErrors);
    }

    const warrantyStockErrors = [];
    for (const [groupKey, requestedQuantity] of requestedByProductNote.entries()) {
      const [productId, noteKey] = JSON.parse(groupKey);
      const groups = noteGroupsByProduct.get(productId) || [];
      const selectedGroup = groups.find((group) => group.note_key === noteKey);
      const firstItem = resolvedItems.find((item) => item.product_id === productId && item.warranty_note_key === noteKey);

      if (!selectedGroup) {
        warrantyStockErrors.push({
          index: firstItem?.index,
          sku: firstItem?.sku,
          warranty_note: noteKey,
          requested: requestedQuantity,
          available: 0
        });
        continue;
      }

      if (Number(selectedGroup.quantity || 0) < Number(requestedQuantity || 0)) {
        warrantyStockErrors.push({
          index: firstItem?.index,
          sku: firstItem?.sku,
          warranty_note: noteKey,
          requested: requestedQuantity,
          available: Number(selectedGroup.quantity || 0)
        });
      }
    }

    if (warrantyStockErrors.length > 0) {
      throw new AppError('Insufficient warranty note stock.', 422, 'INSUFFICIENT_WARRANTY_NOTE_STOCK', warrantyStockErrors);
    }

    for (const productId of productIds) {
      await connection.query(
        `
          INSERT INTO product_inventory_balances (product_id, quantity)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP
        `,
        [productId, Number(finalQuantityByProduct.get(productId) || 0)]
      );
    }

    const runningQuantityByProduct = new Map();
    for (const productId of productIds) {
      runningQuantityByProduct.set(productId, Number(balanceMap.get(productId)?.quantity || 0));
    }

    const responseItems = [];
    for (const item of resolvedItems) {
      const nextQuantity = Number(runningQuantityByProduct.get(item.product_id) || 0) - item.quantity;
      runningQuantityByProduct.set(item.product_id, nextQuantity);

      const [txResult] = await connection.query(
        `
          INSERT INTO stock_transactions
            (voucher_id, txn_type, product_id, warranty_batch_id, customer_id, supplier_id, quantity, note, created_by_admin_id)
          VALUES (?, 'OUT', ?, NULL, ?, NULL, ?, ?, ?)
        `,
        [voucher.id, item.product_id, resolvedCustomerId, item.quantity, item.transaction_note, adminId]
      );

      await connection.query(
        `
          INSERT INTO stock_voucher_items
            (
              voucher_id,
              stock_transaction_id,
              product_id,
              sku_snapshot,
              product_name_snapshot,
              warranty_note_snapshot,
              sale_note_snapshot,
              quantity,
              reference_unit_price,
              discount_amount,
              unit_price,
              line_total
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          voucher.id,
          txResult.insertId,
          item.product_id,
          item.sku,
          item.product_name,
          item.transaction_note,
          item.sale_note,
          item.quantity,
          moneyToSql(item.reference_unit_price),
          moneyToSql(item.discount_amount),
          moneyToSql(item.unit_price),
          moneyToSql(item.line_total)
        ]
      );

      responseItems.push({
        sku: item.sku,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        warranty_note: item.warranty_note === NO_NOTE_WARRANTY_KEY ? NO_NOTE_WARRANTY_KEY : item.transaction_note,
        sale_note: item.sale_note,
        transaction_id: txResult.insertId,
        reference_unit_price: moneyToResponse(item.reference_unit_price),
        discount_amount: moneyToResponse(item.discount_amount),
        unit_price: moneyToResponse(item.unit_price),
        line_total: moneyToResponse(item.line_total),
        new_total_quantity: nextQuantity
      });
    }

    await connection.query(
      `
        UPDATE stock_vouchers
        SET total_amount = ?
        WHERE id = ?
      `,
      [moneyToSql(totalAmount), voucher.id]
    );

    await connection.commit();

    return {
      txn_type: 'OUT',
      voucher_id: voucher.id,
      voucher_code: voucher.voucher_code,
      total_amount: moneyToResponse(totalAmount),
      customer_id: resolvedCustomerId,
      items: responseItems
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  bulkStockIn,
  bulkStockOut,
  stockIn,
  stockOut,
  listTransactions
};
