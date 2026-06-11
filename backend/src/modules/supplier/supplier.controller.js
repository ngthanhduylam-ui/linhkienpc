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

exports.updateSupplier = asyncHandler(async (req, res) => {
  const updated = await supplierService.updateSupplier(Number(req.params.id), req.body);
  res.json({
    success: true,
    data: updated,
    meta: { server_time: new Date().toISOString() }
  });
});

exports.deactivateSupplier = asyncHandler(async (req, res) => {
  const updated = await supplierService.setSupplierActive(Number(req.params.id), false);
  res.json({
    success: true,
    data: updated,
    meta: { server_time: new Date().toISOString() }
  });
});

exports.activateSupplier = asyncHandler(async (req, res) => {
  const updated = await supplierService.setSupplierActive(Number(req.params.id), true);
  res.json({
    success: true,
    data: updated,
    meta: { server_time: new Date().toISOString() }
  });
});
