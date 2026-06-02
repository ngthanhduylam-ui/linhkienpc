const validateRequest = require('../../middlewares/validateRequest');

const listCustomersValidator = validateRequest({
  query: {
    keyword: { required: false, type: 'string', maxLength: 100 },
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

module.exports = {
  listCustomersValidator,
  createCustomerValidator
};
