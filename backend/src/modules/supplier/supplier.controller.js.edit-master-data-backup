const asyncHandler = require('../../utils/asyncHandler');
const supplierService = require('./supplier.service');

exports.listSuppliers = asyncHandler(async (req, res) => {
  const result = await supplierService.listSuppliers(req.query);
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

exports.createSupplier = asyncHandler(async (req, res) => {
  const created = await supplierService.createSupplier(req.body);
  res.status(201).json({
    success: true,
    data: created,
    meta: { server_time: new Date().toISOString() }
  });
});
