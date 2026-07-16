const test = require('node:test');
const assert = require('node:assert/strict');
const {
  APPLY_CONFIRMATION,
  MATCHING_PRODUCTS_SQL,
  applyChanges,
  parseArguments,
  planProductNameChange
} = require('./rename-mainboard-product-prefix');

test('replaces only the standalone leading MB prefix and preserves the remainder exactly', () => {
  assert.deepEqual(
    planProductNameChange({
      id: 12,
      category_name: 'Mainboard',
      name: 'MB Asus H610M - K D4 2nd'
    }),
    {
      product_id: 12,
      old_name: 'MB Asus H610M - K D4 2nd',
      proposed_new_name: 'Mainboard Asus H610M - K D4 2nd'
    }
  );

  assert.equal(
    planProductNameChange({ id: 13, category_name: 'Mainboard', name: 'MB MSI B760M-B new' })
      .proposed_new_name,
    'Mainboard MSI B760M-B new'
  );
  assert.equal(
    planProductNameChange({ id: 14, category_name: 'Mainboard', name: 'MB Gigabyte B550M 2nd' })
      .proposed_new_name,
    'Mainboard Gigabyte B550M 2nd'
  );
});

test('does not match middle text, joined prefixes, renamed rows, or another category', () => {
  assert.equal(
    planProductNameChange({ id: 1, category_name: 'Mainboard', name: 'Asus MB H610M' }),
    null
  );
  assert.equal(
    planProductNameChange({ id: 2, category_name: 'Mainboard', name: 'MBAsus H610M' }),
    null
  );
  assert.equal(
    planProductNameChange({ id: 3, category_name: 'Mainboard', name: 'Mainboard Asus H610M' }),
    null
  );
  assert.equal(
    planProductNameChange({ id: 4, category_name: 'CPU', name: 'MB Asus H610M' }),
    null
  );
});

test('SQL selects by actual category and leading standalone MB without SKU inference', () => {
  assert.match(MATCHING_PRODUCTS_SQL, /JOIN categories c ON c\.id = p\.category_id/);
  assert.match(MATCHING_PRODUCTS_SQL, /BINARY c\.name = \?/);
  assert.match(MATCHING_PRODUCTS_SQL, /BINARY p\.name = 'MB'/);
  assert.match(MATCHING_PRODUCTS_SQL, /BINARY p\.name LIKE 'MB %'/);
  assert.doesNotMatch(MATCHING_PRODUCTS_SQL, /REGEXP/i);
  assert.doesNotMatch(MATCHING_PRODUCTS_SQL, /sku/i);
});

test('defaults to dry-run and requires the explicit apply mode and confirmation value', () => {
  assert.deepEqual(parseArguments([]), { mode: 'dry-run', confirmation: null });
  assert.equal(parseArguments(['--dry-run']).mode, 'dry-run');
  assert.deepEqual(parseArguments(['--apply', '--confirm', APPLY_CONFIRMATION]), {
    mode: 'apply',
    confirmation: APPLY_CONFIRMATION
  });
  assert.throws(() => parseArguments(['--dry-run', '--apply']), /Choose only one mode/);
});

test('apply updates only name, verifies idempotency, and commits', async () => {
  const calls = [];
  let matchingReadCount = 0;
  const connection = {
    async beginTransaction() {
      calls.push(['begin']);
    },
    async query(sql, params) {
      calls.push(['query', sql, params]);
      if (sql.includes('SELECT p.id, p.name')) {
        matchingReadCount += 1;
        return matchingReadCount === 1
          ? [[{ id: 21, category_name: 'Mainboard', name: 'MB Asus H610M 2nd' }]]
          : [[]];
      }
      if (sql.startsWith('UPDATE products SET name = ?')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async commit() {
      calls.push(['commit']);
    },
    async rollback() {
      calls.push(['rollback']);
    }
  };

  const result = await applyChanges(connection, 255);
  assert.equal(result.affectedRows, 1);
  const update = calls.find((call) => call[0] === 'query' && call[1].startsWith('UPDATE'));
  assert.equal(update[1], 'UPDATE products SET name = ? WHERE id = ? AND BINARY name = ?');
  assert.deepEqual(update[2], ['Mainboard Asus H610M 2nd', 21, 'MB Asus H610M 2nd']);
  assert.ok(calls.some((call) => call[0] === 'commit'));
  assert.ok(!calls.some((call) => call[0] === 'rollback'));
});

test('apply rolls back when affected-row verification fails', async () => {
  let rolledBack = false;
  const connection = {
    async beginTransaction() {},
    async query(sql) {
      if (sql.includes('SELECT p.id, p.name')) {
        return [[{ id: 22, category_name: 'Mainboard', name: 'MB Asus B760M-B' }]];
      }
      return [{ affectedRows: 0 }];
    },
    async commit() {},
    async rollback() {
      rolledBack = true;
    }
  };

  await assert.rejects(() => applyChanges(connection, 255), /Concurrent edit or missing product/);
  assert.equal(rolledBack, true);
});
