const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../../config/database');
const productService = require('./product.service');

const originalQuery = pool.query;

test.afterEach(() => {
  pool.query = originalQuery;
});

function mockPublicInventoryFixture({ isActive, quantity }) {
  const fixture = {
    id: 73,
    sku: '2nd.cpu.intel.i5.12400',
    name: 'CPU Intel Core i5 12400 2nd',
    is_active: isActive ? 1 : 0,
    total_quantity: quantity,
    image_count: 0,
    primary_image_id: null
  };
  const queries = [];

  pool.query = async (sql, params) => {
    queries.push({ sql, params });

    if (/FROM products p[\s\S]*WHERE p\.sku = \?/i.test(sql)) {
      const requiresActiveProduct = /p\.is_active = 1/i.test(sql);
      const requiresPositiveStock = /COALESCE\(pib\.quantity, 0\) > 0/i.test(sql);
      const isVisible = (!requiresActiveProduct || isActive) && (!requiresPositiveStock || quantity > 0);
      return [isVisible ? [fixture] : []];
    }

    if (/FROM stock_transactions/i.test(sql)) return [[]];
    if (/FROM inventory_quantity_adjustments/i.test(sql)) return [[]];
    if (/FROM inventory_note_adjustments/i.test(sql)) return [[]];
    if (/FROM product_inventory_balances/i.test(sql)) {
      return [[{ product_id: fixture.id, quantity }]];
    }

    throw new Error(`Unexpected query: ${sql}`);
  };

  return queries;
}

function assertPublicInventoryFilters(sql) {
  assert.match(sql, /p\.sku = \?/i);
  assert.match(sql, /p\.is_active = 1/i);
  assert.match(sql, /COALESCE\(pib\.quantity, 0\) > 0/i);
}

function assertSkuNotFound(error) {
  return error.statusCode === 404 && error.code === 'SKU_NOT_FOUND';
}

test('active product with positive stock remains available through public SKU inventory lookup', async () => {
  const queries = mockPublicInventoryFixture({ isActive: true, quantity: 5 });

  const result = await productService.getPublicInventoryBySku('2nd.cpu.intel.i5.12400');
  const lookupQuery = queries.find(({ sql }) => /FROM products p[\s\S]*WHERE p\.sku = \?/i.test(sql));

  assertPublicInventoryFilters(lookupQuery.sql);
  assert.deepEqual(lookupQuery.params, ['2nd.cpu.intel.i5.12400']);
  assert.equal(result.product.id, 73);
  assert.equal(result.product.total_quantity, 5);
  assert.equal(result.product.is_active, true);
  assert.equal('sku' in result.product, false);
});

test('active product with zero stock is hidden as SKU_NOT_FOUND', async () => {
  const queries = mockPublicInventoryFixture({ isActive: true, quantity: 0 });

  await assert.rejects(
    productService.getPublicInventoryBySku('2nd.cpu.intel.i5.12400'),
    assertSkuNotFound
  );

  assertPublicInventoryFilters(queries[0].sql);
  assert.equal(queries.length, 1);
});

test('inactive product remains hidden as SKU_NOT_FOUND', async () => {
  const queries = mockPublicInventoryFixture({ isActive: false, quantity: 5 });

  await assert.rejects(
    productService.getPublicInventoryBySku('2nd.cpu.intel.i5.12400'),
    assertSkuNotFound
  );

  assertPublicInventoryFilters(queries[0].sql);
  assert.equal(queries.length, 1);
});
