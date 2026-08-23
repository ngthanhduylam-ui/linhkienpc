import assert from "node:assert/strict";
import test from "node:test";
import { formatWarrantyNote } from "./warrantyNote.js";

test("formatWarrantyNote trims only surrounding whitespace and preserves casing", () => {
  assert.equal(formatWarrantyNote("  bh 8.27  "), "bh 8.27");
  assert.equal(formatWarrantyNote("BH 3 tháng"), "BH 3 tháng");
  assert.equal(formatWarrantyNote("Bao test 7 ngày"), "Bao test 7 ngày");
});

test("formatWarrantyNote preserves internal whitespace", () => {
  assert.equal(formatWarrantyNote("BH  3 tháng tại shop"), "BH  3 tháng tại shop");
});

test("formatWarrantyNote keeps the existing empty-note fallback", () => {
  assert.equal(formatWarrantyNote("   "), "Không ghi chú");
  assert.equal(formatWarrantyNote(null), "Không ghi chú");
});
