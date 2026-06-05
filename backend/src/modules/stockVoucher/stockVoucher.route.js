const express = require('express');
const controller = require('./stockVoucher.controller');
const validators = require('./stockVoucher.validation');

const router = express.Router();

router.get('/', controller.listStockVouchers);
router.get('/:id', validators.idParamValidator, controller.getStockVoucherById);

module.exports = router;
