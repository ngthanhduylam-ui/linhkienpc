import assert from "node:assert/strict";
import test from "node:test";
import { formatPublicSellingPrice, normalizeOptionalProductDescription } from "./publicProductPresentation.js";

test("normalizes an optional public product description", () => {
  assert.equal(normalizeOptionalProductDescription("  2 dây CPU  "), "2 dây CPU");
  assert.equal(normalizeOptionalProductDescription(null), "");
  assert.equal(normalizeOptionalProductDescription(undefined), "");
  assert.equal(normalizeOptionalProductDescription(""), "");
  assert.equal(normalizeOptionalProductDescription("   \n\t  "), "");
});

test("preserves long plain-text descriptions without generating fallback content", () => {
  const description = "Hai dây CPU rời, hỗ trợ đi dây gọn trong thùng máy kích thước lớn";
  assert.equal(normalizeOptionalProductDescription(description), description);
});

test("always hides public selling prices behind the contact label", () => {
  assert.equal(formatPublicSellingPrice(2500000), "Liên hệ");
  assert.equal(formatPublicSellingPrice("12500000"), "Liên hệ");
  assert.equal(formatPublicSellingPrice(null), "Liên hệ");
  assert.equal(formatPublicSellingPrice(undefined), "Liên hệ");
  assert.equal(formatPublicSellingPrice(""), "Liên hệ");
  assert.equal(formatPublicSellingPrice(0), "Liên hệ");
  assert.equal(formatPublicSellingPrice("invalid"), "Liên hệ");
});
