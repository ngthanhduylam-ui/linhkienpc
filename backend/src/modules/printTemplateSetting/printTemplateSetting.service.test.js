const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../config/database');
const service = require('./printTemplateSetting.service');
const controller = require('./printTemplateSetting.controller');
const {
  SYSTEM_TEMPLATE_CONFIG,
  SYSTEM_TEMPLATE_SCHEMA_VERSION,
  MAX_CONFIG_BYTES,
  PRODUCT_TABLE_COLUMN_KEYS,
  VERSION_2_LAYOUT_DEFAULTS,
  VERSION_3_PRODUCT_TABLE_WIDTH_DEFAULTS,
  cloneSystemTemplateConfig,
  validateCustomTemplateConfig,
  upgradeSaleDeliveryNoteConfigToLatest
} = require('./saleDeliveryNoteTemplate');

const originalQuery = pool.query;
const originalGetConnection = pool.getConnection;

function cloneSystemConfig() {
  return JSON.parse(JSON.stringify(SYSTEM_TEMPLATE_CONFIG));
}

function legacyConfig() {
  const config = cloneSystemConfig();
  config.schemaVersion = 1;
  Object.keys(VERSION_2_LAYOUT_DEFAULTS).forEach((sectionName) => {
    Object.keys(VERSION_2_LAYOUT_DEFAULTS[sectionName]).forEach((field) => {
      delete config.sections[sectionName][field];
    });
  });
  delete config.sections.productTable.columnWidthWeights;
  return config;
}

function version2Config() {
  const config = cloneSystemConfig();
  config.schemaVersion = 2;
  delete config.sections.productTable.columnWidthWeights;
  return config;
}

function settingsRow(overrides = {}) {
  return {
    id: 1,
    document_type: 'sale_delivery_note',
    active_template: 'system',
    custom_template_config: null,
    custom_template_schema_version: null,
    created_at: '2026-08-03 10:00:00',
    updated_at: '2026-08-03 10:00:00',
    ...overrides
  };
}

function mockPoolQuery(t, responses, queries = []) {
  let index = 0;
  pool.query = async (sql, params = []) => {
    queries.push({ sql: String(sql), params });
    const response = responses[index++];
    if (response instanceof Error) throw response;
    if (typeof response === 'function') return response(sql, params);
    return response;
  };
  t.after(() => {
    pool.query = originalQuery;
  });
  return queries;
}

function mockTransactions(t, responses, queries = []) {
  let index = 0;
  const lifecycle = [];
  const connection = {
    beginTransaction: async () => lifecycle.push('begin'),
    commit: async () => lifecycle.push('commit'),
    rollback: async () => lifecycle.push('rollback'),
    release: () => lifecycle.push('release'),
    query: async (sql, params = []) => {
      queries.push({ sql: String(sql), params });
      const response = responses[index++];
      if (response instanceof Error) throw response;
      if (typeof response === 'function') return response(sql, params);
      return response;
    }
  };
  pool.getConnection = async () => connection;
  t.after(() => {
    pool.getConnection = originalGetConnection;
  });
  return { queries, lifecycle };
}

describe('print template settings service', { concurrency: false }, () => {
test('system template definition is immutable and validates as schema version 3', () => {
  assert.equal(SYSTEM_TEMPLATE_SCHEMA_VERSION, 3);
  assert.equal(Object.isFrozen(SYSTEM_TEMPLATE_CONFIG), true);
  assert.equal(Object.isFrozen(SYSTEM_TEMPLATE_CONFIG.sections.productTable), true);
  assert.equal(Object.isFrozen(SYSTEM_TEMPLATE_CONFIG.sections.productTable.columnWidthWeights), true);
  assert.deepEqual(SYSTEM_TEMPLATE_CONFIG.sections.productTable.columnWidthWeights, VERSION_3_PRODUCT_TABLE_WIDTH_DEFAULTS);
  assert.deepEqual(validateCustomTemplateConfig(cloneSystemConfig()), cloneSystemConfig());
});

test('returned system config is a structurally independent safe clone', () => {
  const first = cloneSystemTemplateConfig();
  const second = cloneSystemTemplateConfig();
  first.sections.documentTitle.text = 'Changed by API client';
  first.sections.productTable.columnWidthWeights.index = 99;
  assert.notEqual(first.sections.documentTitle.text, second.sections.documentTitle.text);
  assert.equal(second.sections.productTable.columnWidthWeights.index, 11);
  assert.equal(SYSTEM_TEMPLATE_CONFIG.sections.productTable.columnWidthWeights.index, 11);
  assert.equal(
    SYSTEM_TEMPLATE_CONFIG.sections.documentTitle.text,
    'PHIẾU BÁN & GIAO HÀNG'
  );
});

test('version 1 upgrades sequentially to version 3 without mutating content or visibility', () => {
  const source = legacyConfig();
  source.sections.shopHeader.name = 'Cửa hàng tùy chỉnh';
  source.sections.customerInformation.visible = false;
  const snapshot = JSON.parse(JSON.stringify(source));

  const upgraded = upgradeSaleDeliveryNoteConfigToLatest(source);

  assert.deepEqual(source, snapshot);
  assert.notEqual(upgraded, source);
  assert.equal(upgraded.schemaVersion, 3);
  assert.equal(upgraded.sections.shopHeader.name, 'Cửa hàng tùy chỉnh');
  assert.equal(upgraded.sections.customerInformation.visible, false);
  Object.entries(VERSION_2_LAYOUT_DEFAULTS).forEach(([sectionName, defaults]) => {
    Object.entries(defaults).forEach(([field, value]) => {
      assert.equal(upgraded.sections[sectionName][field], value);
    });
  });
  assert.deepEqual(upgraded.sections.productTable.columnWidthWeights, VERSION_3_PRODUCT_TABLE_WIDTH_DEFAULTS);
  assert.deepEqual(validateCustomTemplateConfig(upgraded), upgraded);
});

test('version 2 upgrades to version 3 by adding only the default table widths', () => {
  const source = version2Config();
  source.sections.documentTitle.text = 'CUSTOM V2';
  source.sections.productTable.showDiscount = false;
  source.sections.productTable.cellPaddingMm = 3;
  const snapshot = structuredClone(source);
  const upgraded = upgradeSaleDeliveryNoteConfigToLatest(source);
  assert.deepEqual(source, snapshot);
  assert.equal(upgraded.schemaVersion, 3);
  assert.equal(upgraded.sections.documentTitle.text, 'CUSTOM V2');
  assert.equal(upgraded.sections.productTable.showDiscount, false);
  assert.equal(upgraded.sections.productTable.cellPaddingMm, 3);
  assert.deepEqual(upgraded.sections.productTable.columnWidthWeights, VERSION_3_PRODUCT_TABLE_WIDTH_DEFAULTS);
});

test('version 3 table widths enforce exact keys, finite numeric bounds, and field-level errors', () => {
  PRODUCT_TABLE_COLUMN_KEYS.forEach((key) => {
    for (const boundary of [1, 100]) {
      const config = cloneSystemConfig();
      config.sections.productTable.columnWidthWeights[key] = boundary;
      assert.doesNotThrow(() => validateCustomTemplateConfig(config));
    }
    for (const invalid of [0, -1, 101, '11', NaN, Infinity]) {
      const config = cloneSystemConfig();
      config.sections.productTable.columnWidthWeights[key] = invalid;
      assert.throws(
        () => validateCustomTemplateConfig(config),
        (error) => error.details.some((detail) => detail.field.endsWith(`.columnWidthWeights.${key}`))
      );
    }
  });

  const missing = cloneSystemConfig();
  delete missing.sections.productTable.columnWidthWeights.quantity;
  assert.throws(
    () => validateCustomTemplateConfig(missing),
    (error) => error.details.some((detail) => detail.field.endsWith('.columnWidthWeights.quantity'))
  );
  const unknown = cloneSystemConfig();
  unknown.sections.productTable.columnWidthWeights.sku = 10;
  assert.throws(
    () => validateCustomTemplateConfig(unknown),
    (error) => error.details.some((detail) => detail.field.endsWith('.columnWidthWeights.sku'))
  );
});

test('version 2 layout fields enforce exact keys, enums, finite numbers, and boundaries', () => {
  const numericFields = [
    ['shopHeader', 'fontSizePt', 7, 14],
    ['shopHeader', 'spacingAfterMm', 0, 15],
    ['receiptMetadata', 'fontSizePt', 7, 14],
    ['documentTitle', 'fontSizePt', 12, 28],
    ['documentTitle', 'spacingBeforeMm', 0, 15],
    ['documentTitle', 'spacingAfterMm', 0, 15],
    ['customerInformation', 'fontSizePt', 7, 14],
    ['customerInformation', 'spacingAfterMm', 0, 15],
    ['productTable', 'fontSizePt', 7, 13],
    ['productTable', 'headerFontSizePt', 7, 13],
    ['productTable', 'cellPaddingMm', 0.5, 4],
    ['productTable', 'spacingAfterMm', 0, 15],
    ['totals', 'fontSizePt', 7, 14],
    ['totals', 'spacingAfterMm', 0, 15],
    ['signatures', 'fontSizePt', 7, 14],
    ['signatures', 'writingSpaceMm', 10, 60],
    ['signatures', 'spacingAfterMm', 0, 20],
    ['notes', 'fontSizePt', 6, 12],
    ['notes', 'spacingBeforeMm', 0, 20]
  ];

  numericFields.forEach(([section, field, min, max]) => {
    for (const boundary of [min, max]) {
      const config = cloneSystemConfig();
      config.sections[section][field] = boundary;
      assert.doesNotThrow(() => validateCustomTemplateConfig(config));
    }
    for (const invalid of [min - 0.1, max + 0.1, NaN, Infinity, String(min)]) {
      const config = cloneSystemConfig();
      config.sections[section][field] = invalid;
      assert.throws(
        () => validateCustomTemplateConfig(config),
        (error) => error.details.some((detail) => detail.field.endsWith(`.${section}.${field}`))
      );
    }
  });

  const invalidTitleAlign = cloneSystemConfig();
  invalidTitleAlign.sections.documentTitle.textAlign = 'justify';
  assert.throws(() => validateCustomTemplateConfig(invalidTitleAlign), /Invalid custom/);
  const invalidTotalsAlign = cloneSystemConfig();
  invalidTotalsAlign.sections.totals.textAlign = 'center';
  assert.throws(() => validateCustomTemplateConfig(invalidTotalsAlign), /Invalid custom/);
  const unknown = cloneSystemConfig();
  unknown.sections.notes.style = { color: 'red' };
  assert.throws(
    () => validateCustomTemplateConfig(unknown),
    (error) => error.details.some((detail) => detail.field.endsWith('.notes.style'))
  );
});

test('system config mirrors every current A4 print section and fixed margin', () => {
  assert.deepEqual(SYSTEM_TEMPLATE_CONFIG.paper, {
    size: 'A4',
    orientation: 'portrait',
    marginMm: 7
  });
  assert.deepEqual(Object.keys(SYSTEM_TEMPLATE_CONFIG.sections), [
    'shopHeader',
    'documentTitle',
    'receiptMetadata',
    'customerInformation',
    'productTable',
    'totals',
    'signatures',
    'notes'
  ]);
  assert.equal(SYSTEM_TEMPLATE_CONFIG.sections.documentTitle.text, 'PHIẾU BÁN & GIAO HÀNG');
  assert.equal(SYSTEM_TEMPLATE_CONFIG.sections.notes.items.length, 5);
});

test('strict validation rejects unknown fields at every level', () => {
  const config = cloneSystemConfig();
  config.sections.productTable.rawHtml = '<table></table>';
  assert.throws(
    () => validateCustomTemplateConfig(config),
    (error) => error.code === 'PRINT_TEMPLATE_VALIDATION_ERROR'
      && error.details.some((detail) => detail.field.endsWith('.rawHtml'))
  );
});

test('strict validation rejects invalid schema, paper, orientation, numeric range, and section types', () => {
  const config = cloneSystemConfig();
  config.schemaVersion = 4;
  config.paper.size = 'A5';
  config.paper.orientation = 'landscape';
  config.paper.marginMm = 99;
  config.sections.totals.visible = 'yes';

  assert.throws(
    () => validateCustomTemplateConfig(config),
    (error) => {
      const fields = new Set(error.details.map((detail) => detail.field));
      return error.code === 'PRINT_TEMPLATE_VALIDATION_ERROR'
        && fields.has('body.custom_template_config.schemaVersion')
        && fields.has('body.custom_template_config.paper.size')
        && fields.has('body.custom_template_config.paper.orientation')
        && fields.has('body.custom_template_config.paper.marginMm')
        && fields.has('body.custom_template_config.sections.totals.visible');
    }
  );
});

test('strict validation rejects objects and arrays in incorrect locations', () => {
  const config = cloneSystemConfig();
  config.paper = [];
  config.sections.notes.title = ['Lưu ý'];
  config.sections.notes.items = {};

  assert.throws(
    () => validateCustomTemplateConfig(config),
    (error) => error.code === 'PRINT_TEMPLATE_VALIDATION_ERROR'
      && error.details.some((detail) => detail.field === 'body.custom_template_config.paper')
      && error.details.some((detail) => detail.field.endsWith('.notes.title'))
      && error.details.some((detail) => detail.field.endsWith('.notes.items'))
  );
});

test('strict validation rejects raw markup or expression syntax in text fields', () => {
  const config = cloneSystemConfig();
  config.sections.documentTitle.text = '<script>alert(1)</script>';
  config.sections.notes.items[0] = '{{voucher.customer}}';
  config.sections.notes.items[1] = 'body { color: red; }';
  config.sections.notes.items[2] = 'function run() { return window.location; }';

  assert.throws(
    () => validateCustomTemplateConfig(config),
    (error) => error.code === 'PRINT_TEMPLATE_VALIDATION_ERROR'
      && error.details.filter((detail) => detail.issue === 'must contain plain text only').length === 4
  );
});

test('strict validation rejects oversized serialized JSON', () => {
  const config = cloneSystemConfig();
  config.sections.notes.items[0] = 'x'.repeat(MAX_CONFIG_BYTES);
  assert.throws(
    () => validateCustomTemplateConfig(config),
    (error) => error.statusCode === 413 && error.code === 'PRINT_TEMPLATE_CONFIG_TOO_LARGE'
  );
});

test('serialized size limit counts UTF-8 bytes rather than JavaScript characters', () => {
  const config = cloneSystemConfig();
  config.sections.notes.items[0] = 'ệ'.repeat(11_000);
  const serialized = JSON.stringify(config);
  assert.equal(serialized.length < MAX_CONFIG_BYTES, true);
  assert.equal(Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_BYTES, true);
  assert.throws(
    () => validateCustomTemplateConfig(config),
    (error) => error.statusCode === 413 && error.code === 'PRINT_TEMPLATE_CONFIG_TOO_LARGE'
  );
});

test('strict validation enforces bounded plain-text fields', () => {
  const config = cloneSystemConfig();
  config.sections.documentTitle.text = 'x'.repeat(121);
  assert.throws(
    () => validateCustomTemplateConfig(config),
    (error) => error.code === 'PRINT_TEMPLATE_VALIDATION_ERROR'
      && error.details.some((detail) => detail.field.endsWith('.documentTitle.text'))
  );
});

test('GET reports immutable system availability and absent custom template', async (t) => {
  mockPoolQuery(t, [[[settingsRow()]]]);
  const result = await service.getSettings();
  assert.deepEqual(result, {
    document_type: 'sale_delivery_note',
    active_template: 'system',
    system_template: {
      available: true,
      immutable: true,
      schema_version: 3,
      config: cloneSystemConfig()
    },
    custom_template: { exists: false, schema_version: null, config: null }
  });
});

test('missing singleton settings row is reported as a configuration defect', async (t) => {
  mockPoolQuery(t, [[[]]]);
  await assert.rejects(
    service.getSettings(),
    (error) => error.statusCode === 500 && error.code === 'PRINT_TEMPLATE_SETTINGS_MISSING'
  );
});

test('database failures are converted to a safe AppError without leaking SQL details', async (t) => {
  mockPoolQuery(t, [Object.assign(new Error('ER_PARSE_ERROR near secret_table'), { code: 'ER_PARSE_ERROR' })]);
  await assert.rejects(
    service.getSettings(),
    (error) => error.statusCode === 500
      && error.code === 'PRINT_TEMPLATE_SETTINGS_DATABASE_ERROR'
      && error.message === 'Unable to access print template settings.'
  );
});

test('GET reports a valid saved custom template without selecting it', () => {
  const config = cloneSystemConfig();
  const result = service.mapSettings(settingsRow({
    custom_template_config: config,
    custom_template_schema_version: 3
  }));
  assert.equal(result.active_template, 'system');
  assert.equal(result.custom_template.exists, true);
  assert.equal(result.custom_template.schema_version, 3);
  assert.deepEqual(result.custom_template.config, config);
});

test('GET upgrades a stored version 2 Custom in memory and preserves active selection', () => {
  const source = version2Config();
  source.sections.productTable.showDiscount = false;
  const result = service.mapSettings(settingsRow({
    active_template: 'custom',
    custom_template_config: JSON.stringify(source),
    custom_template_schema_version: 2
  }));
  assert.equal(result.active_template, 'custom');
  assert.equal(result.custom_template.schema_version, 3);
  assert.equal(result.custom_template.config.schemaVersion, 3);
  assert.equal(result.custom_template.config.sections.productTable.showDiscount, false);
  assert.deepEqual(
    result.custom_template.config.sections.productTable.columnWidthWeights,
    VERSION_3_PRODUCT_TABLE_WIDTH_DEFAULTS
  );
});

test('GET upgrades a stored version 1 Custom in memory while preserving active selection', () => {
  const source = legacyConfig();
  source.sections.documentTitle.text = 'TIÊU ĐỀ V1';
  const result = service.mapSettings(settingsRow({
    active_template: 'custom',
    custom_template_config: JSON.stringify(source),
    custom_template_schema_version: 1
  }));
  assert.equal(result.active_template, 'custom');
  assert.equal(result.custom_template.schema_version, 3);
  assert.equal(result.custom_template.config.schemaVersion, 3);
  assert.equal(result.custom_template.config.sections.documentTitle.text, 'TIÊU ĐỀ V1');
  assert.equal(result.custom_template.config.sections.documentTitle.textAlign, 'center');
});

test('active selection accepts only system or custom', () => {
  assert.equal(service.validateActiveTemplate('system'), 'system');
  assert.equal(service.validateActiveTemplate('custom'), 'custom');
  assert.throws(
    () => service.validateActiveTemplate('legacy'),
    (error) => error.statusCode === 400 && error.code === 'PRINT_TEMPLATE_VALIDATION_ERROR'
  );
});

test('system selection is valid when no custom template exists', async (t) => {
  const { queries, lifecycle } = mockTransactions(t, [
    [[settingsRow()]],
    [{ affectedRows: 1 }],
    [[settingsRow()]]
  ]);
  const result = await service.changeActiveTemplate('system');
  assert.equal(result.active_template, 'system');
  assert.deepEqual(queries[1].params, ['system', 'sale_delivery_note']);
  assert.deepEqual(lifecycle, ['begin', 'commit', 'release']);
});

test('custom selection is rejected when no custom template exists and transaction rolls back', async (t) => {
  const { queries, lifecycle } = mockTransactions(t, [
    [[settingsRow()]]
  ]);
  await assert.rejects(
    service.changeActiveTemplate('custom'),
    (error) => error.statusCode === 409 && error.code === 'CUSTOM_PRINT_TEMPLATE_REQUIRED'
  );
  assert.equal(queries.some(({ sql }) => /^\s*UPDATE/i.test(sql)), false);
  assert.deepEqual(lifecycle, ['begin', 'rollback', 'release']);
});

test('custom selection succeeds only when the stored custom config is valid', async (t) => {
  const config = cloneSystemConfig();
  const customRow = settingsRow({
    custom_template_config: JSON.stringify(config),
    custom_template_schema_version: 3
  });
  const { queries } = mockTransactions(t, [
    [[customRow]],
    [{ affectedRows: 1 }],
    [[{ ...customRow, active_template: 'custom' }]]
  ]);
  const result = await service.changeActiveTemplate('custom');
  assert.equal(result.active_template, 'custom');
  assert.equal(result.custom_template.exists, true);
  assert.deepEqual(queries[1].params, ['custom', 'sale_delivery_note']);
});

test('invalid stored custom config cannot be selected', async (t) => {
  const customRow = settingsRow({
    custom_template_config: JSON.stringify({ schemaVersion: 1 }),
    custom_template_schema_version: 1
  });
  mockTransactions(t, [[[customRow]]]);
  await assert.rejects(
    service.changeActiveTemplate('custom'),
    (error) => error.statusCode === 409 && error.code === 'CUSTOM_PRINT_TEMPLATE_INVALID'
  );
});

test('saving custom replaces the singleton config without activating it or inserting rows', async (t) => {
  const firstConfig = cloneSystemConfig();
  const secondConfig = cloneSystemConfig();
  secondConfig.sections.documentTitle.text = 'PHIẾU BÁN HÀNG';
  const firstUpdatedRow = settingsRow({
    custom_template_config: JSON.stringify(firstConfig),
    custom_template_schema_version: 3
  });
  const secondUpdatedRow = settingsRow({
    custom_template_config: JSON.stringify(secondConfig),
    custom_template_schema_version: 3
  });
  const { queries } = mockTransactions(t, [
    [[settingsRow()]],
    [{ affectedRows: 1 }],
    [[firstUpdatedRow]],
    [[firstUpdatedRow]],
    [{ affectedRows: 1 }],
    [[secondUpdatedRow]]
  ]);

  const first = await service.saveCustomTemplate(firstConfig);
  const second = await service.saveCustomTemplate(secondConfig);

  assert.equal(first.active_template, 'system');
  assert.equal(second.active_template, 'system');
  assert.equal(second.custom_template.config.sections.documentTitle.text, 'PHIẾU BÁN HÀNG');
  assert.equal(queries.filter(({ sql }) => /UPDATE print_template_settings/i.test(sql)).length, 2);
  assert.equal(queries.some(({ sql }) => /\bINSERT\b/i.test(sql)), false);
});

test('system config returned by GET can initialize Custom without activating it', async (t) => {
  const getResult = service.mapSettings(settingsRow());
  const submittedClone = getResult.system_template.config;
  const updatedRow = settingsRow({
    custom_template_config: JSON.stringify(submittedClone),
    custom_template_schema_version: 3
  });
  mockTransactions(t, [
    [[settingsRow()]],
    [{ affectedRows: 1 }],
    [[updatedRow]]
  ]);

  const result = await service.saveCustomTemplate(submittedClone);
  submittedClone.sections.documentTitle.text = 'Client-side mutation after save';

  assert.equal(result.active_template, 'system');
  assert.equal(result.custom_template.exists, true);
  assert.equal(
    result.custom_template.config.sections.documentTitle.text,
    'PHIẾU BÁN & GIAO HÀNG'
  );
  assert.equal(
    SYSTEM_TEMPLATE_CONFIG.sections.documentTitle.text,
    'PHIẾU BÁN & GIAO HÀNG'
  );
});

test('changing active selection does not alter the stored custom configuration', async (t) => {
  const config = cloneSystemConfig();
  const currentRow = settingsRow({
    custom_template_config: JSON.stringify(config),
    custom_template_schema_version: 3
  });
  const { queries } = mockTransactions(t, [
    [[currentRow]],
    [{ affectedRows: 1 }],
    [[{ ...currentRow, active_template: 'custom' }]]
  ]);
  const result = await service.changeActiveTemplate('custom');
  assert.deepEqual(result.custom_template.config, config);
  assert.match(queries[1].sql, /SET active_template = \?/i);
  assert.doesNotMatch(queries[1].sql, /custom_template_config/i);
});

test('service writes only print-template settings and never sale, product, or transaction data', async (t) => {
  const config = cloneSystemConfig();
  const updatedRow = settingsRow({
    custom_template_config: JSON.stringify(config),
    custom_template_schema_version: 3
  });
  const { queries } = mockTransactions(t, [
    [[settingsRow()]],
    [{ affectedRows: 1 }],
    [[updatedRow]]
  ]);
  await service.saveCustomTemplate(config);
  const mutatingSql = queries.filter(({ sql }) => /^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(sql));
  assert.equal(mutatingSql.length, 1);
  assert.match(mutatingSql[0].sql, /UPDATE print_template_settings/i);
  assert.doesNotMatch(mutatingSql[0].sql, /products|stock_vouchers|stock_transactions|customers/i);
});

test('request validation prevents API clients from writing system template fields', () => {
  assert.throws(
    () => controller.requireExactBody({ custom_template_config: {}, system_template: {} }, ['custom_template_config']),
    (error) => error.statusCode === 400
      && error.details.some((detail) => detail.field === 'body.system_template')
  );
});

test('all Admin print-template endpoints require authentication', async () => {
  const app = require('../../app');
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    for (const method of ['GET', 'PUT', 'PATCH']) {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/admin/print-template-settings/sale-delivery-note`,
        { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' }
      );
      const payload = await response.json();
      assert.equal(response.status, 401);
      assert.equal(payload.error.code, 'AUTH_TOKEN_MISSING');
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
});
