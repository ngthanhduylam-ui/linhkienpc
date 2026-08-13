const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../config/database');
const service = require('./quickNote.service');

const originalQuery = pool.query;

function noteRow(overrides = {}) {
  return {
    id: 3,
    content: 'ga 3070ti',
    is_processed: 0,
    created_at: '2026-08-13 10:42:00',
    updated_at: '2026-08-13 10:42:00',
    processed_at: null,
    ...overrides
  };
}

function mockQueries(t, responses, queries = []) {
  let index = 0;
  pool.query = async (sql, params = []) => {
    queries.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
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

test('content validation trims only surrounding whitespace and keeps raw note text', () => {
  assert.equal(service.normalizeContent('  bán 2400 1c  '), 'bán 2400 1c');
  assert.equal(service.normalizeContent('ga   3070ti'), 'ga   3070ti');
  assert.throws(() => service.normalizeContent(''), /nhập nội dung/i);
  assert.throws(() => service.normalizeContent('   '), /nhập nội dung/i);
  assert.throws(() => service.normalizeContent({ text: 'ram' }), /chuỗi/i);
  assert.throws(() => service.normalizeContent('x'.repeat(501)), /500/);
});

test('create and patch bodies use exact allowlists', () => {
  assert.deepEqual(service.validateCreatePayload({ content: ' cpu ' }), { content: 'cpu' });
  assert.throws(() => service.validateCreatePayload({ content: 'cpu', product_id: 1 }), /không được hỗ trợ/i);
  assert.deepEqual(service.validatePatchPayload({ content: ' ram ', is_processed: true }), {
    content: 'ram',
    is_processed: true
  });
  assert.throws(() => service.validatePatchPayload({}), /để trống/i);
  assert.throws(() => service.validatePatchPayload({ is_processed: 1 }), /true hoặc false/i);
  assert.throws(() => service.validatePatchPayload({ voucher_id: 2 }), /không được hỗ trợ/i);
});

test('creates a pending note and touches only quick_notes', async (t) => {
  const queries = mockQueries(t, [
    [{ insertId: 3, affectedRows: 1 }],
    [[noteRow()]]
  ]);
  const created = await service.createNote({ content: '  ga 3070ti  ' });
  assert.equal(created.content, 'ga 3070ti');
  assert.equal(created.is_processed, false);
  assert.deepEqual(queries[0].params, ['ga 3070ti']);
  assert.match(queries[0].sql, /^INSERT INTO quick_notes/);
  assert.equal(queries.every(({ sql }) => !/\b(?:products|inventory|stock_vouchers|stock_transactions)\b/i.test(sql)), true);
});

test('marks processed with a timestamp and reopening clears it', async (t) => {
  const queries = mockQueries(t, [
    [[noteRow()]],
    [{ affectedRows: 1 }],
    [[noteRow({ is_processed: 1, processed_at: '2026-08-13 11:00:00' })]],
    [[noteRow({ is_processed: 1, processed_at: '2026-08-13 11:00:00' })]],
    [{ affectedRows: 1 }],
    [[noteRow()]]
  ]);

  const processed = await service.updateNote(3, { is_processed: true });
  const reopened = await service.updateNote(3, { is_processed: false });
  assert.equal(processed.is_processed, true);
  assert.equal(reopened.is_processed, false);
  assert.match(queries[1].sql, /is_processed = \?, processed_at = CURRENT_TIMESTAMP/);
  assert.deepEqual(queries[1].params, [1, 3]);
  assert.match(queries[4].sql, /is_processed = \?, processed_at = NULL/);
  assert.deepEqual(queries[4].params, [0, 3]);
});

test('editing content preserves the processed state', async (t) => {
  const queries = mockQueries(t, [
    [[noteRow({ is_processed: 1, processed_at: '2026-08-13 11:00:00' })]],
    [{ affectedRows: 1 }],
    [[noteRow({ content: 'đã gọi khách', is_processed: 1, processed_at: '2026-08-13 11:00:00' })]]
  ]);
  const updated = await service.updateNote(3, { content: '  đã gọi khách  ' });
  assert.equal(updated.content, 'đã gọi khách');
  assert.equal(updated.is_processed, true);
  assert.equal(updated.processed_at, '2026-08-13 11:00:00');
  assert.match(queries[1].sql, /SET content = \? WHERE id = \?/);
  assert.doesNotMatch(queries[1].sql, /is_processed|processed_at/);
});

test('deletes only the requested quick note', async (t) => {
  const queries = mockQueries(t, [
    [[noteRow()]],
    [{ affectedRows: 1 }]
  ]);
  const deleted = await service.deleteNote(3);
  assert.equal(deleted.id, 3);
  assert.equal(queries[1].sql, 'DELETE FROM quick_notes WHERE id = ?');
  assert.deepEqual(queries[1].params, [3]);
});

test('unknown notes return a safe 404', async (t) => {
  mockQueries(t, [[[]]]);
  await assert.rejects(
    service.getNoteById(999),
    (error) => error.statusCode === 404 && error.code === 'QUICK_NOTE_NOT_FOUND'
  );
});

test('list supports all, pending, and processed filters with newest-first order', async (t) => {
  const queries = mockQueries(t, [
    [[noteRow({ id: 4, created_at: '2026-08-13 11:00:00' }), noteRow()]],
    [[{ pending_count: 7 }]],
    [[noteRow()]],
    [[{ pending_count: 7 }]],
    [[noteRow({ is_processed: 1, processed_at: '2026-08-13 11:00:00' })]],
    [[{ pending_count: 7 }]]
  ]);
  const all = await service.listNotes({ status: 'all', limit: '20' });
  const pending = await service.listNotes({ status: 'pending', limit: '20' });
  const processed = await service.listNotes({ status: 'processed', limit: '20' });
  assert.deepEqual(all.items.map(({ id }) => id), [4, 3]);
  assert.equal(all.pendingCount, 7);
  assert.equal(pending.items[0].is_processed, false);
  assert.equal(processed.items[0].is_processed, true);
  assert.match(queries[0].sql, /ORDER BY created_at DESC, id DESC LIMIT \?/);
  assert.deepEqual(queries[0].params, [20]);
  assert.match(queries[2].sql, /WHERE is_processed = \?/);
  assert.deepEqual(queries[2].params, [0, 20]);
  assert.deepEqual(queries[4].params, [1, 20]);
});

test('list limit is bounded and invalid list options are rejected', () => {
  assert.deepEqual(service.parseListOptions({}), { status: 'all', limit: 100 });
  assert.deepEqual(service.parseListOptions({ status: 'pending', limit: '999' }), {
    status: 'pending',
    limit: 200
  });
  assert.throws(() => service.parseListOptions({ status: 'later' }), /không hợp lệ/i);
  assert.throws(() => service.parseListOptions({ limit: '0' }), /giới hạn/i);
});

test('all quick-note endpoints require Admin authentication', async () => {
  const app = require('../../app');
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const cases = [
      { method: 'GET', path: '/api/v1/admin/quick-notes' },
      { method: 'POST', path: '/api/v1/admin/quick-notes', body: { content: 'cpu' } },
      { method: 'PATCH', path: '/api/v1/admin/quick-notes/1', body: { is_processed: true } },
      { method: 'DELETE', path: '/api/v1/admin/quick-notes/1' }
    ];

    for (const item of cases) {
      const response = await fetch(`http://127.0.0.1:${port}${item.path}`, {
        method: item.method,
        headers: item.body ? { 'Content-Type': 'application/json' } : undefined,
        body: item.body ? JSON.stringify(item.body) : undefined
      });
      const payload = await response.json();
      assert.equal(response.status, 401, `${item.method} should require auth`);
      assert.equal(payload.error.code, 'AUTH_TOKEN_MISSING');
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
