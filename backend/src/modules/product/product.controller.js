const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const productService = require('./product.service');

function toId(value) {
  return Number(value);
}

exports.listAdminProducts = asyncHandler(async (req, res) => {
  const result = await productService.listAdminProducts(req.query);
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

exports.getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(toId(req.params.id));
  res.json({ success: true, data: product, meta: { server_time: new Date().toISOString() } });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const created = await productService.createProduct(req.body);
  res.status(201).json({ success: true, data: created, meta: { server_time: new Date().toISOString() } });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  if (Object.keys(req.body || {}).length === 0) {
    throw new AppError('Request body cannot be empty.', 400, 'VALIDATION_ERROR');
  }
  const updated = await productService.updateProduct(toId(req.params.id), req.body);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});

exports.deactivateProduct = asyncHandler(async (req, res) => {
  const updated = await productService.setProductActive(toId(req.params.id), false);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});

exports.activateProduct = asyncHandler(async (req, res) => {
  const updated = await productService.setProductActive(toId(req.params.id), true);
  res.json({ success: true, data: updated, meta: { server_time: new Date().toISOString() } });
});

exports.searchPublicProducts = asyncHandler(async (req, res) => {
  const result = await productService.searchPublicProducts(req.query);
  res.json({
    success: true,
    data: result.items,
    meta: {
      q: (req.query.q || '').trim(),
      search_mode: result.searchMode,
      page: result.page,
      limit: result.limit,
      total: result.total,
      server_time: new Date().toISOString()
    }
  });
});

exports.getPublicInventoryBySku = asyncHandler(async (req, res) => {
  const data = await productService.getPublicInventoryBySku(req.params.sku);
  res.json({ success: true, data, meta: { server_time: new Date().toISOString() } });
});
