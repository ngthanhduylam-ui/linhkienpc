const express = require('express');
const controller = require('./supplier.controller');
const validators = require('./supplier.validation');

const router = express.Router();

router.get('/', validators.listSuppliersValidator, controller.listSuppliers);
router.post('/', validators.createSupplierValidator, controller.createSupplier);

module.exports = router;
