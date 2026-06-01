const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const categoryService = require('./category.service');

function toId(value) {
  return Number(value);
}

exports.listCategories = asyncHandler(async (req, res) => {
  const result = await categoryService.listCategories(req.query);
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

exports.getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(toId(req.params.id));
  res.json({ success: true, data: category, meta: { server_time: new Date().toISOString() } });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const created = await categoryService.createCategory(req.body);
  res.status(201).json({ success: true, data: created, meta: { server_time: new Date().toISOString() } });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  if (Object.keys(req.body || {}).length === 0) {
    throw new AppError('Request body cannot be empty.', 400, 'VALIDATION_ERROR');
  }
  const updated = await categoryService.updateCategory(toId(req.params.id), req.body);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});

exports.deactivateCategory = asyncHandler(async (req, res) => {
  const updated = await categoryService.setCategoryActive(toId(req.params.id), false);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});

exports.activateCategory = asyncHandler(async (req, res) => {
  const updated = await categoryService.setCategoryActive(toId(req.params.id), true);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});
