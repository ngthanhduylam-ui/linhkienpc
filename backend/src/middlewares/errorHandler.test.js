const assert = require('node:assert/strict');
const test = require('node:test');

const errorHandler = require('./errorHandler');
const AppError = require('../utils/AppError');

function invokeErrorHandler(error, request = {}) {
  const response = {
    statusCode: null,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };

  errorHandler(error, request, response, () => {});
  return response;
}

test('returns the status, code, message, and details from AppError', () => {
  const error = new AppError('Validation failed.', 422, 'VALIDATION_FAILED', {
    field: 'name'
  });
  const response = invokeErrorHandler(error, { id: 'request-1' });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body.error, {
    code: 'VALIDATION_FAILED',
    message: 'Validation failed.',
    details: { field: 'name' }
  });
  assert.equal(response.body.meta.request_id, 'request-1');
});

test('returns the existing generic duplicate-entry response', () => {
  const error = new Error('Duplicate entry contains private database details');
  error.code = 'ER_DUP_ENTRY';
  const response = invokeErrorHandler(error);

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body.error, {
    code: 'DUPLICATE_ENTRY',
    message: 'Duplicate data detected.'
  });
});

test('sanitizes an unexpected error message and logs only safe request context', (t) => {
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(args));

  const error = new Error('sensitive internal path /opt/private/config.json');
  const response = invokeErrorHandler(error, {
    id: 'request-2',
    method: 'GET',
    path: '/api/v1/public/products',
    originalUrl: '/api/v1/public/products?secret=query-secret',
    headers: { authorization: 'Bearer secret-token', cookie: 'session=secret' },
    body: { password: 'secret-password' }
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body.error, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error.'
  });
  assert.equal(JSON.stringify(response.body).includes('/opt/private'), false);

  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], 'Unexpected API error');
  assert.deepEqual(Object.keys(logged[0][1]).sort(), [
    'error',
    'method',
    'path',
    'request_id'
  ]);
  assert.equal(logged[0][1].path, '/api/v1/public/products');
  assert.equal(JSON.stringify(logged).includes('secret-token'), false);
  assert.equal(JSON.stringify(logged).includes('secret-password'), false);
  assert.equal(JSON.stringify(logged).includes('query-secret'), false);
});

test('does not expose a code from an unexpected error', (t) => {
  t.mock.method(console, 'error', () => {});

  const error = new Error('private database failure');
  error.code = 'ER_SOMETHING';
  error.statusCode = 418;
  const response = invokeErrorHandler(error);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body.error, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error.'
  });
});
