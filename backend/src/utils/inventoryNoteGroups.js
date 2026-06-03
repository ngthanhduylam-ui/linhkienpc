const { pool } = require('../config/database');

const NO_NOTE_WARRANTY_KEY = '__NO_NOTE__';

function normalizeNoteKey(note) {
  if (note === NO_NOTE_WARRANTY_KEY) {
    return '';
  }
  return (note || '').trim().toUpperCase().replace(/\s+/g, '');
}

function cleanNote(note) {
  const value = note === undefined || note === null ? '' : String(note).trim();
  return value || null;
}

function displayNoteFromKey(noteKey, displayNote) {
  return noteKey ? displayNote || noteKey : '';
}

function createEmptyGroup(productId, noteKey, displayNote = null) {
  const note = displayNoteFromKey(noteKey, displayNote);
  return {
    product_id: productId,
    note_key: noteKey,
    note,
    quantity: 0
  };
}

function addQuantity(groupMap, productId, rawNote, quantity) {
  const noteKey = normalizeNoteKey(rawNote);
  const displayNote = cleanNote(rawNote);
  const key = `${productId}:${noteKey}`;

  if (!groupMap.has(key)) {
    groupMap.set(key, createEmptyGroup(productId, noteKey, displayNote));
  }

  const group = groupMap.get(key);
  if (!group.note && displayNote) {
    group.note = displayNote;
  }
  group.quantity += Number(quantity || 0);
}

async function getProductQuantities(productIds, db = pool) {
  if (!productIds.length) {
    return new Map();
  }

  const placeholders = productIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `
      SELECT product_id, quantity
      FROM product_inventory_balances
      WHERE product_id IN (${placeholders})
    `,
    productIds
  );

  return new Map(rows.map((row) => [Number(row.product_id), Math.max(Number(row.quantity || 0), 0)]));
}

async function buildAdjustedNoteGroupMap(productIds, db = pool) {
  const uniqueProductIds = [...new Set(productIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!uniqueProductIds.length) {
    return new Map();
  }

  const placeholders = uniqueProductIds.map(() => '?').join(',');
  const groupMap = new Map();

  const [stockRows] = await db.query(
    `
      SELECT product_id, txn_type, quantity, note
      FROM stock_transactions
      WHERE product_id IN (${placeholders})
        AND txn_type IN ('IN', 'OUT')
    `,
    uniqueProductIds
  );

  for (const row of stockRows) {
    const signedQuantity = row.txn_type === 'IN' ? Number(row.quantity || 0) : -Number(row.quantity || 0);
    addQuantity(groupMap, Number(row.product_id), row.note, signedQuantity);
  }

  const [adjustmentRows] = await db.query(
    `
      SELECT product_id, from_note, to_note, quantity
      FROM inventory_note_adjustments
      WHERE product_id IN (${placeholders})
    `,
    uniqueProductIds
  );

  for (const row of adjustmentRows) {
    const quantity = Number(row.quantity || 0);
    addQuantity(groupMap, Number(row.product_id), row.from_note, -quantity);
    addQuantity(groupMap, Number(row.product_id), row.to_note, quantity);
  }

  const quantityMap = await getProductQuantities(uniqueProductIds, db);
  const remainingByProduct = new Map(uniqueProductIds.map((id) => [id, quantityMap.get(id) || 0]));
  const resultMap = new Map();
  const groups = [...groupMap.values()].sort((a, b) => {
    if (a.product_id !== b.product_id) {
      return a.product_id - b.product_id;
    }
    if (a.note_key === '') return -1;
    if (b.note_key === '') return 1;
    return a.note_key.localeCompare(b.note_key);
  });

  for (const group of groups) {
    const productId = Number(group.product_id);
    const remainingProductQuantity = remainingByProduct.get(productId) || 0;
    const quantity = Math.min(Math.max(Number(group.quantity || 0), 0), remainingProductQuantity);
    if (quantity <= 0) {
      continue;
    }

    if (!resultMap.has(productId)) {
      resultMap.set(productId, []);
    }

    resultMap.get(productId).push({
      note: group.note || '',
      note_key: group.note_key,
      label: group.note || 'Không ghi chú',
      quantity,
      is_no_note: group.note_key === ''
    });
    remainingByProduct.set(productId, remainingProductQuantity - quantity);
  }

  return resultMap;
}

async function getAdjustedNoteGroups(productId, db = pool) {
  const map = await buildAdjustedNoteGroupMap([productId], db);
  return map.get(Number(productId)) || [];
}

module.exports = {
  NO_NOTE_WARRANTY_KEY,
  buildAdjustedNoteGroupMap,
  cleanNote,
  getAdjustedNoteGroups,
  normalizeNoteKey
};
