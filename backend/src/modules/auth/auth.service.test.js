const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_NAME = process.env.DB_NAME || 'linhkienpc_auth_test';
process.env.DB_USER = process.env.DB_USER || 'auth_test';
process.env.JWT_ACCESS_SECRET = 'service-test-access-secret-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = 'service-test-refresh-secret-at-least-32-bytes';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
process.env.AUTH_REFRESH_REUSE_GRACE_MS = '5000';

const { pool } = require('../../config/database');
const { hashPassword } = require('../../utils/password');
const { signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const service = require('./auth.service');

const originalQuery = pool.query;
const originalGetConnection = pool.getConnection;

function adminRow(overrides = {}) {
  return {
    id: 7,
    username: 'admin',
    password_hash: '',
    display_name: 'Admin',
    is_active: 1,
    auth_version: 3,
    created_at: '2026-08-17 09:00:00',
    updated_at: '2026-08-17 09:00:00',
    ...overrides
  };
}

function tokenRow(overrides = {}) {
  return {
    id: 11,
    admin_id: 7,
    family_id: 'family-a',
    token_jti: 'jti-parent',
    replaced_by_jti: null,
    revoked_at: null,
    revoked_reason: null,
    rotated_at: null,
    expires_at: '2099-01-01 00:00:00',
    ...overrides
  };
}

function validRefreshToken(overrides = {}) {
  const claims = {
    adminId: 7,
    username: 'admin',
    authVersion: 3,
    familyId: 'family-a',
    ...overrides
  };
  return signRefreshToken(claims, overrides.jti || 'jti-parent');
}

function mockDatabase(t, { poolResponses = [], connectionResponses = [] } = {}) {
  const queries = [];
  let poolIndex = 0;
  let connectionIndex = 0;
  const tx = { begins: 0, commits: 0, rollbacks: 0, releases: 0 };
  const connection = {
    beginTransaction: async () => { tx.begins += 1; },
    commit: async () => { tx.commits += 1; },
    rollback: async () => { tx.rollbacks += 1; },
    release: () => { tx.releases += 1; },
    query: async (sql, params = []) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      queries.push({ scope: 'connection', sql: normalized, params });
      const response = connectionResponses[connectionIndex++];
      if (response instanceof Error) throw response;
      return typeof response === 'function' ? response(normalized, params) : response;
    }
  };
  pool.query = async (sql, params = []) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    queries.push({ scope: 'pool', sql: normalized, params });
    const response = poolResponses[poolIndex++];
    if (response instanceof Error) throw response;
    return typeof response === 'function' ? response(normalized, params) : response;
  };
  pool.getConnection = async () => connection;
  t.after(() => {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
  });
  return { queries, tx };
}

test('login creates an independent family and returns no password hash', async (t) => {
  const passwordHash = await hashPassword('correct-password');
  const { queries, tx } = mockDatabase(t, {
    poolResponses: [[[adminRow({ password_hash: passwordHash })]]],
    connectionResponses: [[{ affectedRows: 1, insertId: 11 }]]
  });
  const result = await service.login({ username: ' admin ', password: 'correct-password' });
  const decoded = verifyRefreshToken(result.refreshToken);

  assert.ok(result.access_token);
  assert.ok(result.refreshToken);
  assert.equal(result.admin.username, 'admin');
  assert.equal('password_hash' in result.admin, false);
  assert.equal(decoded.authVersion, 3);
  assert.match(decoded.familyId, /^[0-9a-f-]{36}$/i);
  assert.match(decoded.jti, /^[0-9a-f-]{36}$/i);
  assert.match(queries[1].sql, /^INSERT INTO admin_refresh_tokens/);
  assert.equal(queries[1].params[1], decoded.familyId);
  assert.equal(queries[1].params[2], decoded.jti);
  assert.ok(queries[1].params[4] instanceof Date);
  assert.equal(tx.commits, 1);
});

test('separate device logins receive independent refresh families', async (t) => {
  const passwordHash = await hashPassword('correct-password');
  mockDatabase(t, {
    poolResponses: [
      [[adminRow({ password_hash: passwordHash })]],
      [[adminRow({ password_hash: passwordHash })]]
    ],
    connectionResponses: [
      [{ affectedRows: 1, insertId: 11 }],
      [{ affectedRows: 1, insertId: 12 }]
    ]
  });
  const first = await service.login({ username: 'admin', password: 'correct-password' });
  const second = await service.login({ username: 'admin', password: 'correct-password' });
  const firstClaims = verifyRefreshToken(first.refreshToken);
  const secondClaims = verifyRefreshToken(second.refreshToken);
  assert.notEqual(firstClaims.familyId, secondClaims.familyId);
  assert.notEqual(firstClaims.jti, secondClaims.jti);
});

test('login rejects wrong password, unknown username, and inactive Admin', async (t) => {
  const passwordHash = await hashPassword('correct-password');
  mockDatabase(t, {
    poolResponses: [
      [[adminRow({ password_hash: passwordHash })]],
      [[]],
      [[adminRow({ password_hash: passwordHash, is_active: 0 })]]
    ]
  });
  await assert.rejects(
    service.login({ username: 'admin', password: 'wrong-password' }),
    (error) => error.code === 'AUTH_INVALID_CREDENTIALS'
  );
  await assert.rejects(
    service.login({ username: 'missing', password: 'correct-password' }),
    (error) => error.code === 'AUTH_INVALID_CREDENTIALS'
  );
  await assert.rejects(
    service.login({ username: 'admin', password: 'correct-password' }),
    (error) => error.code === 'AUTH_ADMIN_INACTIVE'
  );
});

test('refresh rotates jti transactionally, preserves family, and derives DB expiry from JWT', async (t) => {
  const token = validRefreshToken();
  const { queries, tx } = mockDatabase(t, {
    connectionResponses: [
      [[tokenRow()]],
      [[adminRow()]],
      [{ affectedRows: 1 }],
      [{ affectedRows: 1, insertId: 12 }]
    ]
  });
  const result = await service.refresh(token);
  const decoded = verifyRefreshToken(result.refreshToken);

  assert.equal(decoded.familyId, 'family-a');
  assert.notEqual(decoded.jti, 'jti-parent');
  assert.equal(decoded.authVersion, 3);
  assert.match(queries[0].sql, /FOR UPDATE$/);
  assert.match(queries[2].sql, /WHERE id = \? AND revoked_at IS NULL$/);
  assert.deepEqual(queries[2].params.slice(0, 1), ['rotated']);
  assert.equal(queries[3].params[1], 'family-a');
  assert.equal(queries[3].params[2], decoded.jti);
  assert.equal(queries[3].params[4].getTime(), decoded.exp * 1000);
  assert.equal(tx.commits, 1);
  assert.equal(tx.rollbacks, 0);
});

test('unknown, expired, inactive, and auth-version-mismatched refresh credentials are rejected', async (t) => {
  const token = validRefreshToken();
  mockDatabase(t, {
    connectionResponses: [
      [[]],
      [[tokenRow({ expires_at: '2000-01-01 00:00:00' })]],
      [[tokenRow()]],
      [[adminRow({ is_active: 0 })]],
      [{ affectedRows: 1 }],
      [[tokenRow()]],
      [[adminRow({ auth_version: 4 })]],
      [{ affectedRows: 1 }]
    ]
  });
  await assert.rejects(service.refresh(token), (error) => error.code === 'AUTH_TOKEN_INVALID');
  await assert.rejects(service.refresh(token), (error) => error.code === 'AUTH_TOKEN_INVALID');
  await assert.rejects(service.refresh(token), (error) => error.code === 'AUTH_ADMIN_INACTIVE');
  await assert.rejects(service.refresh(token), (error) => error.code === 'AUTH_VERSION_MISMATCH');
});

test('a normal concurrent use inside grace is retryable and does not revoke the family', async (t) => {
  const token = validRefreshToken();
  const { queries } = mockDatabase(t, {
    connectionResponses: [[[
      tokenRow({
        revoked_at: new Date(),
        revoked_reason: 'rotated',
        rotated_at: new Date(),
        replaced_by_jti: 'jti-child'
      })
    ]]]
  });
  await assert.rejects(
    service.refresh(token),
    (error) => error.statusCode === 409 && error.code === 'AUTH_REFRESH_RACE_RETRY'
  );
  assert.equal(queries.some(({ sql }) => sql.startsWith('UPDATE admin_refresh_tokens')), false);
});

test('rotated-token reuse outside grace revokes the family and blocks descendants', async (t) => {
  const token = validRefreshToken();
  const oldRotation = new Date(Date.now() - 6000);
  const { queries, tx } = mockDatabase(t, {
    connectionResponses: [
      [[tokenRow({
        revoked_at: oldRotation,
        revoked_reason: 'rotated',
        rotated_at: oldRotation,
        replaced_by_jti: 'jti-child'
      })]],
      [{ affectedRows: 2 }]
    ]
  });
  await assert.rejects(
    service.refresh(token),
    (error) => error.statusCode === 401 && error.code === 'AUTH_REFRESH_REUSE_DETECTED'
  );
  assert.match(queries[1].sql, /WHERE family_id = \?$/);
  assert.equal(queries[1].params[2], 'family-a');
  assert.equal(tx.commits, 1);
});

test('conditional rotation failure cannot create a second descendant', async (t) => {
  const token = validRefreshToken();
  const { queries } = mockDatabase(t, {
    connectionResponses: [
      [[tokenRow()]],
      [[adminRow()]],
      [{ affectedRows: 0 }]
    ]
  });
  await assert.rejects(
    service.refresh(token),
    (error) => error.code === 'AUTH_REFRESH_RACE_RETRY'
  );
  assert.equal(queries.some(({ sql }) => sql.startsWith('INSERT INTO admin_refresh_tokens')), false);
});

test('two simultaneous refreshes create one child and treat the loser as a benign race', async (t) => {
  const token = validRefreshToken();
  const record = tokenRow();
  let lockTail = Promise.resolve();
  let insertedChildren = 0;
  let familyRevocations = 0;

  function createConnection() {
    let releaseLock = null;
    return {
      beginTransaction: async () => {},
      commit: async () => { releaseLock?.(); releaseLock = null; },
      rollback: async () => { releaseLock?.(); releaseLock = null; },
      release: () => {},
      query: async (sql) => {
        const normalized = String(sql).replace(/\s+/g, ' ').trim();
        if (/SELECT id, admin_id, family_id/.test(normalized)) {
          const previous = lockTail;
          lockTail = new Promise((resolve) => { releaseLock = resolve; });
          await previous;
          return [[{ ...record }]];
        }
        if (/SELECT id, username, display_name/.test(normalized)) {
          return [[adminRow()]];
        }
        if (/SET revoked_at = CURRENT_TIMESTAMP/.test(normalized)) {
          if (record.revoked_at) return [{ affectedRows: 0 }];
          record.revoked_at = new Date();
          record.revoked_reason = 'rotated';
          record.rotated_at = new Date();
          return [{ affectedRows: 1 }];
        }
        if (/INSERT INTO admin_refresh_tokens/.test(normalized)) {
          insertedChildren += 1;
          return [{ affectedRows: 1, insertId: 12 }];
        }
        if (/WHERE family_id = \?/.test(normalized)) {
          familyRevocations += 1;
          return [{ affectedRows: 2 }];
        }
        throw new Error(`Unexpected SQL in concurrency test: ${normalized}`);
      }
    };
  }

  pool.getConnection = async () => createConnection();
  t.after(() => {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
  });

  const outcomes = await Promise.allSettled([service.refresh(token), service.refresh(token)]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejected = outcomes.find(({ status }) => status === 'rejected');
  assert.equal(rejected.reason.code, 'AUTH_REFRESH_RACE_RETRY');
  assert.equal(insertedChildren, 1);
  assert.equal(familyRevocations, 0);
});

test('logout revokes only the current family, leaving another login family untouched', async (t) => {
  const { queries } = mockDatabase(t, {
    connectionResponses: [
      [[{ family_id: 'family-a' }]],
      [{ affectedRows: 2 }]
    ]
  });
  const result = await service.logout('synthetic-current-session-token');
  assert.deepEqual(result, { logged_out: true, revoked: true });
  assert.match(queries[1].sql, /WHERE family_id = \?$/);
  assert.equal(queries[1].params[2], 'family-a');
  assert.equal(queries[1].params.includes('family-b'), false);
});

test('auth-version invalidation primitive increments version and revokes all active families', async (t) => {
  const { queries, tx } = mockDatabase(t, {
    connectionResponses: [
      [[adminRow({ auth_version: 3 })]],
      [{ affectedRows: 1 }],
      [{ affectedRows: 4 }]
    ]
  });
  const result = await service.incrementAuthVersionAndRevokeSessions(7, 'security_change');
  assert.deepEqual(result, { adminId: 7, authVersion: 4, revokedSessions: 4 });
  assert.match(queries[1].sql, /auth_version = auth_version \+ 1/);
  assert.match(queries[2].sql, /WHERE admin_id = \? AND revoked_at IS NULL$/);
  assert.deepEqual(queries[2].params, ['security_change', 7]);
  assert.equal(tx.commits, 1);
});
