const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../../config/database');
const productService = require('./product.service');

const originalQuery = pool.query;

test.afterEach(() => {
  pool.query = originalQuery;
});

function installRecentStockRows(rows) {
  const queries = [];
  pool.query = async (sql, params = []) => {
    queries.push({ sql, params });

    if (/MAX\(stock_updated_at\)/i.test(sql)) {
      return [rows];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  return queries;
}

function recentRow(id, overrides = {}) {
  return {
    id,
    sku: `2nd.cpu.recent.${id}`,
    name: `Recent product ${id}`,
    spec_summary: null,
    category_name: 'CPU',
    total_quantity: 3,
    image_count: 0,
    primary_image_id: null,
    stock_updated_at: `2026-08-24 0${Math.min(id, 9)}:00:00`,
    sale_price: 999999,
    ...overrides
  };
}

test('derives only eligible stock-changing events inside the rolling 72-hour window', async () => {
  const queries = installRecentStockRows([recentRow(1)]);
  await productService.listPublicRecentStockUpdates();
  const sql = queries[0].sql;

  assert.match(sql, /SELECT id AS product_id, created_at AS stock_updated_at[\s\S]*FROM products/i);
  assert.match(sql, /FROM stock_transactions[\s\S]*txn_type = 'IN'/i);
  assert.match(sql, /FROM inventory_quantity_adjustments[\s\S]*from_quantity <> to_quantity/i);
  assert.equal((sql.match(/INTERVAL 72 HOUR/gi) || []).length, 3);
  assert.doesNotMatch(sql, /p\.updated_at|txn_type = 'OUT'/i);
});

test('deduplicates by product at its newest eligible event and sorts newest first', async () => {
  const queries = installRecentStockRows([recentRow(2), recentRow(1)]);
  const result = await productService.listPublicRecentStockUpdates();
  const sql = queries[0].sql;

  assert.match(sql, /SELECT product_id, MAX\(stock_updated_at\) AS stock_updated_at/i);
  assert.match(sql, /GROUP BY product_id/i);
  assert.match(sql, /ORDER BY recent\.stock_updated_at DESC, p\.id DESC/i);
  assert.deepEqual(result.items.map((item) => item.id), [2, 1]);
});

test('keeps only active positive-stock products and never fills from older events', async () => {
  const queries = installRecentStockRows([recentRow(1)]);
  await productService.listPublicRecentStockUpdates();
  const sql = queries[0].sql;

  assert.match(sql, /WHERE p\.is_active = 1[\s\S]*COALESCE\(pib\.quantity, 0\) > 0/i);
  assert.match(sql, /LIMIT 10/i);
  assert.doesNotMatch(sql, /updated_at AS stock_updated_at/i);
});

test('caps the public DTO at ten products and omits SKU, prices, actors, and internal event data', async () => {
  installRecentStockRows(Array.from({ length: 12 }, (_, index) => recentRow(index + 1)));
  const result = await productService.listPublicRecentStockUpdates();

  assert.equal(result.items.length, 10);
  assert.equal(result.limit, 10);
  assert.equal(result.windowHours, 72);
  assert.deepEqual(Object.keys(result.items[0]), [
    'id',
    'name',
    'condition',
    'category_name',
    'spec_summary',
    'total_quantity',
    'stock_updated_at',
    'image_count',
    'primary_image_id'
  ]);
  for (const privateField of ['sku', 'sale_price', 'cost', 'supplier', 'admin', 'transaction_id', 'quantity_delta', 'event_type']) {
    assert.equal(privateField in result.items[0], false);
  }
});
