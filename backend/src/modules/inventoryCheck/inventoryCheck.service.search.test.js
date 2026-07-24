const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../config/database');
const inventoryCheckService = require('./inventoryCheck.service');

const fixtures = [
  {
    id: 1,
    sku: '2nd.main.asus.h610m.k.d4',
    name: 'MB Asus Prime H610M-K D4 2nd',
    category_id: 10,
    is_active: 1,
    category_name: 'Mainboard',
    category_is_active: 1,
    total_quantity: 3
  },
  {
    id: 2,
    sku: '2nd.main.msi.pro.b760m.a.wifi.d4',
    name: 'Mainboard Msi Pro B760M - A Wifi D4 2nd',
    category_id: 10,
    is_active: 1,
    category_name: 'Mainboard',
    category_is_active: 1,
    total_quantity: 2
  },
  {
    id: 3,
    sku: '2nd.main.special',
    name: 'Mainboard 100%_safe\\model',
    category_id: 10,
    is_active: 1,
    category_name: 'Mainboard',
    category_is_active: 1,
    total_quantity: 1
  },
  {
    id: 4,
    sku: '2nd.main.inactive.b760m.a',
    name: 'Mainboard Inactive B760M - A',
    category_id: 10,
    is_active: 0,
    category_name: 'Mainboard',
    category_is_active: 1,
    total_quantity: 0
  }
];

const originalQuery = pool.query;
let latestTokenGroups = [];

function tokenFromPattern(pattern) {
  return String(pattern).slice(1, -1).replace(/\\([%_\\])/g, '$1');
}

function compactValue(value) {
  return String(value).toLowerCase().replace(/[.\-\s]/g, '');
}

pool.query = async (sql, params) => {
  const isResultQuery = /LIMIT \? OFFSET \?/.test(sql);
  const searchParams = isResultQuery ? params.slice(0, -2) : params;
  const tokenGroups = [];

  for (let index = 0; index < searchParams.length; index += 4) {
    assert.equal(searchParams[index], searchParams[index + 1]);
    assert.equal(searchParams[index + 2], searchParams[index + 3]);
    tokenGroups.push({
      rawPattern: searchParams[index],
      compactPattern: searchParams[index + 2],
      rawToken: tokenFromPattern(searchParams[index]),
      compactToken: tokenFromPattern(searchParams[index + 2])
    });
  }
  latestTokenGroups = tokenGroups;

  assert.equal((sql.match(/LOWER\(p\.sku\) LIKE \?/g) || []).length, tokenGroups.length);
  assert.equal((sql.match(/LOWER\(p\.name\) LIKE \?/g) || []).length, tokenGroups.length);
  assert.equal(
    (sql.match(/REPLACE\(REPLACE\(REPLACE\(LOWER\(p\.sku\), '\.', ''\), '-', ''\), ' ', ''\) LIKE \?/g) || []).length,
    tokenGroups.length
  );
  assert.equal(
    (sql.match(/REPLACE\(REPLACE\(REPLACE\(LOWER\(p\.name\), '\.', ''\), '-', ''\), ' ', ''\) LIKE \?/g) || []).length,
    tokenGroups.length
  );
  assert.match(sql, /WHERE p\.is_active = 1/);
  const whereSection = sql.split('WHERE ')[1].split(/ORDER BY|LIMIT/)[0];
  assert.equal((whereSection.match(/\sAND\s/g) || []).length, tokenGroups.length);

  const matches = fixtures.filter((fixture) => {
    if (fixture.is_active !== 1) return false;
    const sku = fixture.sku.toLowerCase();
    const name = fixture.name.toLowerCase();
    const compactSku = compactValue(sku);
    const compactName = compactValue(name);
    return tokenGroups.every(({ rawToken, compactToken }) => (
      sku.includes(rawToken)
      || name.includes(rawToken)
      || compactSku.includes(compactToken)
      || compactName.includes(compactToken)
    ));
  });

  if (/COUNT\(\*\)/.test(sql)) return [[{ total: matches.length }]];
  return [matches];
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
  assert.equal(result.items[0].name, fixtures[0].name);
});

test('matches a compact model token across separated name and SKU segments', async () => {
  for (const keyword of ['B760ma', 'b760m.a', 'b760m-a', 'B760M A']) {
    const result = await search(keyword);
    assert.equal(result.total, 1, keyword);
    assert.equal(result.items[0].id, 2, keyword);
  }
});

test('keeps AND semantics with compact model tokens', async () => {
  const matchingBrand = await search('msi b760ma');
  assert.equal(matchingBrand.total, 1);
  assert.equal(matchingBrand.items[0].id, 2);

  const matchingFeature = await search('b760ma wifi');
  assert.equal(matchingFeature.total, 1);
  assert.equal(matchingFeature.items[0].id, 2);

  const missingToken = await search('b760ma nonexistent');
  assert.equal(missingToken.total, 0);
  assert.deepEqual(missingToken.items, []);
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

test('keeps inactive products excluded', async () => {
  const result = await search('inactive b760ma');
  assert.equal(result.total, 0);
  assert.deepEqual(result.items, []);
});

test('keeps LIKE metacharacters escaped and matched literally', async () => {
  const percentResult = await search('%');
  assert.equal(percentResult.total, 1);
  assert.equal(latestTokenGroups[0].rawPattern, '%\\%%');

  const underscoreResult = await search('_');
  assert.equal(underscoreResult.total, 1);
  assert.equal(latestTokenGroups[0].rawPattern, '%\\_%');

  const backslashResult = await search('\\');
  assert.equal(backslashResult.total, 1);
  assert.equal(latestTokenGroups[0].rawPattern, '%\\\\%');
});

test('limits processing to the first eight non-empty tokens', async () => {
  const result = await search('mainboard msi pro b760m a wifi d4 2nd nonexistent');
  assert.equal(latestTokenGroups.length, 8);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 2);
});
