const express = require('express');
const controller = require('./stockTransaction.controller');
const validators = require('./stockTransaction.validation');

const router = express.Router();

router.post('/stock-in', validators.stockBodyValidator, controller.stockIn);
router.post('/stock-out', validators.stockBodyValidator, controller.stockOut);
router.get('/stock-transactions', controller.listTransactions);

module.exports = router;
