import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOptionalProductDescription } from "./publicProductPresentation.js";

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
