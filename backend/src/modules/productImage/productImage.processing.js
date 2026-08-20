const sharp = require('sharp');
const AppError = require('../../utils/AppError');

const MAX_INPUT_PIXELS = 20_000_000;

const ALLOWED_FORMATS = new Map([
  ['jpeg', { extension: 'jpg', mimeType: 'image/jpeg' }],
  ['png', { extension: 'png', mimeType: 'image/png' }],
  ['webp', { extension: 'webp', mimeType: 'image/webp' }]
]);

function validateImageMetadata(metadata) {
  const formatConfig = ALLOWED_FORMATS.get(metadata?.format);
  const width = Number(metadata?.width);
  const height = Number(metadata?.height);

  if (
    !formatConfig
    || !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width < 1
    || height < 1
  ) {
    throw new AppError('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.', 400, 'IMAGE_FORMAT_INVALID');
  }

  if (width > Math.floor(MAX_INPUT_PIXELS / height)) {
    throw new AppError(
      'Kích thước ảnh không được vượt quá 20.000.000 pixel.',
      400,
      'IMAGE_DIMENSIONS_TOO_LARGE'
    );
  }

  return { metadata, formatConfig };
}

async function inspectImage(sourceBuffer) {
  let metadata;
  try {
    metadata = await sharp(sourceBuffer, {
      failOn: 'error',
      limitInputPixels: false
    }).metadata();
  } catch (error) {
    throw new AppError('The uploaded file is not a readable image.', 400, 'IMAGE_DECODE_FAILED');
  }

  return validateImageMetadata(metadata);
}

function createThumbnailPipeline(sourceBuffer) {
  return sharp(sourceBuffer, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS
  })
    .rotate()
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 });
}

module.exports = {
  MAX_INPUT_PIXELS,
  createThumbnailPipeline,
  inspectImage,
  validateImageMetadata
};
