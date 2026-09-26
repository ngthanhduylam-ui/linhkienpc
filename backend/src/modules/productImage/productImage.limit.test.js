const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const sharp = require('sharp');

// Isolated test process: use the new cap and existing 15 MB protection.
process.env.PRODUCT_IMAGE_MAX_COUNT = '6';
process.env.PRODUCT_IMAGE_MAX_BYTES = String(15 * 1024 * 1024);
const env = require('../../config/env');
const { pool } = require('../../config/database');
const originalQuery = pool.query;
const originalGetConnection = pool.getConnection;
let root, storage, service, upload, png;
let rows, nextId, commits, rollbacks;

async function query(sql, params = []) {
  if (/FROM products p/.test(sql)) return [[{ id: 1, sku: 'test.laptop', name: 'Test laptop', is_active: 1 }]];
  if (/SELECT COUNT\(\*\)/.test(sql)) return [[{ total: rows.length }]];
  if (/^DELETE FROM product_images/.test(sql)) { rows = []; return [{}]; }
  if (/INSERT INTO product_images/.test(sql)) {
    const preservesId = /\(id, product_id/.test(sql);
    const fields = preservesId
      ? ['id', 'product_id', 'original_path', 'thumbnail_path', 'original_name', 'mime_type', 'file_size', 'sort_order', 'created_at', 'updated_at']
      : ['product_id', 'original_path', 'thumbnail_path', 'original_name', 'mime_type', 'file_size', 'sort_order'];
    const row = Object.fromEntries(fields.map((field, index) => [field, params[index]]));
    if (!preservesId) row.id = nextId++;
    // Mirror the canonical CHECK/unique constraint in the DB fixture.
    assert.ok(row.sort_order >= 1 && row.sort_order <= 6);
    assert.ok(!rows.some((existing) => existing.sort_order === row.sort_order));
    rows.push(row);
    return [{ insertId: row.id }];
  }
  if (/FROM product_images/.test(sql)) {
    const selected = /WHERE id IN/.test(sql) ? rows.filter((row) => params[0].includes(row.id)) : rows;
    return [selected.map((row) => ({ ...row })).sort((a, b) => a.sort_order - b.sort_order)];
  }
  throw new Error(`Unexpected fixture query: ${sql}`);
}

test.before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-image-limit-'));
  env.productUploads.root = root;
  storage = require('./productImage.storage');
  service = require('./productImage.service');
  upload = require('./productImage.upload');
  pool.query = query;
  pool.getConnection = async () => {
    let snapshot;
    return {
      query,
      async beginTransaction() { snapshot = rows.map((row) => ({ ...row })); },
      async commit() { commits++; },
      async rollback() { rows = snapshot; rollbacks++; },
      release() {}
    };
  };
  png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#123456' } }).png().toBuffer();
});

test.beforeEach(async () => {
  rows = [];
  nextId = 1;
  commits = 0;
  rollbacks = 0;
  await storage.ensureUploadDirectories();
});

test.afterEach(async () => {
  // Only files generated inside this test's private temporary directory.
  for (const dir of [storage.tempDir, storage.originalsDir, storage.thumbnailsDir]) {
    for (const file of await fs.readdir(dir)) await fs.unlink(path.join(dir, file));
  }
});

test.after(async () => {
  pool.query = originalQuery;
  pool.getConnection = originalGetConnection;
  if (root) await fs.rm(root, { recursive: true, force: true });
});

function seed(count) {
  rows = Array.from({ length: count }, (_, index) => ({
    id: index + 1, product_id: 1, sort_order: index + 1,
    original_path: `originals/fixture-${index}.png`, thumbnail_path: `thumbnails/fixture-${index}.webp`,
    original_name: `${index}.png`, mime_type: 'image/png', file_size: 100
  }));
  nextId = count + 1;
}

async function files(count, buffer = png) {
  return Promise.all(Array.from({ length: count }, async (_, index) => {
    const filePath = path.join(storage.tempDir, `input-${index}.upload`);
    await fs.writeFile(filePath, buffer);
    return { path: filePath, originalname: `${index}.png`, size: buffer.length };
  }));
}

const errorCode = (code) => (error) => error.statusCode === 400 && error.code === code;

for (const [existing, incoming, allowed] of [[0, 6, true], [0, 7, false], [5, 1, true], [5, 2, false], [6, 1, false]]) {
  test(`${existing} existing + ${incoming} uploads => ${allowed ? 'accepted' : 'rejected'}`, async () => {
    seed(existing);
    const pending = service.uploadImages(1, await files(incoming));
    if (allowed) {
      const added = await pending;
      assert.equal(added.length, incoming);
      assert.equal(rows.length, 6);
      assert.equal(rows.at(-1).sort_order, 6);
      assert.equal(commits, 1);
      for (const row of rows.slice(existing)) {
        const thumbnail = await sharp(await fs.readFile(storage.resolveStoredPath(row.thumbnail_path))).metadata();
        assert.equal(thumbnail.format, 'webp');
        assert.ok(thumbnail.width <= 720 && thumbnail.height <= 720);
      }
    } else {
      await assert.rejects(pending, errorCode('PRODUCT_IMAGE_LIMIT_EXCEEDED'));
      assert.equal(rows.length, existing);
      assert.equal(commits, 0);
      assert.equal(rollbacks, 1);
      assert.deepEqual(await fs.readdir(storage.originalsDir), []);
      assert.deepEqual(await fs.readdir(storage.thumbnailsDir), []);
    }
    assert.deepEqual(await fs.readdir(storage.tempDir), []);
  });
}

test('reorder writes positions 1..6 and keeps the chosen primary image', async () => {
  seed(6);
  const reordered = await service.reorderImages(1, [6, 5, 4, 3, 2, 1]);
  assert.deepEqual(reordered.map((image) => image.id), [6, 5, 4, 3, 2, 1]);
  assert.deepEqual(reordered.map((image) => image.sort_order), [1, 2, 3, 4, 5, 6]);
  assert.equal(commits, 1);
});

test('reorder rejects a seventh position without modifying existing rows', async () => {
  seed(6);
  await assert.rejects(service.reorderImages(1, [1, 2, 3, 4, 5, 6, 7]), errorCode('VALIDATION_ERROR'));
  assert.equal(rows.length, 6);
  assert.equal(commits, 0);
});

test('delete from six compacts ordering and frees one upload slot', async () => {
  await service.uploadImages(1, await files(6));
  await service.deleteImage(1, 3);
  assert.deepEqual(rows.map((row) => row.sort_order), [1, 2, 3, 4, 5]);
  const added = await service.uploadImages(1, await files(1));
  assert.equal(rows.length, 6);
  assert.equal(added[0].sort_order, 6);
});

test('public image lists return all six images in order by both SKU and product ID', async () => {
  seed(6);
  for (const result of [await service.listPublicBySku('test.laptop'), await service.listPublicByProductId(1)]) {
    assert.equal(result.images.length, 6);
    assert.deepEqual(result.images.map((image) => image.sort_order), [1, 2, 3, 4, 5, 6]);
  }
});

async function multipart(count, buffer = png) {
  const boundary = 'product-image-limit-test-boundary';
  const parts = [];
  for (let index = 0; index < count; index++) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${index}.png"\r\nContent-Type: image/png\r\n\r\n`), buffer, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  const req = Readable.from([body]);
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) };
  return new Promise((resolve, reject) => upload(req, {}, (error) => error ? reject(error) : resolve(req.files)));
}

test('real Multer multipart middleware accepts six files and rejects seven with the standard code', async () => {
  const accepted = await multipart(6);
  assert.equal(accepted.length, 6);
  await storage.removeFiles(accepted.map((file) => file.path));
  await assert.rejects(multipart(7), errorCode('PRODUCT_IMAGE_LIMIT_EXCEEDED'));
  assert.deepEqual(await fs.readdir(storage.tempDir), []);
});

test('15 MB limit remains enforced by middleware and service', async () => {
  assert.equal(env.productUploads.maxFileBytes, 15 * 1024 * 1024);
  await assert.rejects(multipart(1, Buffer.alloc(env.productUploads.maxFileBytes + 2)), errorCode('IMAGE_FILE_TOO_LARGE'));
  const incoming = await files(1);
  incoming[0].size = env.productUploads.maxFileBytes + 1;
  await assert.rejects(service.uploadImages(1, incoming), errorCode('IMAGE_FILE_TOO_LARGE'));
  assert.equal(rows.length, 0);
});

test('upload still rejects invalid bytes and unsupported image formats', async () => {
  await assert.rejects(service.uploadImages(1, await files(1, Buffer.from('invalid'))), errorCode('IMAGE_DECODE_FAILED'));
  const gif = await sharp(png).gif().toBuffer();
  await assert.rejects(service.uploadImages(1, await files(1, gif)), errorCode('IMAGE_FORMAT_INVALID'));
  assert.equal(rows.length, 0);
});
