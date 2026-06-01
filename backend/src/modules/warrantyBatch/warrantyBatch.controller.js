const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const batchService = require('./warrantyBatch.service');

function toId(value) {
  return Number(value);
}

exports.listBatchesByProduct = asyncHandler(async (req, res) => {
  const result = await batchService.listBatchesByProduct(toId(req.params.productId), req.query);
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

exports.createBatch = asyncHandler(async (req, res) => {
  const created = await batchService.createBatch(toId(req.params.productId), req.body);
  res.status(201).json({ success: true, data: created, meta: { server_time: new Date().toISOString() } });
});

exports.getBatchById = asyncHandler(async (req, res) => {
  const data = await batchService.getBatchById(toId(req.params.id));
  res.json({ success: true, data, meta: { server_time: new Date().toISOString() } });
});

exports.updateBatch = asyncHandler(async (req, res) => {
  if (Object.keys(req.body || {}).length === 0) {
    throw new AppError('Request body cannot be empty.', 400, 'VALIDATION_ERROR');
  }
  const updated = await batchService.updateBatch(toId(req.params.id), req.body);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});

exports.deactivateBatch = asyncHandler(async (req, res) => {
  const updated = await batchService.setBatchActive(toId(req.params.id), false);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});

exports.activateBatch = asyncHandler(async (req, res) => {
  const updated = await batchService.setBatchActive(toId(req.params.id), true);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});
