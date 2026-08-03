const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../config/database');
const service = require('./printTemplateSetting.service');
const controller = require('./printTemplateSetting.controller');
const { createDefaultBuilderDocument } = require('./builderDraftTemplate');

const originalQuery = pool.query;
const originalGetConnection = pool.getConnection;

function row(overrides = {}) {
  return {
    id: 1,
    document_type: 'sale_delivery_note',
    active_template: 'custom',
    custom_template_config: JSON.stringify({ preserved: true }),
    custom_template_schema_version: 3,
    builder_draft_config: null,
    builder_draft_schema_version: null,
    builder_draft_revision: 0,
    builder_draft_updated_at: null,
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
    return typeof response === 'function' ? response(sql, params) : response;
  };
  t.after(() => { pool.query = originalQuery; });
  return queries;
}

function mockTransaction(t, responses, queries = []) {
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
      return typeof response === 'function' ? response(sql, params) : response;
    }
  };
  pool.getConnection = async () => connection;
  t.after(() => { pool.getConnection = originalGetConnection; });
  return { queries, lifecycle };
}

describe('Builder Draft service and API', { concurrency: false }, () => {
  test('GET returns an absent draft with revision zero', async (t) => {
    mockPoolQuery(t, [[[row()]]]);
    assert.deepEqual(await service.getBuilderDraft(), {
      document_type: 'sale_delivery_note',
      draft: null,
      builder_schema_version: null,
      revision: 0,
      updated_at: null
    });
  });

  test('GET validates and safely clones a stored draft', async (t) => {
    const document = createDefaultBuilderDocument();
    mockPoolQuery(t, [[[row({
      builder_draft_config: JSON.stringify(document),
      builder_draft_schema_version: 1,
      builder_draft_revision: 4,
      builder_draft_updated_at: '2026-08-03 12:00:00'
    })]]]);
    const result = await service.getBuilderDraft();
    result.draft.blocks[0].xMm = 100;
    assert.equal(document.blocks[0].xMm, 7);
    assert.equal(result.revision, 4);
    assert.equal(result.builder_schema_version, 1);
  });

  test('malformed stored JSON is converted to a safe Builder Draft error', () => {
    assert.throws(
      () => service.mapBuilderDraft(row({
        builder_draft_config: '{invalid',
        builder_draft_schema_version: 1,
        builder_draft_updated_at: '2026-08-03 12:00:00'
      })),
      (error) => error.code === 'PRINT_TEMPLATE_BUILDER_DRAFT_INVALID' && !/\{invalid/.test(error.message)
    );
  });

  test('PUT validates expected revision before opening a transaction', async () => {
    await assert.rejects(
      service.saveBuilderDraft(createDefaultBuilderDocument(), '0'),
      (error) => error.statusCode === 400 && error.details.some((detail) => detail.field === 'body.expected_revision')
    );
  });

  test('valid PUT locks the singleton, increments revision, and changes only Builder columns', async (t) => {
    const document = createDefaultBuilderDocument();
    const updated = row({
      builder_draft_config: JSON.stringify(document),
      builder_draft_schema_version: 1,
      builder_draft_revision: 1,
      builder_draft_updated_at: '2026-08-03 12:10:00'
    });
    const { queries, lifecycle } = mockTransaction(t, [
      [[row()]],
      [{ affectedRows: 1 }],
      [[updated]]
    ]);
    const result = await service.saveBuilderDraft(document, 0);
    assert.equal(result.revision, 1);
    assert.deepEqual(result.draft, document);
    assert.match(queries[0].sql, /FOR UPDATE/i);
    assert.match(queries[1].sql, /builder_draft_revision\s*=\s*builder_draft_revision\s*\+\s*1/i);
    assert.doesNotMatch(queries[1].sql, /SET[\s\S]*active_template/i);
    assert.doesNotMatch(queries[1].sql, /SET[\s\S]*custom_template_config/i);
    assert.deepEqual(lifecycle, ['begin', 'commit', 'release']);
  });

  test('stale PUT returns 409 without issuing an update', async (t) => {
    const { queries, lifecycle } = mockTransaction(t, [[[row({ builder_draft_revision: 2 })]]]);
    await assert.rejects(
      service.saveBuilderDraft(createDefaultBuilderDocument(), 1),
      (error) => error.statusCode === 409 && error.code === 'PRINT_TEMPLATE_BUILDER_DRAFT_CONFLICT'
    );
    assert.equal(queries.some(({ sql }) => /^\s*UPDATE/i.test(sql)), false);
    assert.deepEqual(lifecycle, ['begin', 'rollback', 'release']);
  });

  test('DELETE clears only Builder config/version/time and increments revision', async (t) => {
    const document = createDefaultBuilderDocument();
    const current = row({
      builder_draft_config: JSON.stringify(document),
      builder_draft_schema_version: 1,
      builder_draft_revision: 3,
      builder_draft_updated_at: '2026-08-03 12:10:00'
    });
    const deleted = row({ builder_draft_revision: 4 });
    const { queries, lifecycle } = mockTransaction(t, [
      [[current]],
      [{ affectedRows: 1 }],
      [[deleted]]
    ]);
    const result = await service.deleteBuilderDraft(3);
    assert.equal(result.draft, null);
    assert.equal(result.revision, 4);
    assert.match(queries[1].sql, /builder_draft_config\s*=\s*NULL/i);
    assert.doesNotMatch(queries[1].sql, /active_template\s*=/i);
    assert.doesNotMatch(queries[1].sql, /custom_template_config\s*=/i);
    assert.deepEqual(lifecycle, ['begin', 'commit', 'release']);
  });

  test('stale DELETE returns 409 and preserves the draft', async (t) => {
    const current = row({ builder_draft_revision: 5 });
    const { queries, lifecycle } = mockTransaction(t, [[[current]]]);
    await assert.rejects(
      service.deleteBuilderDraft(4),
      (error) => error.statusCode === 409 && error.code === 'PRINT_TEMPLATE_BUILDER_DRAFT_CONFLICT'
    );
    assert.equal(queries.some(({ sql }) => /^\s*UPDATE/i.test(sql)), false);
    assert.deepEqual(lifecycle, ['begin', 'rollback', 'release']);
  });

  test('transaction rolls back when the Builder Draft update fails', async (t) => {
    const { lifecycle } = mockTransaction(t, [
      [[row()]],
      new Error('simulated database failure')
    ]);
    await assert.rejects(
      service.saveBuilderDraft(createDefaultBuilderDocument(), 0),
      (error) => error.code === 'PRINT_TEMPLATE_SETTINGS_DATABASE_ERROR'
    );
    assert.deepEqual(lifecycle, ['begin', 'rollback', 'release']);
  });

  test('exact request bodies reject Custom/System/active-template fields', () => {
    assert.throws(
      () => controller.requireExactBody({ draft: {}, expected_revision: 0, active_template: 'custom' }, ['draft', 'expected_revision']),
      (error) => error.details.some((detail) => detail.field === 'body.active_template')
    );
  });

  test('all Builder Draft endpoints require authentication', async () => {
    const app = require('../../app');
    const server = app.listen(0);
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const { port } = server.address();
      for (const method of ['GET', 'PUT', 'DELETE']) {
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/admin/print-template-settings/sale-delivery-note/builder-draft`,
          {
            method,
            headers: { 'content-type': 'application/json' },
            body: method === 'GET' ? undefined : '{}'
          }
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
