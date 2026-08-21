const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_NAME = process.env.DB_NAME || 'linhkienpc_no_store_test';
process.env.DB_USER = process.env.DB_USER || 'no_store_test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'no-store-access-secret-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'no-store-refresh-secret-at-least-32-bytes';

const app = require('../app');

async function withServer(operation) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    return await operation(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('sets no-store for Admin auth and protected business responses only', async () => {
  await withServer(async (baseUrl) => {
    const adminAuth = await fetch(`${baseUrl}/api/v1/admin/auth/me`);
    const adminBusiness = await fetch(`${baseUrl}/api/v1/admin/products`);
    const publicResponse = await fetch(`${baseUrl}/api/v1/public/products/!/inventory`);
    const health = await fetch(`${baseUrl}/api/v1/health`);

    assert.equal(adminAuth.status, 401);
    assert.equal(adminAuth.headers.get('cache-control'), 'no-store');

    assert.equal(adminBusiness.status, 401);
    assert.equal(adminBusiness.headers.get('cache-control'), 'no-store');

    assert.equal(publicResponse.status, 400);
    assert.notEqual(publicResponse.headers.get('cache-control'), 'no-store');

    assert.equal(health.status, 200);
    assert.notEqual(health.headers.get('cache-control'), 'no-store');
  });
});
