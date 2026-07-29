const validateRequest = require('../../middlewares/validateRequest');

const idPattern = /^[1-9]\d*$/;

const idParamValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: idPattern }
  }
});

module.exports = {
  idParamValidator
};
