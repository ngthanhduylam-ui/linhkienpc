const express = require('express');
const controller = require('./product.controller');
const validators = require('./product.validation');

const router = express.Router();

router.get('/', controller.listAdminProducts);
router.post('/', validators.createProductValidator, controller.createProduct);
router.get('/:id', validators.idParamValidator, controller.getProductById);
router.patch('/:id', validators.updateProductValidator, controller.updateProduct);
router.patch('/:id/deactivate', validators.idParamValidator, controller.deactivateProduct);
router.patch('/:id/activate', validators.idParamValidator, controller.activateProduct);

module.exports = router;
