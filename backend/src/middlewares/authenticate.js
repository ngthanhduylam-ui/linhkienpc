const AppError = require('../utils/AppError');

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(new AppError('Missing or invalid Authorization header.', 401, 'AUTH_TOKEN_MISSING'));
  }

  try {
    const { verifyAccessToken } = require('../utils/jwt');
    const { getAdminAuthState } = require('../modules/auth/auth.service');
    const decoded = verifyAccessToken(token);
    const admin = await getAdminAuthState(decoded.adminId);
    if (!admin || admin.is_active !== 1) {
      return next(new AppError('Admin is inactive or unavailable.', 401, 'AUTH_ADMIN_INACTIVE'));
    }
    if (Number(decoded.authVersion) !== Number(admin.auth_version)) {
      return next(new AppError('Authentication state has changed.', 401, 'AUTH_VERSION_MISMATCH'));
    }
    req.auth = {
      adminId: decoded.adminId,
      username: admin.username,
      authVersion: Number(admin.auth_version)
    };
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Token is invalid or expired.', 401, 'AUTH_TOKEN_INVALID'));
  }
}

module.exports = {
  requireAuth,
  extractToken
};
