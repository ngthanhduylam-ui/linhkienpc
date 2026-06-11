const express = require('express');
const controller = require('./supplier.controller');
const validators = require('./supplier.validation');

const router = express.Router();

router.get('/', validators.listSuppliersValidator, controller.listSuppliers);
router.post('/', validators.createSupplierValidator, controller.createSupplier);
router.patch('/:id', validators.updateSupplierValidator, controller.updateSupplier);
router.patch('/:id/deactivate', validators.idParamValidator, controller.deactivateSupplier);
router.patch('/:id/activate', validators.idParamValidator, controller.activateSupplier);

module.exports = router;
