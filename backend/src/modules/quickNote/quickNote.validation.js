const validateRequest = require('../../middlewares/validateRequest');

const idParamValidator = validateRequest({
  params: {
    id: { required: true, type: 'string', pattern: /^[1-9]\d*$/ }
  }
});

module.exports = {
  idParamValidator
};
