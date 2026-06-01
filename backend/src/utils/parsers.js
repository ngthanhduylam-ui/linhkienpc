const AppError = require('./AppError');

function parsePagination(query) {
  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 20;

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError('page must be a positive integer.', 400, 'VALIDATION_ERROR');
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError('limit must be an integer between 1 and 100.', 400, 'VALIDATION_ERROR');
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function parseNullableInt(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`${fieldName} must be a positive integer.`, 400, 'VALIDATION_ERROR');
  }
  return parsed;
}

function parseBooleanQuery(value, defaultValue = null) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (value === true || value === 'true' || value === '1' || value === 1) {
    return true;
  }
  if (value === false || value === 'false' || value === '0' || value === 0) {
    return false;
  }
  throw new AppError('Boolean query value is invalid.', 400, 'VALIDATION_ERROR');
}

function escapeLike(input) {
  return input.replace(/[\\%_]/g, '\\$&');
}

module.exports = {
  parsePagination,
  parseNullableInt,
  parseBooleanQuery,
  escapeLike
};
