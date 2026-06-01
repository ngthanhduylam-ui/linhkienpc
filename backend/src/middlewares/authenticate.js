const AppError = require('../utils/AppError');

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(new AppError('Missing or invalid Authorization header.', 401, 'AUTH_TOKEN_MISSING'));
  }

  try {
    const { verifyAccessToken } = require('../utils/jwt');
    const decoded = verifyAccessToken(token);
    req.auth = {
      adminId: decoded.adminId,
      username: decoded.username
    };
    return next();
  } catch (error) {
    return next(new AppError('Token is invalid or expired.', 401, 'AUTH_TOKEN_INVALID'));
  }
}

module.exports = {
  requireAuth,
  extractToken
};
