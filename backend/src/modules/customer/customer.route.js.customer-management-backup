const express = require('express');
const controller = require('./customer.controller');
const validators = require('./customer.validation');

const router = express.Router();

router.get('/', validators.listCustomersValidator, controller.listCustomers);
router.post('/', validators.createCustomerValidator, controller.createCustomer);

module.exports = router;
