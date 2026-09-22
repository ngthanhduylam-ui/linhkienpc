const assert = require('node:assert/strict');
const test = require('node:test');
const { pool } = require('../../config/database');
const productService = require('./product.service');

const originalQuery = pool.query;
test.afterEach(() => { pool.query = originalQuery; });

function product(id, name, quantity, isActive = 1) {
  return {
    id, name, sku: `2nd.lcd.fixture.${id}`, total_quantity: quantity,
    is_active: isActive, category_id: 1, category_code: 'lcd',
    category_name: 'Màn hình', category_is_active: 1,
    sale_price: 1500000, image_count: 0, primary_image_id: null
  };
}

// Deterministic pool fixture, following the existing service-test convention.
// It interprets emitted predicates before sorting/paging; never opens a DB connection.
function mockSearch(rows) {
  const queries = [];
  pool.query = async (sql, params = []) => {
    queries.push({ sql, params });
    if (!/FROM products p/.test(sql)) {
      if (/FROM (stock_transactions|inventory_quantity_adjustments|inventory_note_adjustments)/.test(sql)) {
        return [[]];
      }
      if (/FROM product_inventory_balances/.test(sql)) {
        return [rows.filter((row) => params.includes(row.id)).map((row) => ({
          product_id: row.id, quantity: row.total_quantity
        }))];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }

    const where = sql.slice(sql.indexOf('WHERE ')).split(/ORDER BY|LIMIT/)[0];
    const requiresStock = /COALESCE\(pib\.quantity, 0\) > 0/.test(where);
    if (requiresStock) {
      assert.match(sql, /LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id/);
    }
    const isPublic = /p\.is_active = 1/.test(where);
    const tokenParams = params.slice(isPublic ? 0 : 1, /LIMIT \? OFFSET \?/.test(sql) ? -2 : undefined);
    const perToken = 5; // raw sku/name, compact sku/name, category or IN-note.
    assert.equal(tokenParams.length % perToken, 0);
    const patterns = [];
    for (let index = 0; index < tokenParams.length; index += perToken) {
      const group = tokenParams.slice(index, index + perToken);
      assert.equal(group[0], group[1]);
      assert.equal(group[2], group[3]);
      patterns.push(group);
    }
    // Lock the emitted AND between token groups, not just fixture matching.
    assert.equal((where.match(/\(LOWER\(p\.sku\) LIKE \?/g) || []).length, patterns.length);
    assert.equal((where.match(/\) AND \(LOWER\(p\.sku\) LIKE \?/g) || []).length, Math.max(0, patterns.length - 1));
    const literal = (pattern) => pattern.slice(1, -1).replace(/\\([%_\\])/g, '$1');
    const compact = (value) => value.toLowerCase().replace(/[.\- ]/g, '');
    const matches = rows.filter((row) => (
      row.is_active === (isPublic ? 1 : params[0])
      && (!requiresStock || Number(row.total_quantity || 0) > 0)
      && patterns.every(([raw, , condensed]) => (
        row.sku.toLowerCase().includes(literal(raw))
        || row.name.toLowerCase().includes(literal(raw))
        || compact(row.sku).includes(literal(condensed))
        || compact(row.name).includes(literal(condensed))
        || (!isPublic && row.category_name.toLowerCase().includes(literal(raw)))
      ))
    )).sort((a, b) => b.id - a.id);
    if (/SELECT COUNT\(\*\) AS total/.test(sql)) return [[{ total: matches.length }]];
    assert.match(sql, /ORDER BY p\.id DESC\s+LIMIT \? OFFSET \?/);
    const [limit, offset] = params.slice(-2);
    return [matches.slice(offset, offset + limit)];
  };
  return queries;
}

function search(q, overrides = {}) {
  return productService.listAdminProducts({ q, page: 1, limit: 12, is_active: 'true', in_stock: 'true', ...overrides });
}

test('POS excludes zero, negative, missing balances and inactive products', async () => {
  mockSearch([
    product(1, 'Monitor 24"', 2), product(2, 'Monitor 24"', 0),
    product(3, 'Monitor 24"', -1), product(4, 'Monitor 24"', null),
    product(5, 'Monitor 24"', 10, 0)
  ]);
  const result = await search('24"');
  assert.deepEqual(result.items.map((row) => row.id), [1]);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].sale_price, 1500000);
  assert.equal(result.items[0].total_quantity, 2);
  assert.equal(result.items[0].note_groups[0].quantity, 2);
});

test('zero-stock rows cannot consume the result window; count and pagination use the same stock filter', async () => {
  const queries = mockSearch([
    ...Array.from({ length: 20 }, (_, index) => product(100 + index, 'Monitor 24"', 0)),
    product(2, 'Màn hình AOC 24G2 (24" - FHD - IPS -144Hz) 2nd', 1),
    product(1, 'Monitor 24"', 3)
  ]);
  const result = await search('24"', { limit: 1 });
  assert.deepEqual(result.items.map((row) => row.id), [2]);
  assert.equal(result.total, 2);
  assert.equal(result.total_pages, 2);
  const second = await search('24"', { limit: 1, page: 2 });
  assert.deepEqual(second.items.map((row) => row.id), [1]);
  for (const { sql } of queries.filter(({ sql }) => /FROM products p/.test(sql))) {
    assert.match(sql, /WHERE[\s\S]*COALESCE\(pib\.quantity, 0\) > 0/);
    if (sql.includes('LIMIT ?')) {
      assert.ok(sql.indexOf('COALESCE(pib.quantity, 0) > 0') < sql.indexOf('ORDER BY'));
    }
  }
});

test('controlled AOC stock fixture appears in broad and narrow AND searches', async () => {
  mockSearch([
    product(1, 'Màn hình AOC 24G2 (24" - FHD - IPS -144Hz) 2nd', 1),
    product(2, 'Màn hình Asus 24"', 2),
    product(3, 'Màn hình AOC 27"', 3)
  ]);
  assert.deepEqual((await search('24"')).items.map((row) => row.id), [2, 1]);
  assert.deepEqual((await search('  24"   AOC  ')).items.map((row) => row.id), [1]);
  assert.equal((await search('24" nonexistent')).total, 0);
});

test('compact token matching still works across name and SKU', async () => {
  const row = product(1, 'Mainboard MSI B760M - A', 1);
  row.sku = '2nd.main.msi';
  mockSearch([row]);
  assert.deepEqual((await search('b760ma 2nd.main')).items.map((item) => item.id), [1]);
});

test('Admin Products keeps out-of-stock matches when in_stock is absent or false', async () => {
  mockSearch([product(1, 'Monitor 24"', 1), product(2, 'Monitor 24"', 0)]);
  for (const in_stock of [undefined, 'false']) {
    const result = await search('24"', { in_stock });
    assert.deepEqual(result.items.map((row) => row.id), [2, 1]);
    assert.equal(result.total, 2);
  }
});

test('Public retains positive-stock filtering, AND matching and private-price exclusion', async () => {
  mockSearch([
    product(1, 'AOC 24"', 1), product(2, 'AOC 24"', 0),
    product(3, 'Asus 24"', 1), product(4, 'AOC 27"', 1)
  ]);
  const result = await productService.searchPublicProducts({ q: '24" aoc', limit: 12 });
  assert.deepEqual(result.items.map((row) => row.id), [1]);
  assert.equal(result.total, 1);
  assert.equal('sale_price' in result.items[0], false);
});

test('invalid in_stock values fail validation before any database query', async () => {
  let called = false;
  pool.query = async () => { called = true; throw new Error('Unexpected DB call'); };
  await assert.rejects(search('24"', { in_stock: 'invalid' }), { code: 'VALIDATION_ERROR' });
  assert.equal(called, false);
});
