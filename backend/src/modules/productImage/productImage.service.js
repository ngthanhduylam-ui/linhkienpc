const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { pool } = require('../../config/database');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const storage = require('./productImage.storage');

const ALLOWED_FORMATS = new Map([
  ['jpeg', { extension: 'jpg', mimeType: 'image/jpeg' }],
  ['png', { extension: 'png', mimeType: 'image/png' }],
  ['webp', { extension: 'webp', mimeType: 'image/webp' }]
]);

function sanitizeOriginalName(value) {
  const baseName = path.basename(String(value || 'image'));
  const cleaned = baseName.replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, '_').trim();
  return (cleaned || 'image').slice(0, 255);
}

function mapImage(row) {
  return {
    id: Number(row.id),
    product_id: Number(row.product_id),
    original_name: row.original_name,
    mime_type: row.mime_type,
    file_size: Number(row.file_size),
    sort_order: Number(row.sort_order),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function ensureProduct(productId, { activeOnly = false, connection = pool, lock = false } = {}) {
  const whereActive = activeOnly ? ' AND is_active = 1' : '';
  const lockSql = lock ? ' FOR UPDATE' : '';
  const [rows] = await connection.query(
    `SELECT id, sku, name, is_active FROM products WHERE id = ?${whereActive} LIMIT 1${lockSql}`,
    [productId]
  );
  if (!rows.length) {
    throw new AppError('Product not found.', 404, 'RESOURCE_NOT_FOUND');
  }
  return rows[0];
}

async function getActiveProductBySku(sku) {
  const [rows] = await pool.query(
    'SELECT id, sku, name FROM products WHERE sku = ? AND is_active = 1 LIMIT 1',
    [sku]
  );
  if (!rows.length) {
    throw new AppError('SKU not found.', 404, 'SKU_NOT_FOUND');
  }
  return rows[0];
}

async function listByProductId(productId) {
  await ensureProduct(productId);
  const [rows] = await pool.query(
    `SELECT id, product_id, original_name, mime_type, file_size, sort_order, created_at, updated_at
     FROM product_images
     WHERE product_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [productId]
  );
  return rows.map(mapImage);
}

async function listPublicBySku(sku) {
  const product = await getActiveProductBySku(sku);
  const [rows] = await pool.query(
    `SELECT id, product_id, original_name, mime_type, file_size, sort_order, created_at, updated_at
     FROM product_images
     WHERE product_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [product.id]
  );
  return {
    product: { sku: product.sku, name: product.name },
    images: rows.map(mapImage)
  };
}

async function prepareImage(file) {
  const createdPaths = [];
  try {
    const sourceBuffer = await fs.readFile(file.path);
    const metadata = await sharp(sourceBuffer, { failOn: 'error' }).metadata();
    const formatConfig = ALLOWED_FORMATS.get(metadata.format);
    if (!formatConfig || !metadata.width || !metadata.height) {
      throw new AppError('Only valid JPEG, PNG, or WebP images are accepted.', 400, 'IMAGE_FORMAT_INVALID');
    }

    const id = crypto.randomUUID();
    const originalName = `${id}.${formatConfig.extension}`;
    const thumbnailName = `${id}.webp`;
    const originalAbsolutePath = path.join(storage.originalsDir, originalName);
    const thumbnailAbsolutePath = path.join(storage.thumbnailsDir, thumbnailName);

    await fs.copyFile(file.path, originalAbsolutePath);
    createdPaths.push(originalAbsolutePath);

    await sharp(sourceBuffer, { failOn: 'error' })
      .rotate()
      .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbnailAbsolutePath);
    createdPaths.push(thumbnailAbsolutePath);
    await storage.removeFile(file.path);

    return {
      original_path: storage.getRelativePath('originals', originalName),
      thumbnail_path: storage.getRelativePath('thumbnails', thumbnailName),
      original_name: sanitizeOriginalName(file.originalname),
      mime_type: formatConfig.mimeType,
      file_size: Number(file.size),
      createdPaths
    };
  } catch (error) {
    await storage.removeFiles([file.path, ...createdPaths]);
    if (error instanceof AppError) throw error;
    throw new AppError('The uploaded file is not a readable image.', 400, 'IMAGE_DECODE_FAILED');
  }
}

async function uploadImages(productId, files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError('At least one image is required.', 400, 'IMAGE_REQUIRED');
  }
  if (files.some((file) => Number(file.size) > env.productUploads.maxFileBytes)) {
    await storage.removeFiles(files.map((file) => file.path));
    throw new AppError(
      `Each image must not exceed ${Math.floor(env.productUploads.maxFileBytes / 1024 / 1024)} MB.`,
      413,
      'IMAGE_FILE_TOO_LARGE'
    );
  }

  await storage.ensureUploadDirectories();
  const prepared = [];
  try {
    for (const file of files) {
      prepared.push(await prepareImage(file));
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await ensureProduct(productId, { connection, lock: true });
      const [countRows] = await connection.query(
        'SELECT COUNT(*) AS total FROM product_images WHERE product_id = ?',
        [productId]
      );
      const currentCount = Number(countRows[0].total || 0);
      if (currentCount + prepared.length > env.productUploads.maxImages) {
        throw new AppError(
          `A product can have at most ${env.productUploads.maxImages} images.`,
          400,
          'PRODUCT_IMAGE_LIMIT_EXCEEDED'
        );
      }

      const insertedIds = [];
      for (let index = 0; index < prepared.length; index += 1) {
        const image = prepared[index];
        const [result] = await connection.query(
          `INSERT INTO product_images
            (product_id, original_path, thumbnail_path, original_name, mime_type, file_size, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            image.original_path,
            image.thumbnail_path,
            image.original_name,
            image.mime_type,
            image.file_size,
            currentCount + index + 1
          ]
        );
        insertedIds.push(result.insertId);
      }
      await connection.commit();

      const [rows] = await pool.query(
        `SELECT id, product_id, original_name, mime_type, file_size, sort_order, created_at, updated_at
         FROM product_images WHERE id IN (?) ORDER BY sort_order ASC`,
        [insertedIds]
      );
      return rows.map(mapImage);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    await storage.removeFiles([
      ...files.map((file) => file.path),
      ...prepared.flatMap((image) => image.createdPaths)
    ]);
    throw error;
  }
}

async function replaceImage(productId, imageId, files) {
  if (!Array.isArray(files) || files.length !== 1) {
    await storage.removeFiles((files || []).map((file) => file.path));
    throw new AppError('Exactly one replacement image is required.', 400, 'IMAGE_REQUIRED');
  }
  if (Number(files[0].size) > env.productUploads.maxFileBytes) {
    await storage.removeFiles(files.map((file) => file.path));
    throw new AppError(
      `Each image must not exceed ${Math.floor(env.productUploads.maxFileBytes / 1024 / 1024)} MB.`,
      413,
      'IMAGE_FILE_TOO_LARGE'
    );
  }

  await storage.ensureUploadDirectories();
  const prepared = await prepareImage(files[0]);
  const connection = await pool.getConnection();
  let previousImage;
  try {
    await connection.beginTransaction();
    await ensureProduct(productId, { connection, lock: true });
    const [rows] = await connection.query(
      `SELECT id, original_path, thumbnail_path
       FROM product_images WHERE id = ? AND product_id = ? LIMIT 1 FOR UPDATE`,
      [imageId, productId]
    );
    if (!rows.length) {
      throw new AppError('Product image not found.', 404, 'RESOURCE_NOT_FOUND');
    }
    previousImage = rows[0];
    await connection.query(
      `UPDATE product_images
       SET original_path = ?, thumbnail_path = ?, original_name = ?, mime_type = ?, file_size = ?
       WHERE id = ? AND product_id = ?`,
      [
        prepared.original_path,
        prepared.thumbnail_path,
        prepared.original_name,
        prepared.mime_type,
        prepared.file_size,
        imageId,
        productId
      ]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    await storage.removeFiles(prepared.createdPaths);
    throw error;
  } finally {
    connection.release();
  }

  const cleanup = await storage.removeFiles([
    storage.resolveStoredPath(previousImage.original_path),
    storage.resolveStoredPath(previousImage.thumbnail_path)
  ]);
  if (cleanup.some((result) => result.status === 'rejected')) {
    console.warn('Product image replacement succeeded but old file cleanup was incomplete.');
  }
  return listByProductId(productId);
}

async function reorderImages(productId, imageIds) {
  if (!Array.isArray(imageIds) || imageIds.length === 0 || imageIds.length > env.productUploads.maxImages) {
    throw new AppError('image_ids must contain the complete ordered image list.', 400, 'VALIDATION_ERROR');
  }
  const normalizedIds = imageIds.map(Number);
  if (normalizedIds.some((id) => !Number.isInteger(id) || id < 1) || new Set(normalizedIds).size !== normalizedIds.length) {
    throw new AppError('image_ids must contain unique positive integers.', 400, 'VALIDATION_ERROR');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureProduct(productId, { connection, lock: true });
    const [rows] = await connection.query(
      `SELECT id, product_id, original_path, thumbnail_path, original_name, mime_type, file_size,
              sort_order, created_at, updated_at
       FROM product_images WHERE product_id = ? ORDER BY sort_order ASC FOR UPDATE`,
      [productId]
    );
    const existingIds = rows.map((row) => Number(row.id));
    if (
      existingIds.length !== normalizedIds.length ||
      existingIds.some((id) => !normalizedIds.includes(id))
    ) {
      throw new AppError('image_ids must contain every image belonging to this product.', 400, 'VALIDATION_ERROR');
    }

    await connection.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
    for (let index = 0; index < normalizedIds.length; index += 1) {
      const image = rows.find((row) => Number(row.id) === normalizedIds[index]);
      await connection.query(
        `INSERT INTO product_images
          (id, product_id, original_path, thumbnail_path, original_name, mime_type, file_size, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          image.id,
          image.product_id,
          image.original_path,
          image.thumbnail_path,
          image.original_name,
          image.mime_type,
          image.file_size,
          index + 1,
          image.created_at,
          image.updated_at
        ]
      );
    }
    await connection.commit();
    return listByProductId(productId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getStoredImage(productId, imageId, { activeOnly = false, sku = null } = {}) {
  let resolvedProductId = productId;
  if (sku !== null) {
    const product = await getActiveProductBySku(sku);
    resolvedProductId = product.id;
  } else {
    await ensureProduct(productId, { activeOnly });
  }

  const [rows] = await pool.query(
    `SELECT id, product_id, original_path, thumbnail_path, original_name, mime_type
     FROM product_images WHERE id = ? AND product_id = ? LIMIT 1`,
    [imageId, resolvedProductId]
  );
  if (!rows.length) {
    throw new AppError('Product image not found.', 404, 'RESOURCE_NOT_FOUND');
  }
  return rows[0];
}

async function deleteImage(productId, imageId) {
  const connection = await pool.getConnection();
  let deletedImage;
  try {
    await connection.beginTransaction();
    await ensureProduct(productId, { connection, lock: true });
    const [rows] = await connection.query(
      `SELECT id, product_id, original_path, thumbnail_path, original_name, mime_type, file_size,
              sort_order, created_at, updated_at
       FROM product_images WHERE product_id = ? ORDER BY sort_order ASC FOR UPDATE`,
      [productId]
    );
    const target = rows.find((row) => Number(row.id) === Number(imageId));
    if (!target) {
      throw new AppError('Product image not found.', 404, 'RESOURCE_NOT_FOUND');
    }
    deletedImage = target;
    const remaining = rows.filter((row) => Number(row.id) !== Number(imageId));
    await connection.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
    for (let index = 0; index < remaining.length; index += 1) {
      const image = remaining[index];
      await connection.query(
        `INSERT INTO product_images
          (id, product_id, original_path, thumbnail_path, original_name, mime_type, file_size, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          image.id,
          image.product_id,
          image.original_path,
          image.thumbnail_path,
          image.original_name,
          image.mime_type,
          image.file_size,
          index + 1,
          image.created_at,
          image.updated_at
        ]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const cleanup = await storage.removeFiles([
    storage.resolveStoredPath(deletedImage.original_path),
    storage.resolveStoredPath(deletedImage.thumbnail_path)
  ]);
  if (cleanup.some((result) => result.status === 'rejected')) {
    console.warn('Product image metadata was deleted but file cleanup was incomplete.');
  }
}

module.exports = {
  listByProductId,
  listPublicBySku,
  uploadImages,
  replaceImage,
  reorderImages,
  getStoredImage,
  deleteImage
};
