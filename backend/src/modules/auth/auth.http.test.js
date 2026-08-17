const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_NAME = process.env.DB_NAME || 'linhkienpc_auth_test';
process.env.DB_USER = process.env.DB_USER || 'auth_test';
process.env.JWT_ACCESS_SECRET = 'http-access-secret-at-least-thirty-two-bytes';
process.env.JWT_REFRESH_SECRET = 'http-refresh-secret-at-least-thirty-two-bytes';
process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,https://vitinhphuoctai.com';

const env = require('../../config/env');
const authService = require('./auth.service');
const app = require('../../app');
const loginLimiter = require('../../middlewares/adminLoginRateLimit');
const refreshLimiter = require('../../middlewares/adminRefreshRateLimit');
const errorHandler = require('../../middlewares/errorHandler');
const { isAllowedOrigin, requireAllowedAuthOrigin } = require('../../middlewares/authOriginPolicy');

const originalMethods = {
  login: authService.login,
  refresh: authService.refresh,
  logout: authService.logout
};

function authResult() {
  return {
    access_token: 'synthetic-access-token',
    token_type: 'Bearer',
    admin: { id: 7, username: 'admin', display_name: 'Admin', is_active: true },
    refreshToken: 'synthetic-refresh-token-not-for-logging',
    refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  };
}

async function withServer(targetApp, operation) {
  const server = targetApp.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    return await operation(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test.afterEach(() => {
  Object.assign(authService, originalMethods);
  env.nodeEnv = 'test';
});

test('login sets a host-only HttpOnly refresh cookie and never serializes it', async () => {
  authService.login = async () => authResult();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ username: 'admin', password: 'correct-password' })
    });
    const payload = await response.json();
    const cookie = response.headers.get('set-cookie');
    assert.equal(response.status, 200);
    assert.match(cookie, /^pt_admin_refresh=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\/api\/v1\/admin\/auth/i);
    assert.doesNotMatch(cookie, /Domain=/i);
    assert.doesNotMatch(cookie, /; Secure/i);
    assert.equal(payload.data.access_token, 'synthetic-access-token');
    assert.equal('refresh_token' in payload.data, false);
    assert.equal(JSON.stringify(payload).includes('synthetic-refresh-token-not-for-logging'), false);
  });
});

test('production refresh cookie is Secure and remains host-only', async () => {
  env.nodeEnv = 'production';
  authService.login = async () => authResult();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://vitinhphuoctai.com' },
      body: JSON.stringify({ username: 'admin', password: 'correct-password' })
    });
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /; Secure/i);
    assert.match(cookie, /HttpOnly/i);
    assert.doesNotMatch(cookie, /Domain=/i);
  });
});

test('refresh reads only the cookie and rotates only through Set-Cookie', async () => {
  let receivedToken = null;
  authService.refresh = async (token) => {
    receivedToken = token;
    return authResult();
  };
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: 'pt_admin_refresh=cookie-refresh-value'
      },
      body: JSON.stringify({ refresh_token: 'body-token-must-be-ignored' })
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(receivedToken, 'cookie-refresh-value');
    assert.equal('refresh_token' in payload.data, false);
    assert.match(response.headers.get('set-cookie'), /^pt_admin_refresh=/);
  });
});

test('logout revokes the cookie family and clears the browser cookie', async () => {
  let receivedToken = null;
  authService.logout = async (token) => {
    receivedToken = token;
    return { logged_out: true, revoked: true };
  };
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: 'pt_admin_refresh=current-family-token'
      }
    });
    assert.equal(response.status, 200);
    assert.equal(receivedToken, 'current-family-token');
    assert.match(response.headers.get('set-cookie'), /^pt_admin_refresh=;/);
    assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  });
});

test('invalid refresh clears the stale cookie and login validation remains enforced', async () => {
  authService.refresh = async () => {
    const error = new Error('invalid');
    error.statusCode = 401;
    error.code = 'AUTH_TOKEN_INVALID';
    throw error;
  };
  await withServer(app, async (baseUrl) => {
    const refresh = await fetch(`${baseUrl}/api/v1/admin/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Cookie: 'pt_admin_refresh=invalid-cookie-value'
      }
    });
    assert.equal(refresh.status, 401);
    assert.match(refresh.headers.get('set-cookie'), /^pt_admin_refresh=;/);

    const invalidLogin = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ username: 'x', password: 'short' })
    });
    const payload = await invalidLogin.json();
    assert.equal(invalidLogin.status, 400);
    assert.equal(payload.error.code, 'VALIDATION_ERROR');
  });
});

test('origin policy allows official/dev/no-Origin requests and rejects foreign browsers', async () => {
  assert.equal(isAllowedOrigin('https://vitinhphuoctai.com'), true);
  assert.equal(isAllowedOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedOrigin(undefined), true);
  assert.equal(isAllowedOrigin('https://evil.example'), false);

  let received;
  requireAllowedAuthOrigin(
    { get: () => 'https://evil.example' },
    {},
    (error) => { received = error; }
  );
  assert.equal(received.code, 'AUTH_ORIGIN_NOT_ALLOWED');

  authService.login = async () => authResult();
  await withServer(app, async (baseUrl) => {
    const noOrigin = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'correct-password' })
    });
    const foreign = await fetch(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ username: 'admin', password: 'correct-password' })
    });
    assert.equal(noOrigin.status, 200);
    assert.equal(foreign.status, 403);
  });
});

function limiterApp(limiter) {
  const target = express();
  target.set('trust proxy', 'loopback');
  target.use(express.json());
  target.post('/', limiter, (req, res) => res.json({ success: true }));
  target.use(errorHandler);
  return target;
}

test('login limiter remains 10 per 15 minutes with machine-readable error', async () => {
  await withServer(limiterApp(loginLimiter), async (baseUrl) => {
    let last;
    for (let index = 0; index < 11; index += 1) {
      last = await fetch(baseUrl, { method: 'POST' });
    }
    const payload = await last.json();
    assert.equal(last.status, 429);
    assert.equal(payload.error.code, 'AUTH_LOGIN_RATE_LIMITED');
  });
});

test('refresh limiter permits normal use but caps at 60 per 15 minutes', async () => {
  await withServer(limiterApp(refreshLimiter), async (baseUrl) => {
    let last;
    for (let index = 0; index < 61; index += 1) {
      last = await fetch(baseUrl, { method: 'POST' });
    }
    const payload = await last.json();
    assert.equal(last.status, 429);
    assert.equal(payload.error.code, 'AUTH_REFRESH_RATE_LIMITED');
  });
});
