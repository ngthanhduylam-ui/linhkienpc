const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const productService = require('./product.service');

function toId(value) {
  return Number(value);
}

function withAdminImageSummary(product) {
  const primaryImageId = product.primary_image_id;
  const imageCount = product.image_count;
  const { primary_image_id, ...data } = product;
  return {
    ...data,
    image_count: imageCount,
    primary_image: primaryImageId
      ? {
          id: primaryImageId,
          thumbnail_url: `/api/v1/admin/products/${product.id}/images/${primaryImageId}/thumbnail`
        }
      : null
  };
}

function withPublicImageSummary(product) {
  const primaryImageId = product.primary_image_id;
  const { primary_image_id, ...data } = product;
  const encodedSku = encodeURIComponent(product.sku);
  return {
    ...data,
    primary_image: primaryImageId
      ? {
          id: primaryImageId,
          thumbnail_url: `/api/v1/public/products/${encodedSku}/images/${primaryImageId}/thumbnail`
        }
      : null
  };
}

exports.listAdminProducts = asyncHandler(async (req, res) => {
  const result = await productService.listAdminProducts(req.query);
  res.json({
    success: true,
    data: result.items.map(withAdminImageSummary),
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      total_pages: result.total_pages,
      server_time: new Date().toISOString()
    }
  });
});

exports.getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(toId(req.params.id));
  res.json({ success: true, data: withAdminImageSummary(product), meta: { server_time: new Date().toISOString() } });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const created = await productService.createProduct(req.body);
  res.status(201).json({ success: true, data: withAdminImageSummary(created), meta: { server_time: new Date().toISOString() } });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  if (Object.keys(req.body || {}).length === 0) {
    throw new AppError('Request body cannot be empty.', 400, 'VALIDATION_ERROR');
  }
  const updated = await productService.updateProduct(toId(req.params.id), req.body);
  res.json({ success: true, data: withAdminImageSummary(updated), meta: { server_time: new Date().toISOString() } });
});

exports.deactivateProduct = asyncHandler(async (req, res) => {
  const updated = await productService.setProductActive(toId(req.params.id), false);
  res.json({ success: true, data: withAdminImageSummary(updated), meta: { server_time: new Date().toISOString() } });
});

exports.activateProduct = asyncHandler(async (req, res) => {
  const updated = await productService.setProductActive(toId(req.params.id), true);
  res.json({ success: true, data: withAdminImageSummary(updated), meta: { server_time: new Date().toISOString() } });
});

exports.searchPublicProducts = asyncHandler(async (req, res) => {
  const result = await productService.searchPublicProducts(req.query);
  res.json({
    success: true,
    data: result.items.map(withPublicImageSummary),
    meta: {
      q: (req.query.q || '').trim(),
      search_mode: result.searchMode,
      page: result.page,
      limit: result.limit,
      total: result.total,
      has_hidden_out_of_stock_matches: result.hasHiddenOutOfStockMatches,
      server_time: new Date().toISOString()
    }
  });
});

exports.listPublicCatalogueSuggestions = asyncHandler(async (req, res) => {
  const result = await productService.listPublicCatalogueSuggestions(req.query);
  res.json({
    success: true,
    data: result.items.map(withPublicImageSummary),
    meta: {
      limit: result.limit,
      count: result.items.length,
      excluded_count: result.excludedCount,
      server_time: new Date().toISOString()
    }
  });
});

exports.getPublicInventoryBySku = asyncHandler(async (req, res) => {
  const data = await productService.getPublicInventoryBySku(req.params.sku);
  res.json({
    success: true,
    data: {
      ...data,
      product: withPublicImageSummary(data.product)
    },
    meta: { server_time: new Date().toISOString() }
  });
});
