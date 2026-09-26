const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '../../../..');
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

test('migration 028 widens only the existing named CHECK and canonical schema agrees', () => {
  const previous = read('database/migrations/022_expand_product_image_limit_to_5.sql');
  const migration = read('database/migrations/028_expand_product_image_limit_to_6.sql');
  const schema = read('database/schema/product_images.sql');
  assert.match(previous, /CHECK \(sort_order BETWEEN 1 AND 5\)/);
  assert.equal(migration.replace(/\s+/g, ' ').trim(),
    'ALTER TABLE product_images DROP CHECK chk_product_images_sort_order, ADD CONSTRAINT chk_product_images_sort_order CHECK (sort_order BETWEEN 1 AND 6);');
  assert.match(schema, /CONSTRAINT chk_product_images_sort_order CHECK \(sort_order BETWEEN 1 AND 6\)/);
  assert.match(schema, /UNIQUE KEY uk_product_images_product_sort \(product_id, sort_order\)/);
  // Same MySQL DROP CHECK syntax as the historical migration, no data rewrite.
  assert.match(previous, /DROP CHECK chk_product_images_sort_order/);
  assert.doesNotMatch(migration, /\b(INSERT|UPDATE|DELETE)\b/i);
});

test('backend image count defaults to six, caps overrides at six, and keeps lower configured limits', () => {
  const configFile = path.join(repoRoot, 'backend/src/config/env.js');
  for (const [override, expected] of [[undefined, 6], ['invalid', 6], ['7', 6], ['5', 5]]) {
    const context = {
      module: { exports: {} },
      __dirname: path.dirname(configFile),
      require: (name) => {
        if (name === 'path') return path;
        if (name === 'dotenv') return { config() {} };
        throw new Error(`Unexpected import ${name}`);
      },
      process: { env: {
        PORT: '3000', DB_HOST: 'localhost', DB_PORT: '3306', DB_NAME: 'fixture', DB_USER: 'fixture',
        JWT_ACCESS_SECRET: 'test-only', JWT_REFRESH_SECRET: 'test-only',
        ...(override === undefined ? {} : { PRODUCT_IMAGE_MAX_COUNT: override })
      } }
    };
    vm.runInNewContext(fs.readFileSync(configFile, 'utf8'), context, { filename: configFile });
    assert.equal(context.module.exports.productUploads.maxImages, expected);
    assert.equal(context.module.exports.productUploads.maxFileBytes, 15 * 1024 * 1024);
  }
});
