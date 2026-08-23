const assert = require('node:assert/strict');
const test = require('node:test');
const productController = require('./product.controller');
const productService = require('./product.service');

const originalSearchPublicProducts = productService.searchPublicProducts;
const originalListPublicCatalogueSuggestions = productService.listPublicCatalogueSuggestions;
const originalGetPublicInventoryBySku = productService.getPublicInventoryBySku;

test.afterEach(() => {
  productService.searchPublicProducts = originalSearchPublicProducts;
  productService.listPublicCatalogueSuggestions = originalListPublicCatalogueSuggestions;
  productService.getPublicInventoryBySku = originalGetPublicInventoryBySku;
});

function invoke(handler, req = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, body });
      }
    };

    handler(req, res, reject);
  });
}

function productWithAdminPrice(overrides = {}) {
  return {
    id: 91,
    name: 'Mainboard ASUS B760M',
    condition: 'new',
    category_name: 'Mainboard',
    spec_summary: 'DDR4',
    sale_price: 2500000,
    total_quantity: 4,
    image_count: 0,
    primary_image_id: null,
    ...overrides
  };
}

test('public product search and suggestions never serialize an internal selling price', async () => {
  const pricedProduct = productWithAdminPrice();
  productService.searchPublicProducts = async () => ({
    items: [pricedProduct],
    page: 1,
    limit: 20,
    total: 1,
    hasHiddenOutOfStockMatches: false,
    searchMode: 'fuzzy_contains'
  });
  productService.listPublicCatalogueSuggestions = async () => ({
    items: [pricedProduct],
    limit: 6,
    excludedCount: 0
  });

  const searchResponse = await invoke(productController.searchPublicProducts, { query: { q: 'asus' } });
  const suggestionsResponse = await invoke(productController.listPublicCatalogueSuggestions, { query: {} });

  assert.equal(pricedProduct.sale_price, 2500000);
  assert.equal('sale_price' in searchResponse.body.data[0], false);
  assert.equal('sale_price' in suggestionsResponse.body.data[0], false);
});

test('public SKU inventory never serializes a selling price from its product DTO', async () => {
  productService.getPublicInventoryBySku = async () => ({
    product: productWithAdminPrice({ spec_summary: undefined }),
    note_groups: []
  });

  const response = await invoke(productController.getPublicInventoryBySku, {
    params: { sku: 'new.main.asus.b760m' }
  });

  assert.equal('sale_price' in response.body.data.product, false);
  assert.equal(response.body.data.note_groups.length, 0);
});
