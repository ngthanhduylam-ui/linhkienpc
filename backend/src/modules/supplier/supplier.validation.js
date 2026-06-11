const validateRequest = require('../../middlewares/validateRequest');

const idPattern = /^\d+$/;

const listSuppliersValidator = validateRequest({
  query: {
    keyword: { required: false, type: 'string', maxLength: 100 },
    is_active: { required: false, type: 'string', maxLength: 5 },
    page: { required: false, type: 'string', maxLength: 6 },
    limit: { required: false, type: 'string', maxLength: 3 }
  }
});

const createSupplierValidator = validateRequest({
  body: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    phone: { required: false, type: 'string', maxLength: 30 },
    address: { required: false, type: 'string', maxLength: 255 }
  }
});

const updateSupplierValidator = validateRequest({
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

module.exports = {
  listSuppliersValidator,
  createSupplierValidator,
  updateSupplierValidator,
  idParamValidator
};
