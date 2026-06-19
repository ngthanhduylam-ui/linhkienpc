const { rateLimit } = require('express-rate-limit');
const AppError = require('../utils/AppError');

const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler(req, res, next) {
    next(
      new AppError(
        'Too many login attempts. Please try again later.',
        429,
        'AUTH_LOGIN_RATE_LIMITED'
      )
    );
  }
});

module.exports = adminLoginRateLimit;
