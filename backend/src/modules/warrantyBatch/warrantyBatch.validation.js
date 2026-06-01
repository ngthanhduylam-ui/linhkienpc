const validateRequest = require('../../middlewares/validateRequest');

const idPattern = /^\d+$/;

const createBatchValidator = validateRequest({
  params: {
    productId: { required: true, type: 'string', pattern: idPattern }
  },
  body: {
    batch_code: { required: true, type: 'string', minLength: 2, maxLength: 50 },
    warranty_end_month: { required: false, type: 'number', integer: true, min: 1 },
    warranty_end_year: { required: false, type: 'number', integer: true, min: 2000 }
  }
});

const updateBatchValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  },
  body: {
    batch_code: { required: false, type: 'string', minLength: 2, maxLength: 50 },
    warranty_end_month: { required: false, type: 'number', integer: true, min: 1 },
    warranty_end_year: { required: false, type: 'number', integer: true, min: 2000 }
  }
});

const batchIdValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  }
});

const productIdValidator = validateRequest({
  params: {
    productId: { required: true, type: 'string', pattern: idPattern }
  }
});

module.exports = {
  createBatchValidator,
  updateBatchValidator,
  batchIdValidator,
  productIdValidator
};
