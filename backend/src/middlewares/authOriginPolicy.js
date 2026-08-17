const env = require('../config/env');
const AppError = require('../utils/AppError');

function isAllowedOrigin(origin) {
  return !origin || env.auth.allowedOrigins.includes(origin);
}

function requireAllowedAuthOrigin(req, res, next) {
  const origin = req.get('Origin');
  if (!isAllowedOrigin(origin)) {
    return next(new AppError(
      'Origin is not allowed for this authentication request.',
      403,
      'AUTH_ORIGIN_NOT_ALLOWED'
    ));
  }
  return next();
}

module.exports = {
  isAllowedOrigin,
  requireAllowedAuthOrigin
};
