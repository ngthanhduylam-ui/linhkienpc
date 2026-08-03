const express = require('express');
const controller = require('./printTemplateSetting.controller');

const router = express.Router();

router.get('/sale-delivery-note', controller.getSettings);
router.put('/sale-delivery-note', controller.saveCustomTemplate);
router.patch('/sale-delivery-note', controller.changeActiveTemplate);

module.exports = router;
