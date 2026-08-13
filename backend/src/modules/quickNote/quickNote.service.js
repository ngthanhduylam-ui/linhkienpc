const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');

const MAX_CONTENT_LENGTH = 500;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const VALID_STATUSES = new Set(['all', 'pending', 'processed']);

function validationError(message, field, issue) {
  return new AppError(message, 400, 'VALIDATION_ERROR', [{ field, issue }]);
}

function normalizeContent(value, field = 'body.content') {
  if (typeof value !== 'string') {
    throw validationError('Nội dung phải là chuỗi.', field, 'content must be a string');
  }

  const content = value.trim();
  if (!content) {
    throw validationError('Vui lòng nhập nội dung ghi chú.', field, 'content cannot be empty');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw validationError(
      `Nội dung không được vượt quá ${MAX_CONTENT_LENGTH} ký tự.`,
      field,
      `content must be at most ${MAX_CONTENT_LENGTH} characters`
    );
  }
  return content;
}

function validateAllowedKeys(payload, allowedKeys, { allowEmpty = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('Dữ liệu gửi lên không hợp lệ.', 'body', 'body must be an object');
  }

  const keys = Object.keys(payload);
  if (!allowEmpty && keys.length === 0) {
    throw validationError('Dữ liệu cập nhật không được để trống.', 'body', 'body cannot be empty');
  }
  const unknownKey = keys.find((key) => !allowedKeys.includes(key));
  if (unknownKey) {
    throw validationError('Dữ liệu chứa trường không được hỗ trợ.', `body.${unknownKey}`, 'field is not allowed');
  }
}

function validateCreatePayload(payload) {
  validateAllowedKeys(payload, ['content']);
  if (!Object.prototype.hasOwnProperty.call(payload, 'content')) {
    throw validationError('Vui lòng nhập nội dung ghi chú.', 'body.content', 'content is required');
  }
  return { content: normalizeContent(payload.content) };
}

function validatePatchPayload(payload) {
  validateAllowedKeys(payload, ['content', 'is_processed']);
  const update = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'content')) {
    update.content = normalizeContent(payload.content);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'is_processed')) {
    if (typeof payload.is_processed !== 'boolean') {
      throw validationError(
        'Trạng thái xử lý phải là true hoặc false.',
        'body.is_processed',
        'is_processed must be a boolean'
      );
    }
    update.is_processed = payload.is_processed;
  }
  return update;
}

function parseListOptions(query = {}) {
  const status = typeof query.status === 'string' ? query.status.trim().toLowerCase() : 'all';
  if (!VALID_STATUSES.has(status)) {
    throw validationError(
      'Trạng thái lọc không hợp lệ.',
      'query.status',
      'status must be all, pending, or processed'
    );
  }

  const rawLimit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  if (!Number.isSafeInteger(rawLimit) || rawLimit <= 0) {
    throw validationError('Giới hạn không hợp lệ.', 'query.limit', 'limit must be a positive integer');
  }

  return { status, limit: Math.min(rawLimit, MAX_LIMIT) };
}

function mapNote(row) {
  return {
    id: Number(row.id),
    content: row.content,
    is_processed: row.is_processed === 1 || row.is_processed === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    processed_at: row.processed_at || null
  };
}

async function getNoteById(id) {
  const [rows] = await pool.query(
    `SELECT id, content, is_processed, created_at, updated_at, processed_at
     FROM quick_notes
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  if (!rows.length) {
    throw new AppError('Không tìm thấy ghi chú.', 404, 'QUICK_NOTE_NOT_FOUND');
  }
  return mapNote(rows[0]);
}

async function listNotes(query = {}) {
  const { status, limit } = parseListOptions(query);
  const where = status === 'all' ? '' : 'WHERE is_processed = ?';
  const params = status === 'all' ? [limit] : [status === 'processed' ? 1 : 0, limit];

  const [[rows], [countRows]] = await Promise.all([
    pool.query(
      `SELECT id, content, is_processed, created_at, updated_at, processed_at
       FROM quick_notes
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      params
    ),
    pool.query('SELECT COUNT(*) AS pending_count FROM quick_notes WHERE is_processed = 0')
  ]);

  return {
    items: rows.map(mapNote),
    pendingCount: Number(countRows[0]?.pending_count || 0),
    status,
    limit
  };
}

async function createNote(payload) {
  const { content } = validateCreatePayload(payload);
  const [result] = await pool.query(
    'INSERT INTO quick_notes (content, is_processed) VALUES (?, 0)',
    [content]
  );
  return getNoteById(result.insertId);
}

async function updateNote(id, payload) {
  const update = validatePatchPayload(payload);
  await getNoteById(id);

  const assignments = [];
  const params = [];
  if (update.content !== undefined) {
    assignments.push('content = ?');
    params.push(update.content);
  }
  if (update.is_processed !== undefined) {
    assignments.push('is_processed = ?');
    params.push(update.is_processed ? 1 : 0);
    assignments.push(update.is_processed ? 'processed_at = CURRENT_TIMESTAMP' : 'processed_at = NULL');
  }
  params.push(id);

  const [result] = await pool.query(
    `UPDATE quick_notes SET ${assignments.join(', ')} WHERE id = ?`,
    params
  );
  if (result.affectedRows !== 1) {
    throw new AppError('Không tìm thấy ghi chú.', 404, 'QUICK_NOTE_NOT_FOUND');
  }
  return getNoteById(id);
}

async function deleteNote(id) {
  const note = await getNoteById(id);
  const [result] = await pool.query('DELETE FROM quick_notes WHERE id = ?', [id]);
  if (result.affectedRows !== 1) {
    throw new AppError('Không tìm thấy ghi chú.', 404, 'QUICK_NOTE_NOT_FOUND');
  }
  return note;
}

module.exports = {
  MAX_CONTENT_LENGTH,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  normalizeContent,
  validateCreatePayload,
  validatePatchPayload,
  parseListOptions,
  mapNote,
  getNoteById,
  listNotes,
  createNote,
  updateNote,
  deleteNote
};
