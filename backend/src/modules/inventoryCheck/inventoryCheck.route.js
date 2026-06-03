const express = require('express');
const controller = require('./inventoryCheck.controller');
const validators = require('./inventoryCheck.validation');

const router = express.Router();

router.get('/products', controller.searchProducts);
router.get('/products/:sku', validators.skuParamValidator, controller.getProduct);
router.post('/note-move', validators.moveNoteValidator, controller.moveNote);

module.exports = router;
