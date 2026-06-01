const express = require('express');
const controller = require('./inventory.controller');

const router = express.Router();

router.get('/', controller.getInventoryOverview);

module.exports = router;
