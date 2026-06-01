const AppError = require('../utils/AppError');

module.exports = function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'Internal server error';

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Duplicate data detected.'
      },
      meta: {
        request_id: req.id || null,
        server_time: new Date().toISOString()
      }
    });
  }

  const payload = {
    success: false,
    error: {
      code,
      message
    },
    meta: {
      request_id: req.id || null,
      server_time: new Date().toISOString()
    }
  };

  if (err instanceof AppError && err.details) {
    payload.error.details = err.details;
  }

  return res.status(statusCode).json(payload);
};
