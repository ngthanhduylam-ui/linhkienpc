const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_NAME = process.env.DB_NAME || 'linhkienpc_auth_test';
process.env.DB_USER = process.env.DB_USER || 'auth_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-thirty-two-bytes';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-thirty-two-bytes';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

const {
  JWT_ALGORITHM,
  JWT_ISSUER,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenExpirationDate
} = require('../../utils/jwt');

const payload = { adminId: 7, username: 'admin', authVersion: 3 };

test('access and refresh JWTs have explicit purpose, issuer, algorithm, and auth version', () => {
  const access = signAccessToken(payload);
  const refresh = signRefreshToken({ ...payload, familyId: 'family-a' }, 'jti-a');
  const accessDecoded = verifyAccessToken(access);
  const refreshDecoded = verifyRefreshToken(refresh);

  assert.equal(JWT_ALGORITHM, 'HS256');
  assert.equal(JWT_ISSUER, 'linhkienpc-backend');
  assert.equal(accessDecoded.token_use, 'access');
  assert.equal(accessDecoded.authVersion, 3);
  assert.equal(refreshDecoded.token_use, 'refresh');
  assert.equal(refreshDecoded.authVersion, 3);
  assert.equal(refreshDecoded.familyId, 'family-a');
  assert.equal(refreshDecoded.jti, 'jti-a');
  assert.ok(getTokenExpirationDate(refresh) > new Date());
});

test('access and refresh credentials cannot be used for the opposite purpose', () => {
  const access = signAccessToken(payload);
  const refresh = signRefreshToken({ ...payload, familyId: 'family-a' }, 'jti-a');
  assert.throws(() => verifyRefreshToken(access));
  assert.throws(() => verifyAccessToken(refresh));
});

test('verification rejects wrong issuer, wrong algorithm, invalid signature, and expiry', () => {
  const wrongIssuer = jwt.sign({ ...payload, token_use: 'access' }, process.env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256', issuer: 'another-service', expiresIn: '5m'
  });
  const wrongAlgorithm = jwt.sign({ ...payload, token_use: 'access' }, process.env.JWT_ACCESS_SECRET, {
    algorithm: 'HS384', issuer: JWT_ISSUER, expiresIn: '5m'
  });
  const expired = jwt.sign({ ...payload, token_use: 'access' }, process.env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256', issuer: JWT_ISSUER, expiresIn: -1
  });
  const valid = signAccessToken(payload);
  const [header, body] = valid.split('.');

  assert.throws(() => verifyAccessToken(wrongIssuer));
  assert.throws(() => verifyAccessToken(wrongAlgorithm));
  assert.throws(() => verifyAccessToken(expired));
  assert.throws(() => verifyAccessToken(`${header}.${body}.invalid`));
});
