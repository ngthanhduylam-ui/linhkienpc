const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../config/database');
const service = require('./skuCategoryRule.service');

const originalQuery = pool.query;

function ruleRow(overrides = {}) {
  return {
    id: 7,
    token: 'main',
    category_id: 3,
    category_name: 'Mainboard',
    category_is_active: 1,
    created_at: '2026-07-29 10:00:00',
    updated_at: '2026-07-29 10:00:00',
    ...overrides
  };
}

function mockQueries(t, responses, queries = []) {
  let index = 0;
  pool.query = async (sql, params = []) => {
    queries.push({ sql: String(sql), params });
    const response = responses[index];
    index += 1;
    if (response instanceof Error) throw response;
    if (typeof response === 'function') return response(sql, params);
    return response;
  };
  t.after(() => {
    pool.query = originalQuery;
  });
  return queries;
}

test('lists rules with current category information', async (t) => {
  const queries = mockQueries(t, [[[
    ruleRow(),
    ruleRow({
      id: 8,
      token: 'fcpu',
      category_id: 9,
      category_name: 'Tản nhiệt CPU',
      category_is_active: 0
    }),
    ruleRow({
      id: 9,
      token: 'orphaned',
      category_id: null,
      category_name: null,
      category_is_active: null
    })
  ]]]);
  const rules = await service.listRules();
  assert.equal(rules.length, 3);
  assert.equal(rules[0].category_available, true);
  assert.equal(rules[1].category_name, 'Tản nhiệt CPU');
  assert.equal(rules[1].category_available, false);
  assert.equal(rules[2].category_id, null);
  assert.equal(rules[2].category_available, false);
  assert.match(queries[0].sql, /LEFT JOIN categories/);
});

test('creates a valid rule and normalizes trim and letter case', async (t) => {
  const queries = mockQueries(t, [
    [[{ id: 3 }]],
    [[]],
    [{ insertId: 7, affectedRows: 1 }],
    [[ruleRow()]]
  ]);
  const created = await service.createRule({ token: '  MAIN  ', category_id: 3 });
  assert.equal(created.token, 'main');
  assert.deepEqual(queries[1].params, ['main']);
  assert.deepEqual(queries[2].params, ['main', 3]);
});

test('rejects duplicate tokens including a different letter case', async (t) => {
  mockQueries(t, [
    [[{ id: 3 }]],
    [[{ id: 7 }]]
  ]);
  await assert.rejects(
    service.createRule({ token: 'MAIN', category_id: 3 }),
    (error) => error.statusCode === 409 && error.code === 'SKU_CATEGORY_RULE_TOKEN_EXISTS'
  );
});

test('rejects empty, dotted and whitespace-containing tokens', () => {
  assert.throws(() => service.validateToken('   '), /required/i);
  assert.throws(() => service.validateToken('main.board'), /dot/i);
  assert.throws(() => service.validateToken('main board'), /whitespace/i);
  assert.throws(() => service.validateToken('main\tboard'), /whitespace/i);
  assert.throws(() => service.validateToken('main\u00a0board'), /whitespace/i);
});

test('rejects a missing category', async (t) => {
  mockQueries(t, [[[]]]);
  await assert.rejects(
    service.createRule({ token: 'main', category_id: 999 }),
    (error) => error.statusCode === 404 && error.code === 'CATEGORY_NOT_FOUND'
  );
});

test('updates token and category without touching products', async (t) => {
  const queries = mockQueries(t, [
    [[ruleRow()]],
    [[{ id: 8 }]],
    [[]],
    [{ affectedRows: 1 }],
    [[ruleRow({ token: 'mb', category_id: 8, category_name: 'Mainboard mới' })]]
  ]);
  const updated = await service.updateRule(7, { token: ' MB ', category_id: 8 });
  assert.equal(updated.token, 'mb');
  assert.equal(updated.category_id, 8);
  assert.match(queries[2].sql, /token = \? AND id <> \? LIMIT 1/);
  assert.deepEqual(queries[2].params, ['mb', 7]);
  assert.deepEqual(queries[3].params, ['mb', 8, 7]);
  assert.equal(queries.some(({ sql }) => /\bUPDATE\s+products\b/i.test(sql)), false);
});

test('database duplicate errors still protect against create races', async (t) => {
  const duplicate = Object.assign(new Error('Duplicate entry main'), { code: 'ER_DUP_ENTRY' });
  mockQueries(t, [
    [[{ id: 3 }]],
    [[]],
    duplicate
  ]);
  await assert.rejects(
    service.createRule({ token: 'main', category_id: 3 }),
    (error) => error.statusCode === 409 && error.code === 'SKU_CATEGORY_RULE_TOKEN_EXISTS'
  );
});

test('deletes only the rule and does not update products', async (t) => {
  const queries = mockQueries(t, [
    [[ruleRow()]],
    [{ affectedRows: 1 }]
  ]);
  const deleted = await service.deleteRule(7);
  assert.equal(deleted.token, 'main');
  assert.match(queries[1].sql, /^DELETE FROM sku_category_rules/i);
  assert.equal(queries.some(({ sql }) => /\b(?:UPDATE|DELETE FROM)\s+products\b/i.test(sql)), false);
});

test('Admin rule endpoint requires authentication', async () => {
  const app = require('../../app');
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/sku-category-rules`);
    const payload = await response.json();
    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'AUTH_TOKEN_MISSING');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
