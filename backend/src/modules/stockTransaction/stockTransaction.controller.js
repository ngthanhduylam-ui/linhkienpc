const asyncHandler = require('../../utils/asyncHandler');
const stockTxService = require('./stockTransaction.service');

exports.stockIn = asyncHandler(async (req, res) => {
  const result = await stockTxService.stockIn({
    adminId: req.auth.adminId,
    sku: req.body.sku,
    quantity: req.body.quantity,
    supplierId: req.body.supplier_id,
    note: req.body.note
  });

  res.status(201).json({ success: true, data: result, meta: { server_time: new Date().toISOString() } });
});

exports.bulkStockIn = asyncHandler(async (req, res) => {
  const result = await stockTxService.bulkStockIn({
    adminId: req.auth.adminId,
    supplierId: req.body.supplier_id,
    items: req.body.items
  });

  res.status(201).json({ success: true, data: result, meta: { server_time: new Date().toISOString() } });
});

exports.stockOut = asyncHandler(async (req, res) => {
  const result = await stockTxService.stockOut({
    adminId: req.auth.adminId,
    sku: req.body.sku,
    quantity: req.body.quantity,
    customerId: req.body.customer_id,
    note: req.body.note,
    warrantyNote: req.body.warranty_note
  });

  res.status(201).json({ success: true, data: result, meta: { server_time: new Date().toISOString() } });
});

exports.bulkStockOut = asyncHandler(async (req, res) => {
  const result = await stockTxService.bulkStockOut({
    adminId: req.auth.adminId,
    customerId: req.body.customer_id,
    items: req.body.items
  });

  res.status(201).json({ success: true, data: result, meta: { server_time: new Date().toISOString() } });
});

exports.listTransactions = asyncHandler(async (req, res) => {
  const result = await stockTxService.listTransactions(req.query);
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
