const asyncHandler = require('../../utils/asyncHandler');
const customerService = require('./customer.service');

exports.listCustomers = asyncHandler(async (req, res) => {
  const customers = await customerService.listCustomers(req.query);
  res.json({
    success: true,
    data: customers,
    meta: { server_time: new Date().toISOString() }
  });
});

exports.createCustomer = asyncHandler(async (req, res) => {
  const created = await customerService.createCustomer(req.body);
  res.status(201).json({
    success: true,
    data: created,
    meta: { server_time: new Date().toISOString() }
  });
});
