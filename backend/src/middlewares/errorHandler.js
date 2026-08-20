const AppError = require('../utils/AppError');

module.exports = function errorHandler(err, req, res, next) {
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

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isAppError ? err.message : 'Internal server error.';

  if (!isAppError) {
    const requestPath = req.path
      || req.originalUrl?.split('?')[0]
      || req.url?.split('?')[0]
      || null;

    console.error('Unexpected API error', {
      request_id: req.id || null,
      method: req.method || null,
      path: requestPath,
      error: err.stack || String(err)
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

  if (isAppError && err.details) {
    payload.error.details = err.details;
  }

  return res.status(statusCode).json(payload);
};
