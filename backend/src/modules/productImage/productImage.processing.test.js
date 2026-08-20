const assert = require('node:assert/strict');
const test = require('node:test');
const sharp = require('sharp');

const {
  MAX_INPUT_PIXELS,
  createThumbnailPipeline,
  inspectImage,
  validateImageMetadata
} = require('./productImage.processing');

function expectAppError(error, code) {
  return error?.statusCode === 400 && error?.code === code;
}

async function createImageBuffer(format) {
  return sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 20, g: 90, b: 180 }
    }
  })[format]().toBuffer();
}

test('accepts valid metadata below the 20 megapixel limit', () => {
  const result = validateImageMetadata({ format: 'jpeg', width: 3840, height: 2160 });

  assert.equal(result.metadata.width * result.metadata.height, 8_294_400);
  assert.equal(result.formatConfig.mimeType, 'image/jpeg');
});

test('accepts metadata exactly at the 20 megapixel boundary', () => {
  const result = validateImageMetadata({ format: 'png', width: 5000, height: 4000 });

  assert.equal(result.metadata.width * result.metadata.height, MAX_INPUT_PIXELS);
});

test('rejects metadata above 20 megapixels with a dedicated safe error', () => {
  assert.throws(
    () => validateImageMetadata({ format: 'webp', width: 5001, height: 4000 }),
    (error) => {
      assert.equal(error.message.includes('sharp'), false);
      return expectAppError(error, 'IMAGE_DIMENSIONS_TOO_LARGE');
    }
  );
});

test('keeps invalid image input mapped to IMAGE_DECODE_FAILED', async () => {
  await assert.rejects(
    inspectImage(Buffer.from('not an image')),
    (error) => expectAppError(error, 'IMAGE_DECODE_FAILED')
  );
});

for (const format of ['jpeg', 'png', 'webp']) {
  test(`keeps normal ${format.toUpperCase()} uploads and 720px thumbnail processing working`, async () => {
    const sourceBuffer = await createImageBuffer(format);
    const inspected = await inspectImage(sourceBuffer);
    const thumbnailBuffer = await createThumbnailPipeline(sourceBuffer).toBuffer();
    const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();

    assert.equal(inspected.metadata.format, format);
    assert.equal(inspected.metadata.width, 64);
    assert.equal(inspected.metadata.height, 48);
    assert.equal(thumbnailMetadata.format, 'webp');
    assert.ok(thumbnailMetadata.width <= 720);
    assert.ok(thumbnailMetadata.height <= 720);
  });
}
