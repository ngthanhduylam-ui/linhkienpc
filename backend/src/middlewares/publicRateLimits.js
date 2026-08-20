const { rateLimit } = require('express-rate-limit');
const AppError = require('../utils/AppError');

const PUBLIC_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const PUBLIC_DATA_RATE_LIMIT = 600;
const PUBLIC_SUGGESTIONS_RATE_LIMIT = 120;

function createPublicRateLimit({ limit, windowMs = PUBLIC_RATE_LIMIT_WINDOW_MS }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(req, res, next) {
      next(new AppError(
        'Too many public requests. Please try again shortly.',
        429,
        'PUBLIC_RATE_LIMITED'
      ));
    }
  });
}

const publicDataRateLimit = createPublicRateLimit({ limit: PUBLIC_DATA_RATE_LIMIT });
const publicSuggestionsRateLimit = createPublicRateLimit({ limit: PUBLIC_SUGGESTIONS_RATE_LIMIT });

module.exports = {
  PUBLIC_DATA_RATE_LIMIT,
  PUBLIC_RATE_LIMIT_WINDOW_MS,
  PUBLIC_SUGGESTIONS_RATE_LIMIT,
  createPublicRateLimit,
  publicDataRateLimit,
  publicSuggestionsRateLimit
};
