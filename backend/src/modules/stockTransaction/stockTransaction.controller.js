const asyncHandler = require('../../utils/asyncHandler');
const stockTxService = require('./stockTransaction.service');

exports.stockIn = asyncHandler(async (req, res) => {
  const result = await stockTxService.stockIn({
    adminId: req.auth.adminId,
    sku: req.body.sku,
    batch_code: req.body.batch_code,
    quantity: req.body.quantity,
    note: req.body.note
  });

  res.status(201).json({ success: true, data: result, meta: { server_time: new Date().toISOString() } });
});

exports.stockOut = asyncHandler(async (req, res) => {
  const result = await stockTxService.stockOut({
    adminId: req.auth.adminId,
    sku: req.body.sku,
    batch_code: req.body.batch_code,
    quantity: req.body.quantity,
    note: req.body.note
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
