const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');
const {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie
} = require('./auth.cookie');

function publicAuthData(result) {
  return {
    access_token: result.access_token,
    token_type: result.token_type,
    admin: result.admin
  };
}

function sendAuthResponse(res, result) {
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.json({
    success: true,
    data: publicAuthData(result),
    meta: { server_time: new Date().toISOString() }
  });
}

exports.login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendAuthResponse(res, result);
});

exports.refresh = asyncHandler(async (req, res) => {
  try {
    const result = await authService.refresh(readRefreshCookie(req));
    sendAuthResponse(res, result);
  } catch (error) {
    if (error.code !== 'AUTH_REFRESH_RACE_RETRY') {
      clearRefreshCookie(res);
    }
    throw error;
  }
});

exports.logout = asyncHandler(async (req, res) => {
  let data;
  try {
    data = await authService.logout(readRefreshCookie(req));
  } finally {
    clearRefreshCookie(res);
  }
  res.json({
    success: true,
    data,
    meta: { server_time: new Date().toISOString() }
  });
});

exports.me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.auth.adminId);
  res.json({
    success: true,
    data,
    meta: { server_time: new Date().toISOString() }
  });
});

module.exports.publicAuthData = publicAuthData;
