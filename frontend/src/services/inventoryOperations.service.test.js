import assert from "node:assert/strict";
import test from "node:test";
import { listProductsPage, searchActiveProducts } from "./inventoryOperations.service.js";

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test("POS search requests positive stock before the server result window and preserves item data", async () => {
  let requestUrl;
  const product = {
    id: 1, sku: "2nd.lcd.aoc.24g2", name: 'AOC 24"', total_quantity: 1,
    sale_price: 1500000, note_groups: [{ note: "BH 3 tháng", quantity: 1 }]
  };
  globalThis.fetch = async (url) => {
    requestUrl = new URL(url);
    return new Response(JSON.stringify({ success: true, data: [product] }));
  };
  assert.deepEqual(await searchActiveProducts(' 24" aoc '), [product]);
  assert.equal(requestUrl.pathname, "/api/v1/admin/products");
  assert.deepEqual(Object.fromEntries(requestUrl.searchParams), {
    page: "1", limit: "12", q: '24" aoc', is_active: "true", in_stock: "true"
  });
});

test("Admin listing does not opt into the POS stock filter and retains zero-stock items", async () => {
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).searchParams.has("in_stock"), false);
    return new Response(JSON.stringify({ success: true, data: [{ id: 1, total_quantity: 0 }] }));
  };
  assert.deepEqual((await listProductsPage({ keyword: '24"' })).items, [{ id: 1, total_quantity: 0 }]);
});

test("empty POS query makes no API request", async () => {
  globalThis.fetch = async () => { throw new Error("Unexpected request"); };
  assert.deepEqual(await searchActiveProducts("   "), []);
});

test("Admin listing serializes explicit all/true/false and preserves missing status and pagination metadata", async () => {
  let requestUrl;
  const meta = { page: 2, limit: 20, total: 42, total_pages: 3 };
  globalThis.fetch = async (url) => {
    requestUrl = new URL(url);
    return new Response(JSON.stringify({ success: true, data: [], meta }));
  };
  for (const status of [undefined, 'all', true, false]) {
    const result = await listProductsPage({ keyword: ' aoc 24 ', page: 2, limit: 20, is_active: status });
    assert.equal(requestUrl.searchParams.get('is_active'), status === undefined ? null : String(status));
    assert.equal(requestUrl.searchParams.get('q'), 'aoc 24');
    assert.equal(requestUrl.searchParams.get('page'), '2');
    assert.equal(requestUrl.searchParams.has('in_stock'), false);
    assert.deepEqual(result.meta, meta);
  }
});
