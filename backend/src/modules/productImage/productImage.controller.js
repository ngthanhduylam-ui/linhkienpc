const path = require('path');
const asyncHandler = require('../../utils/asyncHandler');
const productImageService = require('./productImage.service');
const storage = require('./productImage.storage');

function toId(value) {
  return Number(value);
}

function adminImageResponse(productId, image) {
  return {
    ...image,
    thumbnail_url: `/api/v1/admin/products/${productId}/images/${image.id}/thumbnail`,
    download_url: `/api/v1/admin/products/${productId}/images/${image.id}/download`
  };
}

function publicImageResponse(sku, image) {
  const encodedSku = encodeURIComponent(sku);
  return {
    id: image.id,
    original_name: image.original_name,
    mime_type: image.mime_type,
    file_size: image.file_size,
    sort_order: image.sort_order,
    thumbnail_url: `/api/v1/public/products/${encodedSku}/images/${image.id}/thumbnail`,
    download_url: `/api/v1/public/products/${encodedSku}/images/${image.id}/download`
  };
}

exports.listAdminImages = asyncHandler(async (req, res) => {
  const productId = toId(req.params.id);
  const images = await productImageService.listByProductId(productId);
  res.json({ success: true, data: images.map((image) => adminImageResponse(productId, image)) });
});

exports.uploadAdminImages = asyncHandler(async (req, res) => {
  const productId = toId(req.params.id);
  const images = await productImageService.uploadImages(productId, req.files);
  res.status(201).json({ success: true, data: images.map((image) => adminImageResponse(productId, image)) });
});

exports.replaceAdminImage = asyncHandler(async (req, res) => {
  const productId = toId(req.params.id);
  const images = await productImageService.replaceImage(productId, toId(req.params.imageId), req.files);
  res.json({ success: true, data: images.map((image) => adminImageResponse(productId, image)) });
});

exports.reorderAdminImages = asyncHandler(async (req, res) => {
  const productId = toId(req.params.id);
  const images = await productImageService.reorderImages(productId, req.body?.image_ids);
  res.json({ success: true, data: images.map((image) => adminImageResponse(productId, image)) });
});

exports.deleteAdminImage = asyncHandler(async (req, res) => {
  await productImageService.deleteImage(toId(req.params.id), toId(req.params.imageId));
  res.json({ success: true, data: { deleted: true } });
});

exports.getAdminThumbnail = asyncHandler(async (req, res) => {
  const image = await productImageService.getStoredImage(toId(req.params.id), toId(req.params.imageId));
  res.type('image/webp').sendFile(storage.resolveStoredPath(image.thumbnail_path));
});

exports.downloadAdminImage = asyncHandler(async (req, res) => {
  const image = await productImageService.getStoredImage(toId(req.params.id), toId(req.params.imageId));
  res.download(storage.resolveStoredPath(image.original_path), path.basename(image.original_name));
});

exports.listPublicImages = asyncHandler(async (req, res) => {
  const result = await productImageService.listPublicBySku(req.params.sku);
  res.json({
    success: true,
    data: {
      product: result.product,
      images: result.images.map((image) => publicImageResponse(result.product.sku, image))
    }
  });
});

exports.getPublicThumbnail = asyncHandler(async (req, res) => {
  const image = await productImageService.getStoredImage(null, toId(req.params.imageId), { sku: req.params.sku });
  res.type('image/webp').sendFile(storage.resolveStoredPath(image.thumbnail_path));
});

exports.downloadPublicImage = asyncHandler(async (req, res) => {
  const image = await productImageService.getStoredImage(null, toId(req.params.imageId), { sku: req.params.sku });
  res.download(storage.resolveStoredPath(image.original_path), path.basename(image.original_name));
});
