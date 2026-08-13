import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const stockOutSource = await readFile(new URL("../pages/StockOutBulkPage.jsx", import.meta.url), "utf8");
const widgetSource = await readFile(new URL("../components/quickNotes/QuickNoteWidget.jsx", import.meta.url), "utf8");
const composerSource = await readFile(new URL("../components/quickNotes/QuickNoteComposer.jsx", import.meta.url), "utf8");
const serviceSource = await readFile(new URL("../services/quickNotes.service.js", import.meta.url), "utf8");
const helperSource = await readFile(new URL("./quickNotes.js", import.meta.url), "utf8");

test("fullscreen POS mounts the same reusable QuickNoteWidget once", () => {
  assert.match(stockOutSource, /import \{ QuickNoteWidget \} from "\.\.\/components\/quickNotes\/QuickNoteWidget"/);
  assert.equal((stockOutSource.match(/<QuickNoteWidget\b/g) || []).length, 1);
  assert.match(stockOutSource, /<QuickNoteWidget defaultBottomOffset=\{112\} context="pos" \/>/);
});

test("Quick Notes composer isolates Enter and submit events from POS", () => {
  assert.match(composerSource, /event\.key === "Enter"/);
  assert.match(composerSource, /event\.stopPropagation\(\)/);
  assert.match(composerSource, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
});

test("opening and moving the widget does not navigate or persist coordinates", () => {
  assert.doesNotMatch(widgetSource, /useNavigate|window\.location|localStorage|sessionStorage/);
  assert.doesNotMatch(helperSource, /localStorage|sessionStorage/);
  assert.match(widgetSource, /setOpen\(true\)/);
});

test("Quick Notes service cannot call product, stock, inventory, or voucher APIs", () => {
  assert.match(serviceSource, /const QUICK_NOTES_PATH = "\/admin\/quick-notes"/);
  assert.doesNotMatch(serviceSource, /products|stock|inventory|voucher/i);
});
