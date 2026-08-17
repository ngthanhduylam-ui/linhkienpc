const { rateLimit } = require('express-rate-limit');
const AppError = require('../utils/AppError');

const adminRefreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(req, res, next) {
    next(new AppError(
      'Too many refresh attempts. Please try again later.',
      429,
      'AUTH_REFRESH_RATE_LIMITED'
    ));
  }
});

module.exports = adminRefreshRateLimit;
