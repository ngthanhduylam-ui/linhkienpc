const validateRequest = require('../../middlewares/validateRequest');

const idPattern = /^\d+$/;

const listCustomersValidator = validateRequest({
  query: {
    keyword: { required: false, type: 'string', maxLength: 100 },
    is_active: { required: false, type: 'string', maxLength: 5 },
    page: { required: false, type: 'string', maxLength: 6 },
    limit: { required: false, type: 'string', maxLength: 3 }
  }
});

const createCustomerValidator = validateRequest({
  body: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    phone: { required: false, type: 'string', maxLength: 30 },
    address: { required: false, type: 'string', maxLength: 255 }
  }
});

const updateCustomerValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  },
  body: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    phone: { required: false, type: 'string', maxLength: 30 },
    address: { required: false, type: 'string', maxLength: 255 }
  }
});

const idParamValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  }
});

const listCustomerTransactionsValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  },
  query: {
    page: { required: false, type: 'string', maxLength: 6 },
    limit: { required: false, type: 'string', maxLength: 3 }
  }
});

module.exports = {
  listCustomersValidator,
  createCustomerValidator,
  updateCustomerValidator,
  idParamValidator,
  listCustomerTransactionsValidator
};
