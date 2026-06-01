const express = require('express');
const controller = require('./category.controller');
const validators = require('./category.validation');

const router = express.Router();

router.get('/', controller.listCategories);
router.post('/', validators.createCategoryValidator, controller.createCategory);
router.get('/:id', validators.idParamValidator, controller.getCategoryById);
router.patch('/:id', validators.updateCategoryValidator, controller.updateCategory);
router.patch('/:id/deactivate', validators.idParamValidator, controller.deactivateCategory);
router.patch('/:id/activate', validators.idParamValidator, controller.activateCategory);

module.exports = router;
