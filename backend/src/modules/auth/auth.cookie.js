const env = require('../../config/env');

const AUTH_COOKIE_PATH = '/api/v1/admin/auth';

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: AUTH_COOKIE_PATH
  };
}

function setRefreshCookie(res, refreshToken, expiresAt) {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  res.cookie(env.auth.refreshCookieName, refreshToken, {
    ...baseCookieOptions(),
    expires: expiresAt,
    maxAge
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(env.auth.refreshCookieName, baseCookieOptions());
}

function readRefreshCookie(req) {
  return req.cookies?.[env.auth.refreshCookieName] || '';
}

module.exports = {
  AUTH_COOKIE_PATH,
  baseCookieOptions,
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie
};
