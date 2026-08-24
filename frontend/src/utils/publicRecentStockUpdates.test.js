import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatPublicStockUpdateCardText,
  formatPublicStockUpdatedAt,
  sanitizePublicRecentStockUpdates
} from "./publicRecentStockUpdates.js";

function product(id, overrides = {}) {
  return { id, productId: id, name: `Product ${id}`, totalQuantity: 2, ...overrides };
}

test("recent stock products are positive-stock, deduplicated, and capped at ten", () => {
  const products = [
    product(1),
    product(1),
    product(2, { totalQuantity: 0 }),
    ...Array.from({ length: 12 }, (_, index) => product(index + 3))
  ];
  const result = sanitizePublicRecentStockUpdates(products);

  assert.equal(result.length, 10);
  assert.equal(new Set(result.map((item) => item.productId)).size, 10);
  assert.equal(result.some((item) => item.productId === 2), false);
});

test("relative update text is minute/hour stable and supports today and yesterday", () => {
  const now = new Date(2026, 7, 24, 18, 0, 0).getTime();
  assert.equal(formatPublicStockUpdatedAt(new Date(now - 30_000), now), "Vừa cập nhật");
  assert.equal(formatPublicStockUpdatedAt(new Date(now - 15 * 60_000), now), "15 phút trước");
  assert.equal(formatPublicStockUpdatedAt(new Date(now - 2 * 60 * 60_000), now), "2 giờ trước");
  assert.equal(formatPublicStockUpdatedAt(new Date(2026, 7, 24, 5, 0, 0), now), "Hôm nay");
  assert.equal(formatPublicStockUpdatedAt(new Date(2026, 7, 23, 12, 0, 0), now), "Hôm qua");
  assert.equal(formatPublicStockUpdateCardText(new Date(now - 15 * 60_000), now), "Cập nhật 15 phút trước");
});

test("recent stock section owns a local card/table mode and leaves suggestion presentation separate", async () => {
  const sectionSource = await readFile(new URL("../components/public/PublicRecentStockUpdatesSection.jsx", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../pages/PublicSearchPage.jsx", import.meta.url), "utf8");
  const suggestionSource = await readFile(new URL("../components/public/PublicAvailableProductsSection.jsx", import.meta.url), "utf8");

  assert.match(sectionSource, /useState\("card"\)/);
  assert.match(sectionSource, /viewMode === "table"/);
  assert.match(sectionSource, /formatPublicSellingPrice\(\)/);
  assert.match(sectionSource, /supplementalText=/);
  assert.match(pageSource, /<PublicRecentStockUpdatesSection/);
  assert.match(pageSource, /<PublicAvailableProductsSection/);
  assert.doesNotMatch(suggestionSource, /PublicResultViewSwitcher|recentStock/i);
});

test("empty completed recent-stock data hides the section", async () => {
  const sectionSource = await readFile(new URL("../components/public/PublicRecentStockUpdatesSection.jsx", import.meta.url), "utf8");
  assert.match(sectionSource, /if \(!isLoading && safeProducts\.length === 0\) return null/);
});
