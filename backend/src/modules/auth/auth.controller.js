const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');

exports.login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  res.json({
    success: true,
    data,
    meta: {
      server_time: new Date().toISOString()
    }
  });
});

exports.refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body);
  res.json({
    success: true,
    data,
    meta: {
      server_time: new Date().toISOString()
    }
  });
});

exports.logout = asyncHandler(async (req, res) => {
  const data = await authService.logout(req.body);
  res.json({
    success: true,
    data,
    meta: {
      server_time: new Date().toISOString()
    }
  });
});

exports.me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.auth.adminId);
  res.json({
    success: true,
    data,
    meta: {
      server_time: new Date().toISOString()
    }
  });
});
