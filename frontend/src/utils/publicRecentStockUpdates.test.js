import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUBLIC_RECENT_STOCK_LIMIT,
  formatPublicStockUpdatedAt,
  sanitizePublicRecentStockUpdates
} from "./publicRecentStockUpdates.js";

function product(id, overrides = {}) {
  return { id, productId: id, name: `Product ${id}`, totalQuantity: 2, ...overrides };
}

test("recent stock products are positive-stock, deduplicated, and capped at fourteen", () => {
  const products = [
    product(1),
    product(1),
    product(2, { totalQuantity: 0 }),
    ...Array.from({ length: 16 }, (_, index) => product(index + 3))
  ];
  const result = sanitizePublicRecentStockUpdates(products);

  assert.equal(PUBLIC_RECENT_STOCK_LIMIT, 14);
  assert.equal(result.length, 14);
  assert.equal(new Set(result.map((item) => item.productId)).size, 14);
  assert.equal(result.some((item) => item.productId === 2), false);
});

test("relative update text is minute/hour stable and supports today and yesterday", () => {
  const now = new Date(2026, 7, 24, 18, 0, 0).getTime();
  assert.equal(formatPublicStockUpdatedAt(new Date(now - 30_000), now), "Vừa cập nhật");
  assert.equal(formatPublicStockUpdatedAt(new Date(now - 15 * 60_000), now), "15 phút trước");
  assert.equal(formatPublicStockUpdatedAt(new Date(now - 2 * 60 * 60_000), now), "2 giờ trước");
  assert.equal(formatPublicStockUpdatedAt(new Date(2026, 7, 24, 5, 0, 0), now), "Hôm nay");
  assert.equal(formatPublicStockUpdatedAt(new Date(2026, 7, 23, 12, 0, 0), now), "Hôm qua");
});

test("recent stock section is table-only while shared Public views and suggestions remain separate", async () => {
  const sectionSource = await readFile(new URL("../components/public/PublicRecentStockUpdatesSection.jsx", import.meta.url), "utf8");
  const cardSource = await readFile(new URL("../components/public/PublicCatalogueProductCard.jsx", import.meta.url), "utf8");
  const categoryResultsSource = await readFile(new URL("../components/public/PublicCategoryResultsSection.jsx", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../pages/PublicSearchPage.jsx", import.meta.url), "utf8");
  const serviceSource = await readFile(new URL("../services/publicSearch.service.js", import.meta.url), "utf8");
  const suggestionSource = await readFile(new URL("../components/public/PublicAvailableProductsSection.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(sectionSource, /useState|PublicResultViewSwitcher|PublicCatalogueProductCard|viewMode|supplementalText/);
  assert.match(sectionSource, /<RecentStockTable isLoading=\{isLoading\}/);
  assert.match(sectionSource, /onClick=\{\(\) => onViewDetails\(product\)\}/);
  assert.doesNotMatch(sectionSource, /Giá:\s*\{|formatPublicSellingPrice/);
  assert.match(cardSource, /formatPublicSellingPrice\(product\.salePrice\)/);
  assert.match(categoryResultsSource, /<PublicResultViewSwitcher value=\{resultViewMode\}/);
  assert.match(pageSource, /<PublicRecentStockUpdatesSection/);
  assert.match(pageSource, /<PublicAvailableProductsSection/);
  assert.match(serviceSource, /slice\(0, PUBLIC_RECENT_STOCK_LIMIT\)/);
  assert.doesNotMatch(suggestionSource, /PublicResultViewSwitcher|recentStock/i);
});

test("empty completed recent-stock data hides the section", async () => {
  const sectionSource = await readFile(new URL("../components/public/PublicRecentStockUpdatesSection.jsx", import.meta.url), "utf8");
  assert.match(sectionSource, /if \(!isLoading && safeProducts\.length === 0\) return null/);
});
