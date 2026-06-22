const express = require('express');
const controller = require('./product.controller');
const validators = require('./product.validation');
const imageController = require('../productImage/productImage.controller');
const uploadProductImages = require('../productImage/productImage.upload');

const router = express.Router();

router.get('/', controller.listAdminProducts);
router.post('/', validators.createProductValidator, controller.createProduct);
router.get('/:id/images', validators.idParamValidator, imageController.listAdminImages);
router.post('/:id/images', validators.idParamValidator, uploadProductImages, imageController.uploadAdminImages);
router.patch('/:id/images/reorder', validators.idParamValidator, imageController.reorderAdminImages);
router.post('/:id/images/:imageId/replace', validators.idParamValidator, uploadProductImages, imageController.replaceAdminImage);
router.get('/:id/images/:imageId/thumbnail', validators.idParamValidator, imageController.getAdminThumbnail);
router.get('/:id/images/:imageId/download', validators.idParamValidator, imageController.downloadAdminImage);
router.delete('/:id/images/:imageId', validators.idParamValidator, imageController.deleteAdminImage);
router.get('/:id', validators.idParamValidator, controller.getProductById);
router.patch('/:id', validators.updateProductValidator, controller.updateProduct);
router.patch('/:id/deactivate', validators.idParamValidator, controller.deactivateProduct);
router.patch('/:id/activate', validators.idParamValidator, controller.activateProduct);

module.exports = router;
