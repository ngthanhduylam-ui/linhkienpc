const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../../config/database');
const productService = require('./product.service');

const originalQuery = pool.query;

test.afterEach(() => {
  pool.query = originalQuery;
});

async function searchWithDescription(specSummary) {
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/SELECT COUNT\(\*\) AS total/i.test(sql)) return [[{ total: 1 }]];
    if (/ORDER BY p\.id DESC/i.test(sql)) {
      return [[{
        id: 41,
        sku: '2nd.psu.asus.rog.strix.1000w',
        name: 'Nguồn ASUS ROG STRIX 1000W 2nd',
        spec_summary: specSummary,
        category_name: 'Nguồn',
        sale_price: 2500000,
        total_quantity: 2,
        image_count: 1,
        primary_image_id: 7
      }]];
    }
    if (/FROM stock_transactions/i.test(sql)) return [[]];
    if (/FROM inventory_quantity_adjustments/i.test(sql)) return [[]];
    if (/FROM inventory_note_adjustments/i.test(sql)) return [[]];
    if (/FROM product_inventory_balances/i.test(sql)) return [[{ product_id: 41, quantity: 2 }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const result = await productService.searchPublicProducts({ q: 'asus rog', page: 1, limit: 20 });
  return { result, queries };
}

test('public search returns the canonical spec_summary without changing availability filtering', async () => {
  const { result, queries } = await searchWithDescription('2 dây CPU');
  const productQuery = queries.find(({ sql }) => /ORDER BY p\.id DESC/i.test(sql));

  assert.match(productQuery.sql, /p\.spec_summary/i);
  assert.match(productQuery.sql, /p\.is_active = 1/i);
  assert.match(productQuery.sql, /COALESCE\(pib\.quantity, 0\) > 0/i);
  assert.equal(result.items[0].spec_summary, '2 dây CPU');
  assert.equal(result.items[0].name, 'Nguồn ASUS ROG STRIX 1000W 2nd');
  assert.equal(result.items[0].total_quantity, 2);
  assert.equal('sale_price' in result.items[0], false);
  assert.equal('sku' in result.items[0], false);
  assert.equal('purchase_price' in result.items[0], false);
  assert.equal('cost' in result.items[0], false);
});

test('a null public product description remains null', async () => {
  const { result } = await searchWithDescription(null);
  assert.equal(result.items[0].spec_summary, null);
});
