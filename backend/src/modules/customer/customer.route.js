const express = require('express');
const controller = require('./customer.controller');
const validators = require('./customer.validation');

const router = express.Router();

router.get('/', validators.listCustomersValidator, controller.listCustomers);
router.post('/', validators.createCustomerValidator, controller.createCustomer);
router.get('/:id', validators.idParamValidator, controller.getCustomerById);
router.patch('/:id', validators.updateCustomerValidator, controller.updateCustomer);
router.patch('/:id/deactivate', validators.idParamValidator, controller.deactivateCustomer);
router.patch('/:id/activate', validators.idParamValidator, controller.activateCustomer);
router.get('/:id/transactions', validators.listCustomerTransactionsValidator, controller.listCustomerTransactions);

module.exports = router;
