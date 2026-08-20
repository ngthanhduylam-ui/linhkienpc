const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_NAME = process.env.DB_NAME || 'linhkienpc_rate_limit_test';
process.env.DB_USER = process.env.DB_USER || 'rate_limit_test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'rate-limit-access-secret-at-least-32-bytes';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'rate-limit-refresh-secret-at-least-32-bytes';

const router = require('../routes');
const errorHandler = require('./errorHandler');
const {
  PUBLIC_DATA_RATE_LIMIT,
  PUBLIC_RATE_LIMIT_WINDOW_MS,
  PUBLIC_SUGGESTIONS_RATE_LIMIT,
  createPublicRateLimit,
  publicDataRateLimit,
  publicSuggestionsRateLimit
} = require('./publicRateLimits');

function getRouteHandlers(path) {
  const layer = router.stack.find((item) => item.route?.path === path && item.route.methods.get);
  assert.ok(layer, `Expected GET route ${path}`);
  return layer.route.stack.map((item) => item.handle);
}

async function withServer(app, operation) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    return await operation(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('uses the approved public limiter quotas and five-minute window', () => {
  assert.equal(PUBLIC_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000);
  assert.equal(PUBLIC_DATA_RATE_LIMIT, 600);
  assert.equal(PUBLIC_SUGGESTIONS_RATE_LIMIT, 120);
});

test('mounts the shared data limiter only on public search and SKU inventory routes', () => {
  assert.ok(getRouteHandlers('/public/products').includes(publicDataRateLimit));
  assert.ok(getRouteHandlers('/public/products/:sku/inventory').includes(publicDataRateLimit));

  const excludedPaths = [
    '/public/categories',
    '/public/products/:sku/images',
    '/public/products/:sku/images/:imageId/thumbnail',
    '/public/products/:sku/images/:imageId/download',
    '/public/catalogue/products/:id/images',
    '/public/catalogue/products/:id/images/:imageId/thumbnail',
    '/public/catalogue/products/:id/images/:imageId/download'
  ];

  for (const path of excludedPaths) {
    const handlers = getRouteHandlers(path);
    assert.equal(handlers.includes(publicDataRateLimit), false, `${path} must not use data limiter`);
    assert.equal(handlers.includes(publicSuggestionsRateLimit), false, `${path} must not use suggestions limiter`);
  }
});

test('mounts an independent limiter only on catalogue suggestions', () => {
  const handlers = getRouteHandlers('/public/catalogue/suggestions');
  assert.ok(handlers.includes(publicSuggestionsRateLimit));
  assert.equal(handlers.includes(publicDataRateLimit), false);
  assert.notEqual(publicSuggestionsRateLimit, publicDataRateLimit);
});

test('returns the standard JSON AppError response and keeps limiter quotas independent', async () => {
  const dataLimiter = createPublicRateLimit({ limit: 1, windowMs: 60_000 });
  const suggestionsLimiter = createPublicRateLimit({ limit: 1, windowMs: 60_000 });
  const app = express();
  app.set('trust proxy', 'loopback');
  app.get('/data', dataLimiter, (req, res) => res.json({ success: true }));
  app.get('/suggestions', suggestionsLimiter, (req, res) => res.json({ success: true }));
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const firstData = await fetch(`${baseUrl}/data`);
    const blockedData = await fetch(`${baseUrl}/data`);
    const firstSuggestions = await fetch(`${baseUrl}/suggestions`);
    const blockedSuggestions = await fetch(`${baseUrl}/suggestions`);

    assert.equal(firstData.status, 200);
    assert.equal(blockedData.status, 429);
    assert.deepEqual((await blockedData.json()).error, {
      code: 'PUBLIC_RATE_LIMITED',
      message: 'Too many public requests. Please try again shortly.'
    });

    assert.equal(firstSuggestions.status, 200, 'data quota must not consume suggestions quota');
    assert.equal(blockedSuggestions.status, 429);
    const suggestionsPayload = await blockedSuggestions.json();
    assert.equal(suggestionsPayload.success, false);
    assert.deepEqual(suggestionsPayload.error, {
      code: 'PUBLIC_RATE_LIMITED',
      message: 'Too many public requests. Please try again shortly.'
    });
  });
});
