const asyncHandler = require('../../utils/asyncHandler');
const inventoryCheckService = require('./inventoryCheck.service');

exports.searchProducts = asyncHandler(async (req, res) => {
  const result = await inventoryCheckService.searchProducts(req.query);
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

exports.getProduct = asyncHandler(async (req, res) => {
  const result = await inventoryCheckService.getProductInventoryCheckBySku(req.params.sku);
  res.json({
    success: true,
    data: result,
    meta: { server_time: new Date().toISOString() }
  });
});

exports.moveNote = asyncHandler(async (req, res) => {
  const result = await inventoryCheckService.moveNote({
    adminId: req.auth.adminId,
    sku: req.body.sku,
    fromNote: req.body.from_note,
    toNote: req.body.to_note,
    quantity: req.body.quantity,
    reason: req.body.reason
  });

  res.status(201).json({
    success: true,
    data: result,
    meta: { server_time: new Date().toISOString() }
  });
});
