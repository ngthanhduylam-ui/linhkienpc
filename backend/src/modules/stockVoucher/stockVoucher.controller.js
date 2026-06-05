const asyncHandler = require('../../utils/asyncHandler');
const stockVoucherService = require('./stockVoucher.service');

exports.listStockVouchers = asyncHandler(async (req, res) => {
  const result = await stockVoucherService.listStockVouchers(req.query);
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

exports.getStockVoucherById = asyncHandler(async (req, res) => {
  const result = await stockVoucherService.getStockVoucherById(req.params.id);
  res.json({
    success: true,
    data: result,
    meta: {
      server_time: new Date().toISOString()
    }
  });
});
