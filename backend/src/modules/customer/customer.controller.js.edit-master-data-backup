const asyncHandler = require('../../utils/asyncHandler');
const customerService = require('./customer.service');

function toId(value) {
  return Number(value);
}

exports.listCustomers = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomers(req.query);
  res.json({
    success: true,
    data: result.items,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      server_time: new Date().toISOString()
    }
  });
});

exports.getCustomerById = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(toId(req.params.id));
  res.json({
    success: true,
    data: customer,
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

exports.listCustomerTransactions = asyncHandler(async (req, res) => {
  const result = await customerService.listCustomerTransactions(toId(req.params.id), req.query);
  res.json({
    success: true,
    data: result.items,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      server_time: new Date().toISOString()
    }
  });
});
