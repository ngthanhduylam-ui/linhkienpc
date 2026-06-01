const crypto = require('crypto');
const { pool } = require('../../config/database');
const { comparePassword } = require('../../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const AppError = require('../../utils/AppError');

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function mapAdminProfile(admin) {
  return {
    id: admin.id,
    username: admin.username,
    display_name: admin.display_name,
    is_active: admin.is_active === 1,
    created_at: admin.created_at,
    updated_at: admin.updated_at
  };
}

async function findAdminByUsername(username) {
  const [rows] = await pool.query(
    `
      SELECT id, username, password_hash, display_name, is_active, created_at, updated_at
      FROM admins
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );
  return rows[0] || null;
}

async function findAdminById(adminId) {
  const [rows] = await pool.query(
    `
      SELECT id, username, display_name, is_active, created_at, updated_at
      FROM admins
      WHERE id = ?
      LIMIT 1
    `,
    [adminId]
  );
  return rows[0] || null;
}

async function insertRefreshToken(conn, adminId, refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  await conn.query(
    `
      INSERT INTO admin_refresh_tokens (admin_id, token_hash, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))
    `,
    [adminId, tokenHash]
  );
}

async function login({ username, password }) {
  const admin = await findAdminByUsername(username.trim());
  if (!admin) {
    throw new AppError('Sai tên đăng nhập hoặc mật khẩu.', 401, 'AUTH_INVALID_CREDENTIALS');
  }
  if (admin.is_active !== 1) {
    throw new AppError('Tài khoản admin đã bị vô hiệu hóa.', 403, 'AUTH_ADMIN_INACTIVE');
  }

  const matched = await comparePassword(password, admin.password_hash);
  if (!matched) {
    throw new AppError('Sai tên đăng nhập hoặc mật khẩu.', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const payload = { adminId: admin.id, username: admin.username };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await insertRefreshToken(pool, admin.id, refreshToken);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    admin: mapAdminProfile(admin)
  };
}

async function refresh({ refresh_token }) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refresh_token);
  } catch (error) {
    throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn.', 401, 'AUTH_TOKEN_INVALID');
  }

  const hashedToken = hashRefreshToken(refresh_token);
  const [tokenRows] = await pool.query(
    `
      SELECT id, admin_id, revoked_at, expires_at
      FROM admin_refresh_tokens
      WHERE token_hash = ?
      LIMIT 1
    `,
    [hashedToken]
  );

  if (!tokenRows.length) {
    throw new AppError('Refresh token không hợp lệ.', 401, 'AUTH_TOKEN_INVALID');
  }

  const tokenRecord = tokenRows[0];
  if (tokenRecord.revoked_at) {
    throw new AppError('Refresh token đã bị thu hồi.', 401, 'AUTH_TOKEN_INVALID');
  }
  if (new Date(tokenRecord.expires_at) <= new Date()) {
    throw new AppError('Refresh token đã hết hạn.', 401, 'AUTH_TOKEN_INVALID');
  }
  if (tokenRecord.admin_id !== decoded.adminId) {
    throw new AppError('Refresh token không hợp lệ.', 401, 'AUTH_TOKEN_INVALID');
  }

  const admin = await findAdminById(tokenRecord.admin_id);
  if (!admin || admin.is_active !== 1) {
    throw new AppError('Admin không hợp lệ hoặc đã bị vô hiệu hóa.', 403, 'AUTH_ADMIN_INACTIVE');
  }

  const payload = { adminId: admin.id, username: admin.username };
  const nextAccessToken = signAccessToken(payload);
  const nextRefreshToken = signRefreshToken(payload);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `
        UPDATE admin_refresh_tokens
        SET revoked_at = NOW()
        WHERE id = ?
      `,
      [tokenRecord.id]
    );
    await insertRefreshToken(conn, admin.id, nextRefreshToken);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return {
    access_token: nextAccessToken,
    refresh_token: nextRefreshToken,
    token_type: 'Bearer'
  };
}

async function logout({ refresh_token }) {
  const hashedToken = hashRefreshToken(refresh_token);
  const [result] = await pool.query(
    `
      UPDATE admin_refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = ?
        AND revoked_at IS NULL
    `,
    [hashedToken]
  );

  return {
    logged_out: true,
    revoked: result.affectedRows > 0
  };
}

async function me(adminId) {
  const admin = await findAdminById(adminId);
  if (!admin) {
    throw new AppError('Admin not found.', 404, 'RESOURCE_NOT_FOUND');
  }
  return mapAdminProfile(admin);
}

module.exports = {
  login,
  refresh,
  logout,
  me
};
