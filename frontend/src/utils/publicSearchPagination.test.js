import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  dedupePublicProducts,
  getPublicSearchLoadMoreCount,
  mergePublicSearchPages,
  PUBLIC_SEARCH_PAGE_SIZE
} from "./publicSearchPagination.js";

function products(start, count) {
  return Array.from({ length: count }, (_, index) => ({
    productId: start + index,
    name: `Product ${start + index}`,
    totalQuantity: 1
  }));
}

test("initial full search preserves 20 loaded products while exposing the canonical total", () => {
  const loaded = dedupePublicProducts(products(1, 20));
  const totalMatches = 22;

  assert.equal(loaded.length, 20);
  assert.equal(totalMatches, 22);
  assert.equal(getPublicSearchLoadMoreCount(loaded.length, totalMatches), 2);
});

test("loading the final page appends in order and removes the load-more action", () => {
  const firstPage = products(1, 20);
  const merged = mergePublicSearchPages(firstPage, products(21, 2));

  assert.deepEqual(merged.map((product) => product.productId), Array.from({ length: 22 }, (_, index) => index + 1));
  assert.equal(getPublicSearchLoadMoreCount(merged.length, 22), 0);
});

test("load-more count is capped by page size for larger result sets", () => {
  assert.equal(PUBLIC_SEARCH_PAGE_SIZE, 20);
  assert.equal(getPublicSearchLoadMoreCount(20, 65), 20);
  assert.equal(getPublicSearchLoadMoreCount(40, 65), 20);
  assert.equal(getPublicSearchLoadMoreCount(60, 65), 5);
});

test("next-page duplicates are removed without disturbing accumulated order", () => {
  const merged = mergePublicSearchPages(products(1, 20), [
    { productId: 20, name: "Duplicate 20", totalQuantity: 1 },
    { productId: 21, name: "Product 21", totalQuantity: 1 },
    { productId: 22, name: "Product 22", totalQuantity: 1 }
  ]);

  assert.equal(merged.length, 22);
  assert.deepEqual(merged.slice(-3).map((product) => product.productId), [20, 21, 22]);
});

test("replacing with a new query page resets accumulated results", () => {
  const oldResults = mergePublicSearchPages(products(1, 20), products(21, 2));
  const newResults = dedupePublicProducts(products(101, 4));

  assert.equal(oldResults.length, 22);
  assert.deepEqual(newResults.map((product) => product.productId), [101, 102, 103, 104]);
});

test("page and component contracts preserve autocomplete, canonical count, retry, and view state", async () => {
  const pageSource = await readFile(new URL("../pages/PublicSearchPage.jsx", import.meta.url), "utf8");
  const serviceSource = await readFile(new URL("../services/publicSearch.service.js", import.meta.url), "utf8");

  assert.match(serviceSource, /const \{ page = 1, limit = PUBLIC_SEARCH_PAGE_SIZE,/);
  assert.match(serviceSource, /page: Number\(response\?\.meta\?\.page \?\? page\)/);
  assert.match(serviceSource, /limit: Number\(response\?\.meta\?\.limit \?\? limit\)/);
  assert.match(serviceSource, /totalMatches: Number\(response\?\.meta\?\.total \?\? products\.length\)/);

  assert.match(pageSource, /const LIVE_SEARCH_LIMIT = 7;/);
  assert.match(pageSource, /limit: LIVE_SEARCH_LIMIT,/);
  assert.match(pageSource, /setLiveSearchTotal\(Math\.max\(searchResult\.totalMatches, uniqueProducts\.length\)\)/);
  assert.match(pageSource, /Kết quả tra cứu \{searchResultCount > 0 \? `\(\$\{searchResultCount\}\)` : ""\}/);
  assert.match(pageSource, /Xem thêm \{searchLoadMoreCount\} sản phẩm/);
  assert.match(pageSource, /setResults\(\(currentProducts\) => mergePublicSearchPages\(currentProducts, searchResult\.products\)\)/);
  assert.match(pageSource, /setSearchLoadMoreError\("Không thể tải thêm sản phẩm lúc này\. Vui lòng thử lại\."\)/);
  assert.match(pageSource, /setResults\(\[\]\);\s+setSearchTotal\(0\);\s+setSearchPage\(1\);/);
  const loadMoreHandler = pageSource.slice(
    pageSource.indexOf("async function handleLoadMoreSearchResults"),
    pageSource.indexOf("function handleRetryCategoryProducts")
  );
  assert.doesNotMatch(loadMoreHandler, /setResults\(\[\]\)/);
  assert.match(loadMoreHandler, /setSearchPage\(searchResult\.page\)/);
  assert.match(pageSource, /resultViewMode === "card"/);
  assert.match(pageSource, /resultViewMode === "table"/);
  assert.equal(pageSource.match(/\}, \[retryCount, selectedSearchProductId, submittedKeyword, viewMode\]\);/)?.[0].includes("resultViewMode"), false);
});
