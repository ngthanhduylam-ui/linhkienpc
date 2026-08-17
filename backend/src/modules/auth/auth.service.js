const crypto = require('crypto');
const { pool } = require('../../config/database');
const env = require('../../config/env');
const { comparePassword } = require('../../utils/password');
const {
  getTokenExpirationDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} = require('../../utils/jwt');
const AppError = require('../../utils/AppError');

const REVOKE_REASONS = Object.freeze({
  ROTATED: 'rotated',
  LOGOUT: 'logout',
  REFRESH_REUSE: 'refresh_reuse_detected',
  AUTH_VERSION_CHANGED: 'auth_version_changed',
  ADMIN_INACTIVE: 'admin_inactive'
});

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

function tokenPayload(admin, extra = {}) {
  return {
    adminId: admin.id,
    username: admin.username,
    authVersion: Number(admin.auth_version),
    ...extra
  };
}

async function findAdminByUsername(username, queryable = pool) {
  const [rows] = await queryable.query(
    `
      SELECT id, username, password_hash, display_name, is_active, auth_version,
             created_at, updated_at
      FROM admins
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );
  return rows[0] || null;
}

async function findAdminById(adminId, queryable = pool, { forUpdate = false } = {}) {
  const [rows] = await queryable.query(
    `
      SELECT id, username, display_name, is_active, auth_version, created_at, updated_at
      FROM admins
      WHERE id = ?
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `,
    [adminId]
  );
  return rows[0] || null;
}

async function insertRefreshToken(conn, {
  adminId,
  familyId,
  tokenJti,
  refreshToken,
  expiresAt
}) {
  await conn.query(
    `
      INSERT INTO admin_refresh_tokens (
        admin_id, family_id, token_jti, token_hash, expires_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [adminId, familyId, tokenJti, hashRefreshToken(refreshToken), expiresAt]
  );
}

function createRefreshCredential(admin, familyId) {
  const tokenJti = crypto.randomUUID();
  const refreshToken = signRefreshToken(tokenPayload(admin, { familyId }), tokenJti);
  return {
    familyId,
    tokenJti,
    refreshToken,
    expiresAt: getTokenExpirationDate(refreshToken)
  };
}

function createAccessToken(admin) {
  return signAccessToken(tokenPayload(admin));
}

async function revokeRefreshFamily(queryable, familyId, reason) {
  const [result] = await queryable.query(
    `
      UPDATE admin_refresh_tokens
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
          revoked_reason = CASE
            WHEN revoked_reason IS NULL OR revoked_reason = ? THEN ?
            ELSE revoked_reason
          END
      WHERE family_id = ?
    `,
    [REVOKE_REASONS.ROTATED, reason, familyId]
  );
  return result.affectedRows;
}

async function revokeAllRefreshFamilies(queryable, adminId, reason) {
  const [result] = await queryable.query(
    `
      UPDATE admin_refresh_tokens
      SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
          revoked_reason = COALESCE(revoked_reason, ?)
      WHERE admin_id = ?
        AND revoked_at IS NULL
    `,
    [reason, adminId]
  );
  return result.affectedRows;
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

  const conn = await pool.getConnection();
  const familyId = crypto.randomUUID();
  const credential = createRefreshCredential(admin, familyId);
  try {
    await conn.beginTransaction();
    await insertRefreshToken(conn, {
      adminId: admin.id,
      ...credential
    });
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return {
    access_token: createAccessToken(admin),
    token_type: 'Bearer',
    admin: mapAdminProfile(admin),
    refreshToken: credential.refreshToken,
    refreshExpiresAt: credential.expiresAt
  };
}

function isWithinRotationGrace(tokenRecord) {
  if (!tokenRecord.rotated_at || tokenRecord.revoked_reason !== REVOKE_REASONS.ROTATED) {
    return false;
  }
  const rotatedAt = new Date(tokenRecord.rotated_at).getTime();
  return Number.isFinite(rotatedAt)
    && Date.now() - rotatedAt <= env.auth.refreshReuseGraceMs;
}

function invalidRefreshError(message = 'Refresh token không hợp lệ hoặc đã hết hạn.') {
  return new AppError(message, 401, 'AUTH_TOKEN_INVALID');
}

async function refresh(refreshToken) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw invalidRefreshError();
  }

  const conn = await pool.getConnection();
  let committed = false;
  try {
    await conn.beginTransaction();
    const [tokenRows] = await conn.query(
      `
        SELECT id, admin_id, family_id, token_jti, replaced_by_jti,
               revoked_at, revoked_reason, rotated_at, expires_at
        FROM admin_refresh_tokens
        WHERE token_hash = ?
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [hashRefreshToken(refreshToken)]
    );

    if (!tokenRows.length) {
      throw invalidRefreshError();
    }

    const tokenRecord = tokenRows[0];
    if (tokenRecord.revoked_at) {
      if (isWithinRotationGrace(tokenRecord)) {
        throw new AppError(
          'Refresh đang được xử lý ở tab khác. Vui lòng thử lại.',
          409,
          'AUTH_REFRESH_RACE_RETRY'
        );
      }
      if (tokenRecord.revoked_reason === REVOKE_REASONS.ROTATED) {
        await revokeRefreshFamily(conn, tokenRecord.family_id, REVOKE_REASONS.REFRESH_REUSE);
        await conn.commit();
        committed = true;
        throw new AppError(
          'Phiên đăng nhập không còn an toàn. Vui lòng đăng nhập lại.',
          401,
          'AUTH_REFRESH_REUSE_DETECTED'
        );
      }
      throw invalidRefreshError('Refresh token đã bị thu hồi.');
    }

    if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
      throw invalidRefreshError('Refresh token đã hết hạn.');
    }

    const claimsMatch = tokenRecord.admin_id === decoded.adminId
      && tokenRecord.family_id === decoded.familyId
      && tokenRecord.token_jti === decoded.jti;
    if (!claimsMatch) {
      throw invalidRefreshError();
    }

    const admin = await findAdminById(tokenRecord.admin_id, conn, { forUpdate: true });
    if (!admin || admin.is_active !== 1) {
      await revokeRefreshFamily(conn, tokenRecord.family_id, REVOKE_REASONS.ADMIN_INACTIVE);
      await conn.commit();
      committed = true;
      throw new AppError('Admin không hợp lệ hoặc đã bị vô hiệu hóa.', 403, 'AUTH_ADMIN_INACTIVE');
    }
    if (Number(decoded.authVersion) !== Number(admin.auth_version)) {
      await revokeRefreshFamily(conn, tokenRecord.family_id, REVOKE_REASONS.AUTH_VERSION_CHANGED);
      await conn.commit();
      committed = true;
      throw new AppError('Phiên đăng nhập đã hết hiệu lực.', 401, 'AUTH_VERSION_MISMATCH');
    }

    const nextCredential = createRefreshCredential(admin, tokenRecord.family_id);
    const [rotationResult] = await conn.query(
      `
        UPDATE admin_refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP,
            revoked_reason = ?,
            replaced_by_jti = ?,
            rotated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND revoked_at IS NULL
      `,
      [REVOKE_REASONS.ROTATED, nextCredential.tokenJti, tokenRecord.id]
    );
    if (rotationResult.affectedRows !== 1) {
      throw new AppError('Refresh token đã được sử dụng.', 409, 'AUTH_REFRESH_RACE_RETRY');
    }

    await insertRefreshToken(conn, {
      adminId: admin.id,
      ...nextCredential
    });
    await conn.commit();
    committed = true;

    return {
      access_token: createAccessToken(admin),
      token_type: 'Bearer',
      admin: mapAdminProfile(admin),
      refreshToken: nextCredential.refreshToken,
      refreshExpiresAt: nextCredential.expiresAt
    };
  } catch (error) {
    if (!committed) {
      await conn.rollback();
    }
    throw error;
  } finally {
    conn.release();
  }
}

async function logout(refreshToken) {
  if (!refreshToken) {
    return { logged_out: true, revoked: false };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `
        SELECT family_id
        FROM admin_refresh_tokens
        WHERE token_hash = ?
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [hashRefreshToken(refreshToken)]
    );
    const revoked = rows.length
      ? await revokeRefreshFamily(conn, rows[0].family_id, REVOKE_REASONS.LOGOUT)
      : 0;
    await conn.commit();
    return { logged_out: true, revoked: revoked > 0 };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getAdminAuthState(adminId) {
  return findAdminById(adminId);
}

async function incrementAuthVersionAndRevokeSessions(adminId, reason = REVOKE_REASONS.AUTH_VERSION_CHANGED) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const admin = await findAdminById(adminId, conn, { forUpdate: true });
    if (!admin) {
      throw new AppError('Admin not found.', 404, 'RESOURCE_NOT_FOUND');
    }
    await conn.query(
      'UPDATE admins SET auth_version = auth_version + 1 WHERE id = ?',
      [adminId]
    );
    const revokedSessions = await revokeAllRefreshFamilies(conn, adminId, reason);
    await conn.commit();
    return {
      adminId,
      authVersion: Number(admin.auth_version) + 1,
      revokedSessions
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function me(adminId) {
  const admin = await findAdminById(adminId);
  if (!admin) {
    throw new AppError('Admin not found.', 404, 'RESOURCE_NOT_FOUND');
  }
  return mapAdminProfile(admin);
}

module.exports = {
  REVOKE_REASONS,
  hashRefreshToken,
  mapAdminProfile,
  login,
  refresh,
  logout,
  me,
  getAdminAuthState,
  revokeRefreshFamily,
  revokeAllRefreshFamilies,
  incrementAuthVersionAndRevokeSessions
};
