const jwt = require('jsonwebtoken');
const env = require('../config/env');

const JWT_ISSUER = 'linhkienpc-backend';
const JWT_ALGORITHM = 'HS256';

function assertTokenUse(decoded, expectedUse) {
  if (!decoded || decoded.token_use !== expectedUse) {
    throw new jwt.JsonWebTokenError(`Unexpected token_use; expected ${expectedUse}`);
  }
  return decoded;
}

function signAccessToken(payload) {
  return jwt.sign({ ...payload, token_use: 'access' }, env.jwt.accessSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.jwt.accessExpiresIn,
    issuer: JWT_ISSUER
  });
}

function signRefreshToken(payload, tokenJti) {
  return jwt.sign({ ...payload, token_use: 'refresh' }, env.jwt.refreshSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.jwt.refreshExpiresIn,
    issuer: JWT_ISSUER,
    jwtid: tokenJti
  });
}

function verifyAccessToken(token) {
  return assertTokenUse(jwt.verify(token, env.jwt.accessSecret, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER
  }), 'access');
}

function verifyRefreshToken(token) {
  return assertTokenUse(jwt.verify(token, env.jwt.refreshSecret, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER
  }), 'refresh');
}

function getTokenExpirationDate(token) {
  const decoded = jwt.decode(token);
  if (!decoded || !Number.isFinite(decoded.exp)) {
    throw new Error('Signed token is missing a valid exp claim.');
  }
  return new Date(decoded.exp * 1000);
}

module.exports = {
  JWT_ALGORITHM,
  JWT_ISSUER,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenExpirationDate
};
