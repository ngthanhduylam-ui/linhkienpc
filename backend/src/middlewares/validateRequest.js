const AppError = require('../utils/AppError');

function validateField(value, rule, fieldPath) {
  if (value === undefined || value === null) {
    if (rule.required) {
      return `${fieldPath} is required`;
    }
    return null;
  }

  if (rule.type === 'string') {
    if (typeof value !== 'string') {
      return `${fieldPath} must be a string`;
    }
    if (rule.minLength && value.trim().length < rule.minLength) {
      return `${fieldPath} must be at least ${rule.minLength} characters`;
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return `${fieldPath} must be at most ${rule.maxLength} characters`;
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return `${fieldPath} has invalid format`;
    }
  }

  if (rule.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return `${fieldPath} must be a number`;
    }
    if (rule.integer && !Number.isInteger(value)) {
      return `${fieldPath} must be an integer`;
    }
    if (rule.min !== undefined && value < rule.min) {
      return `${fieldPath} must be >= ${rule.min}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return `${fieldPath} must be <= ${rule.max}`;
    }
  }

  if (rule.enum && !rule.enum.includes(value)) {
    return `${fieldPath} must be one of: ${rule.enum.join(', ')}`;
  }

  return null;
}

function validateRequest(schema = {}) {
  return (req, res, next) => {
    const details = [];
    const zones = ['params', 'query', 'body'];

    for (const zone of zones) {
      const zoneSchema = schema[zone];
      if (!zoneSchema) {
        continue;
      }

      for (const [field, rule] of Object.entries(zoneSchema)) {
        const value = req[zone][field];
        const issue = validateField(value, rule, `${zone}.${field}`);
        if (issue) {
          details.push({ field: `${zone}.${field}`, issue });
        }
      }
    }

    if (details.length > 0) {
      return next(new AppError('Request validation failed.', 400, 'VALIDATION_ERROR', details));
    }

    return next();
  };
}

module.exports = validateRequest;
