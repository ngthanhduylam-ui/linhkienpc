const express = require('express');
const controller = require('./skuCategoryRule.controller');
const validators = require('./skuCategoryRule.validation');

const router = express.Router();

router.get('/', controller.listRules);
router.post('/', controller.createRule);
router.patch('/:id', validators.idParamValidator, controller.updateRule);
router.delete('/:id', validators.idParamValidator, controller.deleteRule);

module.exports = router;
