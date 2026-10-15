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

    const where = sql.includes('WHERE ') ? sql.slice(sql.indexOf('WHERE ')).split(/ORDER BY|LIMIT/)[0] : '';
    const requiresStock = /COALESCE\(pib\.quantity, 0\) > 0/.test(where);
    if (requiresStock) {
      assert.match(sql, /LEFT JOIN product_inventory_balances pib ON pib.product_id = p.id/);
    }
    const isPublic = /p\.is_active = 1/.test(where);
    const hasStatusParam = /p\.is_active = \?/.test(where);
    const tokenParams = params.slice(hasStatusParam ? 1 : 0, /LIMIT \? OFFSET \?/.test(sql) ? -2 : undefined);
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
      (!isPublic || row.is_active === 1)
      && (!hasStatusParam || row.is_active === params[0])
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

test('Stock In searches the whole catalogue before paging and includes zero stock with AND/model/SKU queries', async () => {
  const target = product(1, 'Màn hình AOC Gaming 24G50Z/71 (24 inch) IPS', 1);
  const zeroStock = product(2, target.name, 0);
  target.sku = 'lcd.aoc.24g50z.71';
  zeroStock.sku = 'lcd.aoc.zero';
  const queries = mockSearch([
    target, zeroStock,
    ...Array.from({ length: 350 }, (_, i) => product(100 + i, `RAM fixture ${i}`, 1)),
    product(3, target.name, 1, 0)
  ]);
  const preload = await productService.listAdminProducts({ page: 1, limit: 100 });
  assert.equal(preload.items.length, 100);
  assert.equal(preload.items.some((row) => row.id === target.id), false);
  for (const q of ['Aoc 24', '24g50z', target.sku, zeroStock.sku]) {
    const result = await productService.listAdminProducts({ q, page: 1, limit: 14, is_active: 'true' });
    assert.deepEqual(result.items.map((row) => row.id), q === target.sku ? [1] : q === zeroStock.sku ? [2] : [2, 1]);
  }
  for (const { sql } of queries.filter(({ sql }) => /FROM products p/.test(sql))) {
    assert.doesNotMatch(sql, /COALESCE\(pib\.quantity, 0\) > 0/);
  }
});

test('Public retains positive-stock filtering, AND matching and private-price exclusion', async () => {
  mockSearch([
    product(1, 'AOC 24"', 1), product(2, 'AOC 24"', 0),
    product(3, 'Asus 24"', 1), product(4, 'AOC 27"', 1), product(5, 'AOC 24"', 4, 0)
  ]);
  const result = await productService.searchPublicProducts({ q: '24" aoc', limit: 12, is_active: 'all' });
  assert.deepEqual(result.items.map((row) => row.id), [1]);
  assert.equal(result.total, 1);
  assert.equal('sale_price' in result.items[0], false);
});

test('Admin ALL, ACTIVE and INACTIVE combine with search before count and pagination, including zero stock', async () => {
  const queries = mockSearch([
    product(1, 'AOC Gaming 24 inch', 0), product(2, 'AOC Gaming 24 inch', 0, 0),
    product(3, 'AOC Gaming 24 inch', 3), product(4, 'AOC Gaming 24 inch', 2, 0),
    product(5, 'AOC 27 inch', 1), product(6, 'Asus 24 inch', 1, 0)
  ]);
  const all = await productService.listAdminProducts({ is_active: 'all' });
  assert.deepEqual(all.items.map((row) => row.id), [6, 5, 4, 3, 2, 1]);
  assert.equal(all.total, 6);
  for (const [is_active, expected] of [['all', [4, 3, 2, 1]], ['true', [3, 1]], ['false', [4, 2]]]) {
    const ids = [];
    for (let page = 1; page <= expected.length; page++) {
      const result = await productService.listAdminProducts({ q: 'aoc 24', is_active, page, limit: 1 });
      assert.equal(result.total, expected.length);
      assert.equal(result.total_pages, expected.length);
      assert.equal(result.page, page);
      assert.equal(result.limit, 1);
      ids.push(...result.items.map((row) => row.id));
      if (is_active !== 'all') assert.ok(result.items.every((row) => row.is_active === (is_active === 'true')));
    }
    assert.deepEqual(ids, expected);
  }
  const productQueries = queries.filter(({ sql }) => /FROM products p/.test(sql));
  for (let i = 0; i < productQueries.length; i += 2) {
    const count = productQueries[i];
    const data = productQueries[i + 1];
    assert.deepEqual(count.params, data.params.slice(0, -2));
    const predicates = (sql) => (sql.match(/WHERE ([\s\S]*?)(?:ORDER BY|$)/)?.[1] || '').trim();
    assert.equal(predicates(count.sql), predicates(data.sql));
    assert.doesNotMatch(count.sql, /COALESCE\(pib\.quantity, 0\) > 0/);
  }
});

test('Admin missing/empty status retains active default and existing boolean spellings remain valid', async () => {
  mockSearch([product(1, 'Monitor', 0), product(2, 'Monitor', 2, 0)]);
  for (const is_active of [undefined, null, '', true, 'true', 1, '1']) {
    assert.deepEqual((await productService.listAdminProducts({ is_active })).items.map((row) => row.id), [1]);
  }
  for (const is_active of [false, 'false', 0, '0']) {
    assert.deepEqual((await productService.listAdminProducts({ is_active })).items.map((row) => row.id), [2]);
  }
});

test('Admin invalid status still fails validation before querying the database', async () => {
  pool.query = async () => { assert.fail('Invalid status must not query the database'); };
  for (const is_active of ['ALL', 'invalid', ['all'], {}]) {
    await assert.rejects(productService.listAdminProducts({ is_active }), { code: 'VALIDATION_ERROR' });
  }
});

test('invalid in_stock values fail validation before any database query', async () => {
  let called = false;
  pool.query = async () => { called = true; throw new Error('Unexpected DB call'); };
  await assert.rejects(search('24"', { in_stock: 'invalid' }), { code: 'VALIDATION_ERROR' });
  assert.equal(called, false);
});
