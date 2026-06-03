const validateRequest = require('../../middlewares/validateRequest');

const skuPattern = /^[a-z0-9]+(\.[a-z0-9]+)*$/i;

const skuParamValidator = validateRequest({
  params: {
    sku: { required: true, type: 'string', minLength: 3, maxLength: 120, pattern: skuPattern }
  }
});

const moveNoteValidator = validateRequest({
  body: {
    sku: { required: true, type: 'string', minLength: 3, maxLength: 120, pattern: skuPattern },
    from_note: { required: false, type: 'string', maxLength: 500 },
    to_note: { required: false, type: 'string', maxLength: 500 },
    quantity: { required: true, type: 'number', integer: true, min: 1 },
    reason: { required: false, type: 'string', maxLength: 500 }
  }
});

module.exports = {
  moveNoteValidator,
  skuParamValidator
};
