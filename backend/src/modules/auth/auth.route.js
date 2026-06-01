const express = require('express');
const { requireAuth } = require('../../middlewares/authenticate');
const controller = require('./auth.controller');
const validation = require('./auth.validation');

const router = express.Router();

router.post('/login', validation.loginValidator, controller.login);
router.post('/refresh', validation.refreshValidator, controller.refresh);
router.post('/logout', validation.refreshValidator, controller.logout);
router.get('/me', requireAuth, controller.me);

module.exports = router;
