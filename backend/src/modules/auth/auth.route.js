const express = require('express');
const { requireAuth } = require('../../middlewares/authenticate');
const adminLoginRateLimit = require('../../middlewares/adminLoginRateLimit');
const adminRefreshRateLimit = require('../../middlewares/adminRefreshRateLimit');
const { requireAllowedAuthOrigin } = require('../../middlewares/authOriginPolicy');
const controller = require('./auth.controller');
const validation = require('./auth.validation');

const router = express.Router();

router.post('/login', requireAllowedAuthOrigin, adminLoginRateLimit, validation.loginValidator, controller.login);
router.post('/refresh', requireAllowedAuthOrigin, adminRefreshRateLimit, controller.refresh);
router.post('/logout', requireAllowedAuthOrigin, controller.logout);
router.get('/me', requireAuth, controller.me);

module.exports = router;
