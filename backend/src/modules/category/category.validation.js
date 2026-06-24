const validateRequest = require('../../middlewares/validateRequest');

const idPattern = /^[1-9]\d*$/;

const createCategoryValidator = validateRequest({
  body: {
    code: { required: true, type: 'string', minLength: 2, maxLength: 50, pattern: /^[a-z0-9_.-]+$/i },
    name: { required: true, type: 'string', minLength: 2, maxLength: 120 },
    description: { required: false, type: 'string', maxLength: 255 }
  }
});

const updateCategoryValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  },
  body: {
    code: { required: false, type: 'string', minLength: 2, maxLength: 50, pattern: /^[a-z0-9_.-]+$/i },
    name: { required: false, type: 'string', minLength: 2, maxLength: 120 },
    description: { required: false, type: 'string', maxLength: 255 }
  }
});

const idParamValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  }
});

module.exports = {
  createCategoryValidator,
  updateCategoryValidator,
  idParamValidator
};
