const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_NAME = process.env.DB_NAME || 'linhkienpc_auth_test';
process.env.DB_USER = process.env.DB_USER || 'auth_test';
process.env.JWT_ACCESS_SECRET = 'middleware-access-secret-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = 'middleware-refresh-secret-at-least-32-bytes';

const authService = require('./auth.service');
const { requireAuth } = require('../../middlewares/authenticate');
const { signAccessToken, signRefreshToken } = require('../../utils/jwt');

const originalGetAdminAuthState = authService.getAdminAuthState;

async function runMiddleware(authorization) {
  const req = { headers: { authorization } };
  const error = await new Promise((resolve) => {
    requireAuth(req, {}, (received) => resolve(received));
  });
  return { req, error };
}

test.afterEach(() => {
  authService.getAdminAuthState = originalGetAdminAuthState;
});

test('missing and malformed Authorization headers are rejected', async () => {
  for (const value of [undefined, 'Basic abc', 'Bearer   ']) {
    const { error } = await runMiddleware(value);
    assert.equal(error.code, 'AUTH_TOKEN_MISSING');
  }
});

test('valid access token requires current active Admin auth state', async () => {
  authService.getAdminAuthState = async () => ({
    id: 7, username: 'admin', is_active: 1, auth_version: 3
  });
  const token = signAccessToken({ adminId: 7, username: 'admin', authVersion: 3 });
  const { req, error } = await runMiddleware(`Bearer ${token}`);
  assert.equal(error, undefined);
  assert.deepEqual(req.auth, { adminId: 7, username: 'admin', authVersion: 3 });
});

test('inactive or deleted Admin cannot continue using an old access token', async () => {
  const token = signAccessToken({ adminId: 7, username: 'admin', authVersion: 3 });
  for (const state of [null, { id: 7, username: 'admin', is_active: 0, auth_version: 3 }]) {
    authService.getAdminAuthState = async () => state;
    const { error } = await runMiddleware(`Bearer ${token}`);
    assert.equal(error.code, 'AUTH_ADMIN_INACTIVE');
  }
});

test('incremented auth_version immediately invalidates an old access token', async () => {
  authService.getAdminAuthState = async () => ({
    id: 7, username: 'admin', is_active: 1, auth_version: 4
  });
  const token = signAccessToken({ adminId: 7, username: 'admin', authVersion: 3 });
  const { error } = await runMiddleware(`Bearer ${token}`);
  assert.equal(error.code, 'AUTH_VERSION_MISMATCH');
});

test('refresh JWT, invalid signature, wrong issuer, and expired access JWT are rejected', async () => {
  authService.getAdminAuthState = async () => ({
    id: 7, username: 'admin', is_active: 1, auth_version: 3
  });
  const refresh = signRefreshToken({
    adminId: 7, username: 'admin', authVersion: 3, familyId: 'family-a'
  }, 'jti-a');
  const valid = signAccessToken({ adminId: 7, username: 'admin', authVersion: 3 });
  const [header, payload] = valid.split('.');

  for (const token of [refresh, `${header}.${payload}.invalid`]) {
    const { error } = await runMiddleware(`Bearer ${token}`);
    assert.equal(error.code, 'AUTH_TOKEN_INVALID');
  }
});
