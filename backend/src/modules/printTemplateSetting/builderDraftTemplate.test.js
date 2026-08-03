const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  BUILDER_SCHEMA_VERSION,
  BUILDER_MAX_BLOCKS,
  BUILDER_MAX_CONFIG_BYTES,
  PRODUCT_TABLE_COLUMN_KEYS,
  BUILDER_BLOCK_TYPES,
  validateBuilderDocument,
  createDefaultBuilderDocument,
  cloneBuilderDocument
} = require('./builderDraftTemplate');

function validDocument() {
  return createDefaultBuilderDocument();
}

function expectInvalid(mutator, fieldSuffix = '') {
  const document = validDocument();
  mutator(document);
  assert.throws(
    () => validateBuilderDocument(document),
    (error) => error.code === 'PRINT_TEMPLATE_BUILDER_VALIDATION_ERROR'
      && (!fieldSuffix || error.details.some((detail) => detail.field.endsWith(fieldSuffix)))
  );
}

describe('canonical Builder Draft schema', () => {
  test('default document is canonical, independent, and contains only renderer-neutral template data', () => {
    const first = validDocument();
    const second = validDocument();
    assert.equal(first.builderSchemaVersion, BUILDER_SCHEMA_VERSION);
    assert.deepEqual(first.paper, { size: 'A4', orientation: 'portrait', marginMm: 7, gridMm: 2 });
    assert.deepEqual(validateBuilderDocument(first), first);
    first.blocks[0].xMm = 99;
    assert.notEqual(first.blocks[0].xMm, second.blocks[0].xMm);
    const serialized = JSON.stringify(second);
    for (const forbidden of ['active_template', 'selectedBlockId', 'zoom', 'guides', 'history', 'sampleVoucher', 'sampleCustomer']) {
      assert.equal(serialized.includes(forbidden), false);
    }
  });

  test('supports exactly the approved block types', () => {
    assert.deepEqual(BUILDER_BLOCK_TYPES, [
      'text', 'title', 'logo', 'shopInfo', 'voucherMetadata', 'customerInfo',
      'productTable', 'totals', 'signatures', 'notes', 'horizontalRule'
    ]);
    expectInvalid((document) => { document.blocks[0].type = 'pluginBlock'; }, '.type');
  });

  test('rejects unknown root, paper, block, and props fields', () => {
    expectInvalid((document) => { document.active_template = 'custom'; }, '.active_template');
    expectInvalid((document) => { document.paper.widthMm = 210; }, '.widthMm');
    expectInvalid((document) => { document.blocks[0].selected = true; }, '.selected');
    expectInvalid((document) => { document.blocks[0].props.url = 'https://example.com/logo.png'; }, '.url');
  });

  test('rejects malformed, duplicate, unsafe, or oversized block IDs', () => {
    expectInvalid((document) => { document.blocks[1].id = document.blocks[0].id; }, '.id');
    expectInvalid((document) => { document.blocks[0].id = '../unsafe'; }, '.id');
    expectInvalid((document) => { document.blocks[0].id = `x${'a'.repeat(64)}`; }, '.id');
  });

  test('rejects numeric strings, NaN, Infinity, and out-of-page geometry', () => {
    expectInvalid((document) => { document.blocks[0].xMm = '7'; }, '.xMm');
    expectInvalid((document) => { document.blocks[0].xMm = NaN; }, '.xMm');
    expectInvalid((document) => { document.blocks[0].widthMm = Infinity; }, '.widthMm');
    expectInvalid((document) => { document.blocks[0].xMm = 200; }, 'blocks[0]');
  });

  test('enforces type-specific minimum sizes', () => {
    expectInvalid((document) => { document.blocks.find((block) => block.type === 'productTable').widthMm = 109; }, '.widthMm');
    expectInvalid((document) => { document.blocks.find((block) => block.type === 'logo').heightMm = 9; }, '.heightMm');
  });

  test('enforces A4 portrait paper, margin, and grid bounds', () => {
    expectInvalid((document) => { document.paper.orientation = 'landscape'; }, '.orientation');
    expectInvalid((document) => { document.paper.marginMm = 31; }, '.marginMm');
    expectInvalid((document) => { document.paper.gridMm = 0.5; }, '.gridMm');
    expectInvalid((document) => { document.paper.gridMm = '2'; }, '.gridMm');
  });

  test('enforces block count and UTF-8 config size limits', () => {
    const tooMany = validDocument();
    const seed = tooMany.blocks[0];
    while (tooMany.blocks.length <= BUILDER_MAX_BLOCKS) {
      const index = tooMany.blocks.length;
      tooMany.blocks.push({ ...cloneBuilderDocument(seed), id: `extra-${index}`, zIndex: Math.min(index + 1, BUILDER_MAX_BLOCKS) });
    }
    assert.throws(() => validateBuilderDocument(tooMany), (error) => error.details.some((detail) => detail.field === 'body.draft.blocks'));

    const tooLarge = validDocument();
    tooLarge.blocks.find((block) => block.type === 'notes').props.text = 'ệ'.repeat(BUILDER_MAX_CONFIG_BYTES);
    assert.throws(
      () => validateBuilderDocument(tooLarge),
      (error) => error.statusCode === 413 && error.code === 'PRINT_TEMPLATE_BUILDER_CONFIG_TOO_LARGE'
    );
  });

  test('plain-text fields reject HTML, scripts, expressions, and executable CSS-like payloads', () => {
    for (const value of ['<script>alert(1)</script>', '{{voucher.code}}', '${window.location}', 'javascript:alert(1)', 'color: red;']) {
      expectInvalid((document) => { document.blocks.find((block) => block.type === 'title').props.text = value; }, '.text');
    }
  });

  test('text props use exact fields, primitive booleans, enums, and finite ranges', () => {
    expectInvalid((document) => { document.blocks.find((block) => block.type === 'title').props.bold = 'yes'; }, '.bold');
    expectInvalid((document) => { document.blocks.find((block) => block.type === 'title').props.textAlign = 'justify'; }, '.textAlign');
    expectInvalid((document) => { document.blocks.find((block) => block.type === 'notes').props.lineHeight = 3; }, '.lineHeight');
  });

  test('logo stores only aspect-ratio choice and no URL or path', () => {
    const logo = validDocument().blocks.find((block) => block.type === 'logo');
    assert.deepEqual(Object.keys(logo.props), ['preserveAspectRatio']);
  });

  test('product table requires exact six visibility and width keys', () => {
    const table = validDocument().blocks.find((block) => block.type === 'productTable');
    assert.deepEqual(Object.keys(table.props.columnVisibility), PRODUCT_TABLE_COLUMN_KEYS);
    assert.deepEqual(Object.keys(table.props.columnWidthWeights), PRODUCT_TABLE_COLUMN_KEYS);
    expectInvalid((document) => { delete document.blocks.find((block) => block.type === 'productTable').props.columnWidthWeights.quantity; }, '.quantity');
    expectInvalid((document) => { document.blocks.find((block) => block.type === 'productTable').props.columnVisibility.sku = true; }, '.sku');
    expectInvalid((document) => { document.blocks.find((block) => block.type === 'productTable').props.columnWidthWeights.index = '11'; }, '.index');
  });

  test('horizontal rule accepts only millimetres and solid/dashed styles', () => {
    const document = validDocument();
    const last = document.blocks.length;
    document.blocks.push({
      id: 'rule-1', type: 'horizontalRule', xMm: 10, yMm: 280,
      widthMm: 100, heightMm: 1, zIndex: last + 1, locked: false,
      props: { thicknessMm: 0.3, lineStyle: 'dashed' }
    });
    assert.doesNotThrow(() => validateBuilderDocument(document));
    document.blocks[last].props.lineStyle = 'double';
    assert.throws(() => validateBuilderDocument(document));
  });

  test('validated and cloned responses are structurally independent', () => {
    const source = validDocument();
    const validated = validateBuilderDocument(source);
    const cloned = cloneBuilderDocument(validated);
    cloned.blocks[0].xMm += 10;
    assert.notEqual(cloned.blocks[0].xMm, source.blocks[0].xMm);
  });
});
