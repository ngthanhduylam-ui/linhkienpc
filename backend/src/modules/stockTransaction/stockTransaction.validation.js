const validateRequest = require('../../middlewares/validateRequest');

const stockBodyValidator = validateRequest({
  body: {
    sku: { required: true, type: 'string', minLength: 3, maxLength: 120, pattern: /^[a-z0-9]+(\.[a-z0-9]+)*$/i },
    quantity: { required: true, type: 'number', integer: true, min: 1 },
    note: { required: false, type: 'string', maxLength: 500 },
    warranty_note: { required: false, type: 'string', maxLength: 500 }
  }
});

module.exports = {
  stockBodyValidator
};
