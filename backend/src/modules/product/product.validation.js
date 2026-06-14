const validateRequest = require('../../middlewares/validateRequest');

const idPattern = /^\d+$/;
const MAX_SALE_PRICE = 999999999999999;

const createProductValidator = validateRequest({
  body: {
    sku: { required: true, type: 'string', minLength: 3, maxLength: 120, pattern: /^[a-z0-9]+(\.[a-z0-9]+)*$/i },
    name: { required: true, type: 'string', minLength: 2, maxLength: 255 },
    category_id: { required: true, type: 'number', integer: true, min: 1 },
    spec_summary: { required: false, type: 'string' },
    sale_price: { required: false, type: 'number', integer: true, min: 0, max: MAX_SALE_PRICE }
  }
});

const updateProductValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  },
  body: {
    sku: { required: false, type: 'string', minLength: 3, maxLength: 120, pattern: /^[a-z0-9]+(\.[a-z0-9]+)*$/i },
    name: { required: false, type: 'string', minLength: 2, maxLength: 255 },
    category_id: { required: false, type: 'number', integer: true, min: 1 },
    spec_summary: { required: false, type: 'string' },
    sale_price: { required: false, type: 'number', integer: true, min: 0, max: MAX_SALE_PRICE }
  }
});

const idParamValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  }
});

const skuParamValidator = validateRequest({
  params: {
    sku: { required: true, type: 'string', minLength: 3, maxLength: 120, pattern: /^[a-z0-9]+(\.[a-z0-9]+)*$/i }
  }
});

module.exports = {
  createProductValidator,
  updateProductValidator,
  idParamValidator,
  skuParamValidator
};
