import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transformSync } from "esbuild";
import { getInventoryNoteSuggestions } from "./inventoryNoteSuggestions.js";
import { formatWarrantyNote } from "./warrantyNote.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../pages/InventoryCheckPage.jsx");
const css = read("../index.css");
const stateNames = [...page.matchAll(/const \[(\w+), \w+\] = useState/g)].map((match) => match[1]);
const compiled = transformSync(page, {
  loader: "jsx", format: "cjs", jsxFactory: "createElement", jsxFragment: "Fragment"
}).code;

// Render the actual JSX with seeded hook state; invoke the actual UI handlers.
// Effects/network races are exercised separately by inventoryNoteSuggestions.test.js.
function harness(initial = {}, services = {}) {
  const state = { ...initial };
  const refs = [];
  let cursor = 0;
  let refCursor = 0;
  let tree;
  const react = {
    useState(value) {
      const name = stateNames[cursor++];
      if (!(name in state)) state[name] = typeof value === "function" ? value() : value;
      return [state[name], (next) => { state[name] = typeof next === "function" ? next(state[name]) : next; }];
    },
    useRef(value) { return refs[refCursor++] ||= { current: value }; },
    useMemo: (fn) => fn(), useEffect() {}
  };
  const require = (id) => {
    if (id === "react") return react;
    if (id === "react-router-dom") return { Link: "Link" };
    if (id.includes("inventoryOperations")) return services;
    if (id.includes("inventoryNoteSuggestions")) return { getInventoryNoteSuggestions };
    if (id.includes("warrantyNote")) return { formatWarrantyNote };
    if (id.includes("recentItems")) return {
      readRecentItems: () => [], saveRecentItem: (_, item) => [item],
      filterRecentItemsByAvailable: (recent) => recent
    };
    throw new Error(`Unexpected import: ${id}`);
  };
  const module = { exports: {} };
  const createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
  new Function("require", "module", "exports", "createElement", "Fragment", "window", compiled)(
    require, module, module.exports, createElement, "Fragment", { setTimeout() {}, localStorage: { setItem() {} } }
  );
  function render() { cursor = 0; refCursor = 0; tree = module.exports.InventoryCheckPage(); }
  function nodes(node = tree) {
    return node && typeof node === "object"
      ? [node, ...node.children.flatMap((child) => child && typeof child === "object" ? nodes(child) : [])]
      : [];
  }
  render();
  return { state, render, nodes, find: (predicate) => nodes().find(predicate) };
}

const product = { id: 42, sku: "long.sku.24g50z", name: "Màn hình tên dài 24G50Z", category: { name: "Màn hình" }, total_quantity: 9 };
const detail = { product, note_groups: [{ note: "bh 3 tháng", quantity: 7 }, { note: null, is_no_note: true, quantity: 2 }] };
const byId = (h, id) => h.find((n) => n.props.id === id);
const text = (h) => h.nodes().flatMap((n) => n.children.filter((c) => typeof c === "string" || typeof c === "number")).join(" ");

test("Inventory wide opt-in is separate from unchanged Stock In and Admin defaults", () => {
  const layout = read("../layouts/AdminLayout.jsx");
  assert.match(layout, /admin-page-container mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6/);
  for (const name of ["inventory-check-container", "stock-in-workspace"]) {
    assert.ok(css.includes(`.admin-page-container:has(> .${name}) {\n  max-width: 100%;\n}`));
  }
  assert.match(css, /@container inventory-check \(min-width: 960px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 38fr\) minmax\(0, 62fr\)/);
});

test("search rows use actual server results; selecting collapses and loads the chosen SKU", async () => {
  const calls = [];
  const h = harness({ searchInput: "24g50z", debouncedSearch: "24g50z", products: [product], activeProducts: [], isProductResultsOpen: true }, {
    getInventoryCheckProduct: async (sku) => { calls.push(sku); return detail; }
  });
  const row = h.find((n) => n.props.className?.includes("inventory-check-result "));
  assert.ok(row);
  assert.match(text(h), /Màn hình tên dài 24G50Z/);
  row.props.onClick();
  await Promise.resolve();
  h.render();
  assert.deepEqual(calls, [product.sku]);
  assert.equal(h.state.detail, detail);
  assert.equal(h.state.selectedSku, product.sku);
  assert.equal(h.state.isProductResultsOpen, false);
  assert.equal(h.find((n) => n.props.className?.includes("inventory-check-results ")), undefined);
  byId(h, "inventory-product-search").props.onFocus();
  h.render();
  assert.ok(h.find((n) => n.props.className?.includes("inventory-check-results ")));
});

test("selected identity, canonical quantity and both note groups stay visible", () => {
  const h = harness({ detail });
  assert.ok(h.find((n) => n.type === "h3" && n.children.includes(product.name)));
  assert.match(text(h), /long.sku.24g50z/);
  assert.match(text(h), /Màn hình/);
  assert.equal(h.find((n) => n.props.className?.includes("inventory-check-stock-value")).children[0], 9);
  assert.match(text(h), /bh 3 tháng/);
  assert.match(text(h), /Không ghi chú/);
});

test("all adjustment modes retain their controls, group limits and one submit", () => {
  for (const adjustmentType of ["INCREASE", "DECREASE", "MOVE_NOTE"]) {
    const h = harness({ detail, adjustmentType, adjustNoteGroup: "bh 3 tháng" });
    assert.equal(h.nodes().filter((n) => n.props.type === "submit").length, 1);
    assert.equal(byId(h, "inventory-adjust-quantity").props.min, 1);
    assert.equal(byId(h, "inventory-adjust-quantity").props.max, adjustmentType === "INCREASE" ? undefined : 7);
    assert.equal(Boolean(byId(h, "inventory-adjust-note")), adjustmentType === "INCREASE");
    assert.equal(Boolean(byId(h, "inventory-decrease-group")), adjustmentType === "DECREASE");
    assert.equal(Boolean(byId(h, "inventory-move-source")), adjustmentType === "MOVE_NOTE");
    if (adjustmentType === "MOVE_NOTE") assert.equal(byId(h, "inventory-move-destination").props.maxLength, 500);
    for (const label of h.nodes().filter((n) => n.type === "label")) assert.ok(byId(h, label.props.htmlFor));
  }
});

test("autocomplete keeps casing, permits free text and is not inside a clipped scroller", () => {
  const h = harness({ detail });
  byId(h, "inventory-adjust-note").props.onFocus();
  h.render();
  const options = h.nodes().filter((n) => n.props.role === "option");
  assert.equal(options.length, 1);
  assert.equal(options[0].children[0], "bh 3 tháng");
  options[0].props.onClick();
  assert.equal(h.state.adjustNoteGroup, "bh 3 tháng");
  assert.equal(h.state.isAdjustNoteOpen, false);
  byId(h, "inventory-adjust-note").props.onChange({ target: { value: "Ghi chú mới" } });
  assert.equal(h.state.adjustNoteGroup, "Ghi chú mới");
  assert.doesNotMatch(css.match(/\.inventory-check-detail\s*\{[^}]+\}/)[0], /overflow|contain:\s*(?:paint|strict|content)/);
  assert.doesNotMatch(h.find((n) => n.type === "form").props.className, /overflow/);
});

test("empty/loading/error states remain understandable before a product is selected", () => {
  const empty = harness();
  assert.equal(empty.find((n) => n.type === "form"), undefined);
  assert.match(text(empty), /Chọn sản phẩm từ kết quả tìm kiếm/);
  const loading = harness({ isLoadingDetail: true });
  assert.match(text(loading), /Đang tải chi tiết sản phẩm/);
  const failed = harness({ error: "Không thể tải thông tin kiểm hàng." });
  assert.equal(failed.find((n) => n.props.role === "alert").children[0], "Không thể tải thông tin kiểm hàng.");
  const missing = harness({ isProductResultsOpen: true, debouncedSearch: "Không có" });
  assert.equal(missing.find((n) => n.type === "Link").props.to, `/admin/products/new?name=${encodeURIComponent("Không có")}`);
});

test("both histories retain data and independently keyboard-scrollable regions", () => {
  const h = harness({ detail: { ...detail,
    recent_adjustments: [{ id: 1, from_note: "bh 3 tháng", to_note: "Bao test", quantity: 2, reason: "Chuyển nhóm", created_by_admin: { username: "admin-test" } }],
    recent_quantity_adjustments: [{ id: 2, adjustment_type: "INCREASE", note_group: "Bao test", quantity: 1, from_quantity: 8, to_quantity: 9, reason: "Kiểm kho" }]
  } });
  assert.equal(h.nodes().filter((n) => n.type === "table").length, 2);
  assert.equal(h.nodes().filter((n) => n.props.role === "region" && n.props.tabIndex === 0).length, 2);
  assert.match(text(h), /Chuyển nhóm/);
  assert.match(text(h), /Kiểm kho/);
  assert.match(text(h), /admin-test/);
});

test("narrow layout keeps normal flow, touch-size controls and bounded search only", () => {
  assert.match(css, /\.inventory-check-primary-grid,\s*\.inventory-check-product-summary,\s*\.inventory-check-form-grid\s*\{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.inventory-check-container input,\s*\.inventory-check-container select\s*\{\s*min-height: 2.75rem;\s*font-size: 1rem/);
  assert.match(css, /\.inventory-check-results\s*\{\s*max-height: min\(28rem, 60vh\);\s*overflow-y: auto/);
  assert.match(css, /\.inventory-check-sku\s*\{\s*overflow-wrap: anywhere/);
  for (const rule of css.matchAll(/\.inventory-check-[^{]+\{([^}]+)\}/g)) {
    assert.doesNotMatch(rule[1], /position:\s*(sticky|fixed)/);
  }
  assert.match(css, /\.inventory-check-container\s*\{[^}]*padding-bottom: 6rem/);
});
