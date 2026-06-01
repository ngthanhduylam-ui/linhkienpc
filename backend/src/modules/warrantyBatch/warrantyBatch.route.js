const express = require('express');
const controller = require('./warrantyBatch.controller');
const validators = require('./warrantyBatch.validation');

const router = express.Router();

router.get('/products/:productId/batches', validators.productIdValidator, controller.listBatchesByProduct);
router.post('/products/:productId/batches', validators.createBatchValidator, controller.createBatch);
router.get('/batches/:id', validators.batchIdValidator, controller.getBatchById);
router.patch('/batches/:id', validators.updateBatchValidator, controller.updateBatch);
router.patch('/batches/:id/deactivate', validators.batchIdValidator, controller.deactivateBatch);
router.patch('/batches/:id/activate', validators.batchIdValidator, controller.activateBatch);

module.exports = router;
