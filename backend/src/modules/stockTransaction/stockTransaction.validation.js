const validateRequest = require('../../middlewares/validateRequest');
const AppError = require('../../utils/AppError');

const SKU_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)*$/i;

const stockBodyValidator = validateRequest({
  body: {
    sku: { required: true, type: 'string', minLength: 3, maxLength: 120, pattern: /^[a-z0-9]+(\.[a-z0-9]+)*$/i },
    quantity: { required: true, type: 'number', integer: true, min: 1 },
    customer_id: { required: false, type: 'number', integer: true, min: 1 },
    supplier_id: { required: false, type: 'number', integer: true, min: 1 },
    note: { required: false, type: 'string', maxLength: 500 },
    warranty_note: { required: false, type: 'string', maxLength: 500 }
  }
});

function bulkStockInBodyValidator(req, res, next) {
  const details = [];
  const { supplier_id: supplierId, items } = req.body || {};

  if (supplierId !== undefined && supplierId !== null && supplierId !== '') {
    if (typeof supplierId !== 'number' || !Number.isInteger(supplierId) || supplierId < 1) {
      details.push({ field: 'body.supplier_id', issue: 'supplier_id must be a positive integer' });
    }
  }

  if (!Array.isArray(items)) {
    details.push({ field: 'body.items', issue: 'items must be an array' });
  } else {
    if (items.length < 1) {
      details.push({ field: 'body.items', issue: 'items must not be empty' });
    }
    if (items.length > 100) {
      details.push({ field: 'body.items', issue: 'items must contain at most 100 items' });
    }

    items.forEach((item, index) => {
      const fieldPrefix = `body.items[${index}]`;

      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        details.push({ field: fieldPrefix, issue: 'item must be an object' });
        return;
      }

      if (typeof item.sku !== 'string' || item.sku.trim().length < 3 || item.sku.trim().length > 120) {
        details.push({ field: `${fieldPrefix}.sku`, issue: 'sku must be a string between 3 and 120 characters' });
      } else if (!SKU_PATTERN.test(item.sku.trim())) {
        details.push({ field: `${fieldPrefix}.sku`, issue: 'sku has invalid format' });
      }

      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) {
        details.push({ field: `${fieldPrefix}.quantity`, issue: 'quantity must be a positive integer' });
      }

      if (item.note !== undefined && item.note !== null && typeof item.note !== 'string') {
        details.push({ field: `${fieldPrefix}.note`, issue: 'note must be a string' });
      } else if (typeof item.note === 'string' && item.note.length > 500) {
        details.push({ field: `${fieldPrefix}.note`, issue: 'note must be at most 500 characters' });
      }
    });
  }

  if (details.length > 0) {
    return next(new AppError('Request validation failed.', 400, 'VALIDATION_ERROR', details));
  }

  return next();
}

function bulkStockOutBodyValidator(req, res, next) {
  const details = [];
  const { customer_id: customerId, items } = req.body || {};

  if (customerId !== undefined && customerId !== null && customerId !== '') {
    if (typeof customerId !== 'number' || !Number.isInteger(customerId) || customerId < 1) {
      details.push({ field: 'body.customer_id', issue: 'customer_id must be a positive integer' });
    }
  }

  if (!Array.isArray(items)) {
    details.push({ field: 'body.items', issue: 'items must be an array' });
  } else {
    if (items.length < 1) {
      details.push({ field: 'body.items', issue: 'items must not be empty' });
    }
    if (items.length > 100) {
      details.push({ field: 'body.items', issue: 'items must contain at most 100 items' });
    }

    items.forEach((item, index) => {
      const fieldPrefix = `body.items[${index}]`;

      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        details.push({ field: fieldPrefix, issue: 'item must be an object' });
        return;
      }

      if (typeof item.sku !== 'string' || item.sku.trim().length < 3 || item.sku.trim().length > 120) {
        details.push({ field: `${fieldPrefix}.sku`, issue: 'sku must be a string between 3 and 120 characters' });
      } else if (!SKU_PATTERN.test(item.sku.trim())) {
        details.push({ field: `${fieldPrefix}.sku`, issue: 'sku has invalid format' });
      }

      if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1) {
        details.push({ field: `${fieldPrefix}.quantity`, issue: 'quantity must be a positive integer' });
      }

      if (item.unit_price !== undefined) {
        details.push({ field: `${fieldPrefix}.unit_price`, issue: 'unit_price is not accepted for stock-out' });
      }

      if (item.line_total !== undefined) {
        details.push({ field: `${fieldPrefix}.line_total`, issue: 'line_total is not accepted for stock-out' });
      }

      if (item.warranty_note !== undefined && item.warranty_note !== null && typeof item.warranty_note !== 'string') {
        details.push({ field: `${fieldPrefix}.warranty_note`, issue: 'warranty_note must be a string' });
      } else if (typeof item.warranty_note === 'string' && item.warranty_note.length > 500) {
        details.push({ field: `${fieldPrefix}.warranty_note`, issue: 'warranty_note must be at most 500 characters' });
      }

      if (item.sale_note !== undefined && item.sale_note !== null && typeof item.sale_note !== 'string') {
        details.push({ field: `${fieldPrefix}.sale_note`, issue: 'sale_note must be a string or null' });
      } else if (typeof item.sale_note === 'string' && item.sale_note.length > 500) {
        details.push({ field: `${fieldPrefix}.sale_note`, issue: 'sale_note must be at most 500 characters' });
      }
    });
  }

  if (details.length > 0) {
    return next(new AppError('Request validation failed.', 400, 'VALIDATION_ERROR', details));
  }

  return next();
}

module.exports = {
  bulkStockInBodyValidator,
  bulkStockOutBodyValidator,
  stockBodyValidator
};
