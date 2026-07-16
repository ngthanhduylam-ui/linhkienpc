const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../config/database');
const inventoryCheckService = require('./inventoryCheck.service');

const fixture = {
  id: 1,
  sku: '2nd.main.asus.h610m.k.d4',
  name: 'MB Asus Prime H610M-K D4 2nd',
  category_id: 10,
  is_active: 1,
  category_name: 'Mainboard',
  category_is_active: 1,
  total_quantity: 3
};

const originalQuery = pool.query;

function tokenFromPattern(pattern) {
  return String(pattern).slice(1, -1).replace(/\\([%_\\])/g, '$1');
}

pool.query = async (sql, params) => {
  const isResultQuery = /LIMIT \? OFFSET \?/.test(sql);
  const searchParams = isResultQuery ? params.slice(0, -2) : params;
  const tokens = [];

  for (let index = 0; index < searchParams.length; index += 2) {
    assert.equal(searchParams[index], searchParams[index + 1]);
    tokens.push(tokenFromPattern(searchParams[index]));
  }

  const expectedClause = '(LOWER(p.sku) LIKE ? OR LOWER(p.name) LIKE ?)';
  assert.equal(sql.split(expectedClause).length - 1, tokens.length);
  assert.match(sql, /WHERE p\.is_active = 1/);
  const whereSection = sql.split('WHERE ')[1].split(/ORDER BY|LIMIT/)[0];
  assert.equal((whereSection.match(/\sAND\s/g) || []).length, tokens.length);

  const sku = fixture.sku.toLowerCase();
  const name = fixture.name.toLowerCase();
  const matches = tokens.every((token) => sku.includes(token) || name.includes(token));

  if (/COUNT\(\*\)/.test(sql)) return [[{ total: matches ? 1 : 0 }]];
  return [matches ? [fixture] : []];
};

test.after(() => {
  pool.query = originalQuery;
});

async function search(keyword) {
  return inventoryCheckService.searchProducts({ keyword, page: 1, limit: 20 });
}

test('matches words separated inside the product name', async () => {
  const result = await search('Asus h610m');
  assert.equal(result.total, 1);
  assert.equal(result.items[0].name, fixture.name);
});

test('allows one required token to match name and another to match SKU', async () => {
  const result = await search('prime main');
  assert.equal(result.total, 1);
});

test('returns no result when one required token is missing', async () => {
  const result = await search('asus z790');
  assert.equal(result.total, 0);
  assert.deepEqual(result.items, []);
});

test('keeps single-word search working', async () => {
  const result = await search('prime');
  assert.equal(result.total, 1);
});

test('ignores extra whitespace and normalizes case', async () => {
  const result = await search('   ASUS    h610m   ');
  assert.equal(result.total, 1);
});
