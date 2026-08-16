import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  changePublicResultViewMode,
  derivePublicSearchTableRow,
  derivePublicWarrantyLines,
  loadPublicResultViewMode,
  normalizePublicResultViewMode,
  PUBLIC_RESULT_VIEW_STORAGE_KEY,
  PUBLIC_SEARCH_TABLE_COLUMNS,
  savePublicResultViewMode
} from "./publicSearchResultsView.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
      writes.push([key, value]);
    },
    values,
    writes
  };
}

test("view preference defaults safely and persists only card or table", () => {
  assert.equal(normalizePublicResultViewMode(null), "card");
  assert.equal(normalizePublicResultViewMode("grid"), "card");
  assert.equal(normalizePublicResultViewMode("table"), "table");

  const emptyStorage = createStorage();
  assert.equal(loadPublicResultViewMode(emptyStorage), "card");

  const tableStorage = createStorage({ [PUBLIC_RESULT_VIEW_STORAGE_KEY]: "table" });
  assert.equal(loadPublicResultViewMode(tableStorage), "table");

  const invalidStorage = createStorage({ [PUBLIC_RESULT_VIEW_STORAGE_KEY]: "unknown" });
  assert.equal(loadPublicResultViewMode(invalidStorage), "card");

  assert.equal(savePublicResultViewMode("table", emptyStorage), "table");
  assert.deepEqual(emptyStorage.writes, [[PUBLIC_RESULT_VIEW_STORAGE_KEY, "table"]]);
  assert.deepEqual([...emptyStorage.values.keys()], [PUBLIC_RESULT_VIEW_STORAGE_KEY]);
});

test("storage failures never break the default card presentation", () => {
  const throwingStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); }
  };
  assert.equal(loadPublicResultViewMode(throwingStorage), "card");
  assert.equal(savePublicResultViewMode("table", throwingStorage), "table");
});

test("switching presentation preserves query, result identity, and result order", () => {
  const results = [{ productId: 7 }, { productId: 3 }, { productId: 11 }];
  const storage = createStorage();
  const tableState = changePublicResultViewMode({ query: "3070ti", results, viewMode: "card" }, "table", storage);
  const cardState = changePublicResultViewMode(tableState, "card", storage);

  assert.equal(tableState.query, "3070ti");
  assert.strictEqual(tableState.results, results);
  assert.deepEqual(tableState.results.map((item) => item.productId), [7, 3, 11]);
  assert.equal(tableState.viewMode, "table");
  assert.equal(cardState.query, "3070ti");
  assert.strictEqual(cardState.results, results);
  assert.deepEqual(cardState.results.map((item) => item.productId), [7, 3, 11]);
  assert.equal(cardState.viewMode, "card");
});

test("category result sets preserve identity and order in both card and table modes", () => {
  const categoryResults = [{ productId: 21 }, { productId: 8 }, { productId: 34 }];
  const storage = createStorage();
  const tableState = changePublicResultViewMode({
    query: "",
    results: categoryResults,
    viewMode: "card"
  }, "table", storage);
  const cardState = changePublicResultViewMode(tableState, "card", storage);

  assert.strictEqual(tableState.results, categoryResults);
  assert.deepEqual(tableState.results.map((item) => item.productId), [21, 8, 34]);
  assert.equal(tableState.viewMode, "table");
  assert.strictEqual(cardState.results, categoryResults);
  assert.deepEqual(cardState.results.map((item) => item.productId), [21, 8, 34]);
  assert.equal(cardState.viewMode, "card");
});

test("table model has exactly four public columns and never carries SKU or private prices", () => {
  assert.deepEqual(PUBLIC_SEARCH_TABLE_COLUMNS, ["Tên sản phẩm", "Bảo hành / ghi chú", "SL", "Giá"]);

  const row = derivePublicSearchTableRow({
    id: 4,
    productId: 4,
    sku: "2nd.psu.asus.rog",
    name: "Nguồn ASUS ROG STRIX 1000W GOLD / Full Modular / 2nd",
    specSummary: "  2 dây CPU  ",
    noteGroups: [{ note: "fullbox đủ dây bh 3.35", quantity: 1 }],
    totalQuantity: 1,
    salePrice: 2500000,
    purchasePrice: 1000000,
    cost: 1000000,
    margin: 1500000,
    profit: 1500000
  });

  assert.deepEqual(Object.keys(row), ["productId", "name", "specSummary", "warrantyLines", "totalQuantity", "price"]);
  assert.equal(row.name, "Nguồn ASUS ROG STRIX 1000W GOLD / Full Modular / 2nd");
  assert.equal(row.specSummary, "2 dây CPU");
  assert.deepEqual(row.warrantyLines, [{ label: "fullbox đủ dây bh 3.35", quantity: 1 }]);
  assert.equal(row.totalQuantity, 1);
  assert.equal(row.price, "2.500.000đ");
  assert.equal("sku" in row, false);
  assert.equal("purchasePrice" in row, false);
  assert.equal("cost" in row, false);
  assert.equal("margin" in row, false);
  assert.equal("profit" in row, false);
});

test("product specs and warranty notes remain independent data sources", () => {
  const row = derivePublicSearchTableRow({
    productId: 8,
    name: "Nguồn ASUS",
    specSummary: "2 dây CPU",
    noteGroups: [
      { label: "BH 8.27", quantity: 2 },
      { label: "HBH", quantity: 1 }
    ],
    totalQuantity: 3,
    salePrice: 0
  });

  assert.equal(row.specSummary, "2 dây CPU");
  assert.deepEqual(row.warrantyLines, [
    { label: "BH 8.27", quantity: 2 },
    { label: "HBH", quantity: 1 }
  ]);
  assert.equal(row.warrantyLines.some((line) => line.label.includes(row.specSummary)), false);
  assert.equal(row.specSummary.includes("BH 8.27"), false);
  assert.equal(row.price, "Liên hệ");

  const whitespaceSpec = derivePublicSearchTableRow({
    name: "Mainboard",
    specSummary: " \n\t ",
    noteGroups: [{ note: "Không ghi chú", quantity: 1 }]
  });
  assert.equal(whitespaceSpec.specSummary, "");
});

test("warranty lines support one or many groups and preserve canonical quantities", () => {
  assert.deepEqual(derivePublicWarrantyLines([{ note: "BH 9.27", quantity: 1 }]), [
    { label: "BH 9.27", quantity: 1 }
  ]);
  assert.deepEqual(derivePublicWarrantyLines([
    { note: "HBH", quantity: 1 },
    { note: "bh 8.27", quantity: 2 }
  ]), [
    { label: "BH 8.27", quantity: 2 },
    { label: "HBH", quantity: 1 }
  ]);
});

test("table warranty lines suppress only the default no-note group without changing total stock", () => {
  assert.deepEqual(derivePublicWarrantyLines([
    { note: "", label: "Không ghi chú", quantity: 6 }
  ]), []);

  const row = derivePublicSearchTableRow({
    productId: 18,
    name: "SSD WD Blue",
    noteGroups: [
      { label: "Không ghi chú", quantity: 6 },
      { label: "BH 8.27", quantity: 2 }
    ],
    totalQuantity: 8,
    salePrice: 1850000
  });

  assert.deepEqual(row.warrantyLines, [{ label: "BH 8.27", quantity: 2 }]);
  assert.equal(row.totalQuantity, 8);
});

test("PublicSearchPage keeps view preference out of the search effect dependencies", async () => {
  const source = await readFile(new URL("../pages/PublicSearchPage.jsx", import.meta.url), "utf8");
  const categorySource = await readFile(new URL("../components/public/PublicCategoryResultsSection.jsx", import.meta.url), "utf8");
  const dependencyMatch = source.match(/\}, \[retryCount, selectedSearchProductId, submittedKeyword, viewMode\]\);/);
  assert.ok(dependencyMatch, "expected the existing full-search effect dependency list");
  assert.equal(dependencyMatch[0].includes("resultViewMode"), false);
  assert.match(source, /viewMode === "category" \? categoryProducts : results/);
  assert.match(source, /setResultViewMode\(nextPresentation\.viewMode\)/);
  assert.match(categorySource, /resultViewMode === "card"/);
  assert.match(categorySource, /resultViewMode === "table"/);
  assert.match(categorySource, /<PublicSearchResultsTable products=\{safeProducts\} \/>/);
  assert.match(categorySource, /<PublicResultViewSwitcher value=\{resultViewMode\}/);
  assert.equal((source.match(/setResultViewMode\(/g) || []).length, 1);
});
