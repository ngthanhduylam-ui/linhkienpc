const validateRequest = require('../../middlewares/validateRequest');

const loginValidator = validateRequest({
  body: {
    username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
    password: { required: true, type: 'string', minLength: 6, maxLength: 200 }
  }
});

const refreshValidator = validateRequest({
  body: {
    refresh_token: { required: true, type: 'string', minLength: 20, maxLength: 5000 }
  }
});

module.exports = {
  loginValidator,
  refreshValidator
};
