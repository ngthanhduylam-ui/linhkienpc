const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifySku,
  parseArguments,
  planProductNameChange,
  summarizePreview,
  validateBackup
} = require('./product-name-suffixes');

test('defaults safely to dry-run and parses explicit modes', () => {
  assert.equal(parseArguments([]).mode, 'dry-run');
  assert.equal(parseArguments(['--dry-run']).mode, 'dry-run');
  assert.equal(parseArguments(['--apply', '--confirm', 'APPLY_PRODUCT_NAME_SUFFIXES']).mode, 'apply');
  const restore = parseArguments(['--restore', './backup.json']);
  assert.equal(restore.mode, 'restore');
  assert.match(restore.restoreFile, /backup\.json$/);
  assert.throws(() => parseArguments(['--apply', '--dry-run']), /Choose only one mode/);
});

test('classifies only the first normalized SKU token', () => {
  assert.equal(classifySku('2nd.main.huananzhi.x99.tf'), '2nd');
  assert.equal(classifySku('2ND.cpu.intel.12400f'), '2nd');
  assert.equal(classifySku('new_cpu_intel_13400'), 'new');
  assert.equal(classifySku('  new-main-asus-b760  '), 'new');
  assert.equal(classifySku('used.cpu.intel'), null);
  assert.equal(classifySku('main.2nd.example'), null);
  assert.equal(classifySku(''), null);
  assert.equal(classifySku(null), null);
});

test('proposes requested suffixes without classifying from product names', () => {
  assert.deepEqual(
    planProductNameChange({ id: 1, sku: '2nd.main.huananzhi.x99.tf', name: 'MB Huananzhi X99 -TF' }),
    {
      product_id: 1,
      sku: '2nd.main.huananzhi.x99.tf',
      old_name: 'MB Huananzhi X99 -TF',
      proposed_new_name: 'MB Huananzhi X99 -TF 2nd',
      classification: '2nd',
      status: 'change',
      reason: 'Append 2nd from the first SKU token.'
    }
  );
  const newProduct = planProductNameChange({ id: 2, sku: 'new.main.asus.b760', name: 'Main Asus B760' });
  assert.equal(newProduct.proposed_new_name, 'Main Asus B760 new');
  assert.equal(newProduct.status, 'change');
});

test('skips correct suffixes and reports opposite suffixes as conflicts', () => {
  assert.equal(planProductNameChange({ id: 1, sku: '2nd.main.x', name: 'Main X 2nd' }).status, 'already_correct');
  assert.equal(planProductNameChange({ id: 2, sku: 'new.main.x', name: 'Main X NEW' }).status, 'already_correct');
  assert.equal(planProductNameChange({ id: 5, sku: '2nd.main.x', name: 'Main X-2nd' }).status, 'already_correct');
  assert.equal(planProductNameChange({ id: 3, sku: '2nd.main.x', name: 'Main X new' }).status, 'conflict');
  assert.equal(planProductNameChange({ id: 4, sku: 'new.main.x', name: 'Main X 2nd' }).status, 'conflict');
});

test('leaves unknown and empty SKU rows unchanged and reports length violations', () => {
  const used = planProductNameChange({ id: 1, sku: 'used.cpu.intel', name: 'Used CPU' });
  const empty = planProductNameChange({ id: 2, sku: null, name: 'No SKU' });
  const tooLong = planProductNameChange({ id: 3, sku: 'new.cpu.x', name: '1234567' }, 10);
  assert.equal(used.status, 'unknown_sku');
  assert.equal(used.proposed_new_name, used.old_name);
  assert.equal(empty.status, 'unknown_sku');
  assert.equal(tooLong.status, 'length_violation');
});

test('summarizes every required dry-run category', () => {
  const rows = [
    planProductNameChange({ id: 1, sku: '2nd.main.x', name: 'Main X' }),
    planProductNameChange({ id: 2, sku: 'new.main.x', name: 'Main X new' }),
    planProductNameChange({ id: 3, sku: '2nd.main.x', name: 'Main X new' }),
    planProductNameChange({ id: 4, sku: 'used.main.x', name: 'Main X' }),
    planProductNameChange({ id: 5, sku: 'new.main.x', name: '1234567' }, 10)
  ];
  assert.deepEqual(summarizePreview(rows), {
    total_products_scanned: 5,
    eligible_2nd: 2,
    eligible_new: 2,
    already_correctly_suffixed: 1,
    conflicting_suffix: 1,
    unknown_or_unclassified_sku: 1,
    names_exceeding_column_length: 1,
    rows_that_would_change: 1
  });
});

test('validates restore backup structure and rejects duplicate IDs', () => {
  const row = {
    product_id: 1,
    sku: '2nd.main.x',
    old_name: 'Main X',
    proposed_new_name: 'Main X 2nd',
    classification: '2nd',
    reason: 'Append 2nd from the first SKU token.',
    status: 'change'
  };
  const backup = {
    schema_version: 1,
    operation: 'append_product_name_condition_suffix',
    products_table: 'products',
    id_column: 'id',
    sku_column: 'sku',
    name_column: 'name',
    name_max_length: 255,
    rows: [row]
  };
  assert.deepEqual(validateBackup(backup), [row]);
  assert.throws(
    () => validateBackup({ ...backup, rows: [row, { ...row }] }),
    /duplicate product id/
  );
  assert.throws(
    () => validateBackup({ ...backup, rows: [{ ...row, proposed_new_name: 'Tampered name' }] }),
    /does not match SKU rules/
  );
});
