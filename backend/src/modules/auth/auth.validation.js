const validateRequest = require('../../middlewares/validateRequest');

const loginValidator = validateRequest({
  body: {
    username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
    password: { required: true, type: 'string', minLength: 6, maxLength: 200 }
  }
});

module.exports = {
  loginValidator
};
