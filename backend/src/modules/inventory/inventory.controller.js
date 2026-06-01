const asyncHandler = require('../../utils/asyncHandler');
const inventoryService = require('./inventory.service');

exports.getInventoryOverview = asyncHandler(async (req, res) => {
  const result = await inventoryService.getInventoryOverview(req.query);
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
