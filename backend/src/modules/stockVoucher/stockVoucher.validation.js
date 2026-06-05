const validateRequest = require('../../middlewares/validateRequest');

const idPattern = /^\d+$/;

const idParamValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  }
});

module.exports = {
  idParamValidator
};
