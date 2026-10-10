import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createProductRequest, getProductRequest, updateProductRequest } from "../services/inventoryOperations.service.js";

const source = readFileSync(new URL("./ProductFormPage.jsx", import.meta.url), "utf8");
const handler = source.match(/^  async function handleSubmit\(event\) \{[\s\S]*?^  \}/m)?.[0];
assert.ok(handler, "product form submit handler exists");
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function mockProductApi() {
  let product = null;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ path, method: options.method, body });
    if (path === "/api/v1/admin/products" && options.method === "POST") product = { id: 42, ...body };
    else if (path === "/api/v1/admin/products/42" && options.method === "PATCH") product = { ...product, ...body };
    else if (path !== "/api/v1/admin/products/42" || options.method !== "GET") throw new Error("Unexpected API request");
    return new Response(JSON.stringify({ success: true, data: product }));
  };
  return requests;
}

async function submitProduct(specSummary, isEditMode = false) {
  const errors = [];
  const navigation = [];
  const bindings = {
    form: { name: "  Mainboard MSI B760M  ", sku: "2nd.main.msi.b760m", category_id: "7",
      spec_summary: specSummary, sale_price: "" },
    categories: [{ id: 7 }],
    getCategoryById: (categories, id) => categories.find((category) => String(category.id) === String(id)),
    SKU_PATTERN: /^[a-z0-9]+(\.[a-z0-9]+)*$/i, SKU_FORMAT_MESSAGE: "Invalid SKU",
    normalizeSalePriceInput: () => ({ value: null, error: "" }),
    isEditMode, id: 42, pendingImages: [], createProductRequest, updateProductRequest,
    setError: (message) => { if (message) errors.push(message); },
    setSuccess() {}, setIsSubmitting() {}, showCategoryError: () => errors.push("Invalid category"),
    navigate: (path) => navigation.push(path),
    hasCategoryValidationError: () => false, getProductErrorMessage: (error) => error.message
  };
  const submit = new Function(...Object.keys(bindings), handler + "\nreturn handleSubmit;")(...Object.values(bindings));
  await submit({ preventDefault() {} });
  assert.deepEqual(errors, []);
  assert.deepEqual(navigation, ["/admin/products"]);
}

test("create sends spec_summary and reopening the product returns the same value", async () => {
  const requests = mockProductApi();
  await submitProduct("SPEC_CREATE_TEST_2026");
  assert.deepEqual(requests[0], {
    path: "/api/v1/admin/products", method: "POST",
    body: { name: "Mainboard MSI B760M", sku: "2nd.main.msi.b760m", category_id: 7,
      spec_summary: "SPEC_CREATE_TEST_2026", sale_price: null }
  });
  assert.equal((await getProductRequest(42)).spec_summary, "SPEC_CREATE_TEST_2026");
});

test("create with blank spec_summary retains null semantics", async () => {
  const requests = mockProductApi();
  await submitProduct("  ");
  assert.equal(requests[0].body.spec_summary, null);
  assert.equal((await getProductRequest(42)).spec_summary, null);
});

test("update still saves spec_summary with the existing trim rule", async () => {
  const requests = mockProductApi();
  await createProductRequest({ name: "Existing", sku: "2nd.main.msi.b760m", category_id: 7 });
  await submitProduct("  SPEC_UPDATE_TEST_2026  ", true);
  assert.equal(requests[1].method, "PATCH");
  assert.equal(requests[1].body.spec_summary, "SPEC_UPDATE_TEST_2026");
  assert.equal((await getProductRequest(42)).spec_summary, "SPEC_UPDATE_TEST_2026");
});
