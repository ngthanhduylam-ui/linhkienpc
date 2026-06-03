const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { escapeLike, parsePagination } = require('../../utils/parsers');
const { cleanNote, getAdjustedNoteGroups, normalizeNoteKey } = require('../../utils/inventoryNoteGroups');

function mapProduct(row, noteGroups = [], adjustments = []) {
  return {
    product: {
      id: row.id,
      sku: row.sku,
      name: row.name,
      category_id: row.category_id,
      category: {
        id: row.category_id,
        name: row.category_name,
        is_active: row.category_is_active === 1
      },
      total_quantity: Number(row.total_quantity || 0),
      is_active: row.is_active === 1
    },
    note_groups: noteGroups,
    recent_adjustments: adjustments
  };
}

function mapAdjustment(row) {
  const fromNote = cleanNote(row.from_note);
  const toNote = cleanNote(row.to_note);
  return {
    id: row.id,
    product_id: row.product_id,
    from_note: fromNote || '',
    from_label: fromNote || 'Không ghi chú',
    to_note: toNote || '',
    to_label: toNote || 'Không ghi chú',
    quantity: Number(row.quantity || 0),
    reason: row.reason,
    created_by_admin: {
      id: row.admin_id,
      username: row.admin_username
    },
    occurred_at: row.occurred_at
  };
}

async function searchProducts(query) {
  const { page, limit, offset } = parsePagination({
    ...query,
    limit: query.limit || 20
  });
  const keyword = (query.keyword || query.q || '').trim();
  const whereParts = ['p.is_active = 1'];
  const params = [];

  if (keyword) {
    const pattern = `%${escapeLike(keyword)}%`;
    whereParts.push('(p.sku LIKE ? OR p.name LIKE ?)');
    params.push(pattern, pattern);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;
  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM products p
      ${whereSql}
    `,
    params
  );

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.category_id,
        p.is_active,
        c.name AS category_name,
        c.is_active AS category_is_active,
        COALESCE(pib.quantity, 0) AS total_quantity
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    items: rows.map((row) => mapProduct(row).product),
    page,
    limit,
    total: Number(countRows[0].total || 0)
  };
}

async function resolveProductBySku(sku, db = pool, lockBalance = false) {
  const [rows] = await db.query(
    `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.category_id,
        p.is_active,
        c.name AS category_name,
        c.is_active AS category_is_active,
        COALESCE(pib.quantity, 0) AS total_quantity
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id
      WHERE p.sku = ?
      LIMIT 1
    `,
    [sku]
  );

  if (!rows.length) {
    throw new AppError('SKU not found.', 404, 'SKU_NOT_FOUND');
  }

  if (rows[0].is_active !== 1) {
    throw new AppError('Product is inactive.', 400, 'PRODUCT_INACTIVE');
  }

  if (lockBalance) {
    await db.query(
      `
        SELECT id
        FROM product_inventory_balances
        WHERE product_id = ?
        FOR UPDATE
      `,
      [rows[0].id]
    );
  }

  return rows[0];
}

async function listRecentAdjustments(productId, db = pool, limit = 10) {
  const [rows] = await db.query(
    `
      SELECT
        ina.id,
        ina.product_id,
        ina.from_note,
        ina.to_note,
        ina.quantity,
        ina.reason,
        ina.occurred_at,
        a.id AS admin_id,
        a.username AS admin_username
      FROM inventory_note_adjustments ina
      JOIN admins a ON a.id = ina.created_by_admin_id
      WHERE ina.product_id = ?
      ORDER BY ina.id DESC
      LIMIT ?
    `,
    [productId, limit]
  );
  return rows.map(mapAdjustment);
}

async function getProductInventoryCheckBySku(sku) {
  const product = await resolveProductBySku(sku);
  const [noteGroups, adjustments] = await Promise.all([
    getAdjustedNoteGroups(product.id),
    listRecentAdjustments(product.id)
  ]);

  return mapProduct(product, noteGroups, adjustments);
}

async function moveNote({ adminId, sku, fromNote = '', toNote = '', quantity, reason = null }) {
  const parsedQuantity = Number(quantity);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    throw new AppError('quantity must be a positive integer.', 400, 'VALIDATION_ERROR');
  }

  const fromKey = normalizeNoteKey(fromNote);
  const toKey = normalizeNoteKey(toNote);
  if (fromKey === toKey) {
    throw new AppError('from_note and to_note must be different.', 400, 'SAME_NOTE_GROUP');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const product = await resolveProductBySku(sku, connection, true);
    const noteGroups = await getAdjustedNoteGroups(product.id, connection);
    const fromGroup = noteGroups.find((group) => group.note_key === fromKey);

    if (!fromGroup) {
      throw new AppError('Source note group not found.', 404, 'SOURCE_NOTE_GROUP_NOT_FOUND');
    }

    if (Number(fromGroup.quantity || 0) < parsedQuantity) {
      throw new AppError('Source note group does not have enough quantity.', 422, 'INSUFFICIENT_NOTE_GROUP_STOCK', [
        {
          field: 'quantity',
          issue: 'exceeds_source_note_group_stock',
          available: Number(fromGroup.quantity || 0)
        }
      ]);
    }

    const [result] = await connection.query(
      `
        INSERT INTO inventory_note_adjustments
          (product_id, from_note, to_note, quantity, reason, created_by_admin_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [product.id, cleanNote(fromNote), cleanNote(toNote), parsedQuantity, cleanNote(reason), adminId]
    );

    await connection.commit();

    const updated = await getProductInventoryCheckBySku(product.sku);
    return {
      ...updated,
      adjustment: updated.recent_adjustments.find((item) => Number(item.id) === Number(result.insertId)) || null
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getProductInventoryCheckBySku,
  moveNote,
  searchProducts
};
