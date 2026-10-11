import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transformSync } from "esbuild";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../pages/StockInBulkPage.jsx");
const supplier = read("../components/SupplierSelector.jsx");
const css = read("../index.css");
const layout = read("../layouts/AdminLayout.jsx");

// Exercise the real JSX and event handlers without adding a DOM/test dependency.
// Async API loading is covered by the service tests; seed already-loaded state here.
function renderHarness(source, exportName, initial = [], props = {}, services = {}) {
  const slots = [...initial];
  let cursor = 0;
  let tree;
  const createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
  const react = {
    useState(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value;
      return [slots[i], (next) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }];
    },
    useRef: (value) => ({ current: value }),
    useMemo: (fn) => fn(),
    useEffect() {}
  };
  const recent = {
    readRecentItems: () => [], saveRecentItem: (_, item) => [item],
    mergeRecentFirst: (_, items) => items,
    filterRecentItemsByAvailable: (_, items) => items
  };
  const require = (id) => {
    if (id === "react") return react;
    if (id === "react-router-dom") return { Link: "Link", useNavigate: () => () => {} };
    if (id.includes("recentItems")) return recent;
    if (id.includes("inventoryOperations")) return services;
    if (id.includes("SupplierSelector")) return { SupplierSelector: "SupplierSelector" };
    if (id.includes("StockInNoteInput")) return { StockInNoteInput: "StockInNoteInput" };
    throw new Error(`Unexpected import ${id}`);
  };
  const module = { exports: {} };
  const code = transformSync(source, { loader: "jsx", format: "cjs", jsxFactory: "createElement" }).code;
  new Function("require", "module", "exports", "createElement", "window", code)(
    require, module, module.exports, createElement, { setTimeout() {} }
  );
  function render() { cursor = 0; tree = module.exports[exportName](props); return tree; }
  function nodes(node = tree) {
    if (!node || typeof node !== "object") return [];
    return [node, ...node.children.flatMap((child) => child && typeof child === "object" ? nodes(child) : [])];
  }
  render();
  return { render, nodes, slots };
}

const product = { id: 1, sku: "long.dot.separated.sku", name: "Tên sản phẩm dài", category: { name: "RAM" }, note_groups: [{ note: "bh 8.27" }] };
const item = (index = 1) => ({ rowId: `row-${index}`, product, sku: product.sku, note: "  bh  mới  tại shop  ", quantity: "2" });
const pageState = (items = []) => [[product], [], false, false, null, "", "", false, [], items, "", ""];
const find = (h, predicate) => h.nodes().find(predicate);

test("wide workspace is a page opt-in; other Admin routes keep their existing width", () => {
  assert.match(layout, /admin-page-container mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6/);
  assert.match(css, /\.admin-page-container:has\(> \.stock-in-workspace\)\s*\{\s*max-width: 100%;\s*\}/);
  assert.match(page, /<section className="stock-in-workspace min-w-0 max-w-full"/);
  assert.doesNotMatch(page, /max-w-7xl|pathname/);
});

test("header has no submit; one primary action and compact optional supplier remain", () => {
  const h = renderHarness(page, "StockInBulkPage", pageState());
  const submits = h.nodes().filter((n) => n.props.type === "submit");
  assert.equal(submits.length, 1);
  assert.equal(submits[0].props.disabled, true);
  assert.match(submits[0].props.className, /stock-in-submit/);
  assert.equal(find(h, (n) => n.type === "SupplierSelector").props.variant, "compact");
  assert.ok(find(h, (n) => n.children.includes("Không bắt buộc")));
  assert.ok(find(h, (n) => n.children.includes("Tìm sản phẩm để thêm vào phiếu")));
});

test("twenty editable rows retain row-local note groups, quantity, remove and total", () => {
  const h = renderHarness(page, "StockInBulkPage", pageState(Array.from({ length: 20 }, (_, i) => item(i))));
  const notes = h.nodes().filter((n) => n.type === "StockInNoteInput");
  assert.equal(notes.length, 20);
  assert.equal(notes[0].props.groups, product.note_groups);
  notes[0].props.onChange("Bao test mới");
  assert.equal(h.slots[9][0].note, "Bao test mới");
  assert.equal(h.slots[9][1].note, item().note);
  const quantity = find(h, (n) => n.props.id === "stock-in-quantity-row-0");
  quantity.props.onChange({ target: { value: "3" } });
  h.render();
  assert.ok(find(h, (n) => n.children.includes(41)));
  find(h, (n) => n.props["aria-label"] === "Xóa sản phẩm").props.onClick();
  assert.equal(h.slots[9].length, 19);
  assert.equal(h.slots[9][0].rowId, "row-1");
  assert.doesNotMatch(page.match(/className="stock-in-products-list[^"]*"/)[0], /overflow|max-h|space-y|rounded|shadow/);
});

test("free-text submit without supplier preserves payload and validation", async () => {
  let payload;
  const h = renderHarness(page, "StockInBulkPage", pageState([item()]), {}, {
    bulkStockInRequest: async (value) => { payload = value; return {}; },
    listActiveProducts: async () => [product]
  });
  const submit = () => find(h, (n) => n.type === "form").props.onSubmit({ preventDefault() {} });
  await submit();
  assert.deepEqual(payload, { items: [{ sku: product.sku, quantity: 2, note: "bh  mới  tại shop" }] });
  assert.equal(h.slots[9].length, 0);
  assert.match(h.slots[11], /Nhập hàng thành công/);
  payload = undefined;
  h.slots[9] = [{ ...item(), quantity: "0" }];
  h.render();
  await submit();
  assert.equal(payload, undefined);
  assert.match(h.slots[10], /số nguyên dương/);
});

test("compact supplier hides only the empty panel; default presentation is unchanged", () => {
  for (const variant of [undefined, "compact"]) {
    const h = renderHarness(supplier, "SupplierSelector", [], { variant, selectedSupplier: null, onSelect() {} });
    assert.equal(Boolean(find(h, (n) => n.children.includes("Chưa có thông tin nhà cung cấp"))), variant !== "compact");
    find(h, (n) => n.type === "input").props.onFocus();
    h.render();
    assert.ok(find(h, (n) => n.props.onClick?.name === "openCreateForm"));
  }
});

test("compact supplier preserves select/change/create handlers and API payload", async () => {
  const selected = [];
  let createdPayload;
  const state = ["", "", [{ id: 7, name: "NCC", phone: "123" }], [], true, 0, false, false, { name: " NCC mới ", phone: " 123 ", address: " địa chỉ " }, false, "", ""];
  const h = renderHarness(supplier, "SupplierSelector", state, { variant: "compact", selectedSupplier: null, onSelect: (s) => selected.push(s) }, {
    createSupplier: async (payload) => { createdPayload = payload; return { id: 8, ...payload }; }
  });
  find(h, (n) => n.props.onMouseEnter).props.onClick();
  assert.equal(selected[0].id, 7);
  h.slots[4] = true;
  h.render();
  find(h, (n) => n.props.onClick?.name === "openCreateForm").props.onClick();
  h.render();
  await find(h, (n) => n.props.onClick?.name === "handleCreateSupplier").props.onClick();
  assert.deepEqual(createdPayload, { name: "NCC mới", phone: "123", address: "địa chỉ" });
  assert.equal(selected[1].id, 8);
  const changed = renderHarness(supplier, "SupplierSelector", [], { variant: "compact", selectedSupplier: selected[0], onSelect: (s) => selected.push(s) });
  find(changed, (n) => n.type === "button" && n.children.includes("Đổi")).props.onClick();
  assert.equal(selected.at(-1), null);
});

test("container layout contracts retain wrapping, touch sizes and compact action columns", () => {
  assert.match(css, /@container stock-in-products \(min-width: 900px\)/);
  assert.equal((css.match(/minmax\(280px, 1fr\) minmax\(280px, 1\.5fr\) 96px 44px/g) || []).length, 2);
  assert.match(css, /min-height: 3\.5rem/);
  const desktop = css.slice(css.indexOf("@container stock-in-products (min-width: 900px)"));
  for (const selector of ["stock-in-products-grid-header", "stock-in-product-row"]) {
    const block = desktop.slice(desktop.indexOf(`.${selector} {`)).split("}")[0];
    assert.match(block, /gap: 0\.75rem;/, `${selector} must align with the other grid`);
  }
  assert.match(css, /\.stock-in-workspace \.stock-in-note-input\s*\{\s*font-size: 1rem/);
  assert.match(page, /stock-in-product-row grid min-w-0 max-w-full grid-cols-1/);
  assert.match(page, /stock-in-quantity-input h-11[^"\n]*text-base/);
  assert.match(css, /\.stock-in-product-sku\s*\{\s*overflow-wrap: anywhere;\s*white-space: normal/);
  assert.doesNotMatch(page, /overflow-x-hidden|overflow-x-auto|sticky/);
});

test("product identity groups name, SKU and category in one cell ahead of the editable note", () => {
  const h = renderHarness(page, "StockInBulkPage", pageState([item()]));
  const hasClass = (name) => (n) => n.props.className?.split(" ").includes(name);
  const row = find(h, hasClass("stock-in-product-row"));
  const identity = row.children[0];
  assert.ok(h.nodes(identity).some((n) => n.children.includes(product.name)));
  assert.ok(h.nodes(identity).some((n) => n.children.includes(product.sku)));
  assert.ok(h.nodes(identity).some((n) => n.children.includes(product.category.name)));
  assert.equal(h.nodes(row).filter(hasClass("stock-in-product-sku")).length, 1);
  assert.ok(h.nodes(row.children[1]).some((n) => n.type === "StockInNoteInput"));
  assert.ok(h.nodes(row.children[2]).some((n) => n.props.type === "number"));
  assert.equal(row.children[3].props["aria-label"], "Xóa sản phẩm");
  const header = find(h, hasClass("stock-in-products-grid-header"));
  assert.deepEqual(header.children.map((n) => n.children[0]), ["Sản phẩm", "Nhóm bảo hành / ghi chú", "Số lượng", "Xóa"]);
});

test("bounded search results keep identity/stock, add-product click and Escape behavior", () => {
  const state = pageState();
  state[5] = "Tên";
  state[6] = "Tên";
  state[7] = true;
  const h = renderHarness(page, "StockInBulkPage", state);
  const result = find(h, (n) => n.props.className?.split(" ").includes("stock-in-search-result"));
  assert.ok(result);
  const [identity, stock] = result.children[0].children;
  assert.ok(h.nodes(identity).some((n) => n.children.includes(product.name)));
  assert.ok(h.nodes(identity).some((n) => n.children.includes(product.sku)));
  assert.ok(stock.props.className.includes("stock-in-search-result-stock"));
  assert.ok(h.nodes(stock).some((n) => n.children.includes(0)));
  assert.match(result.props.className, /hover:bg-blue-50/);
  assert.match(result.props.className, /focus-visible:bg-blue-50/);
  result.props.onClick();
  assert.equal(h.slots[9][0].product, product);
  assert.equal(h.slots[9][0].quantity, "1");
  assert.equal(h.slots[7], false);
  h.render();
  const search = find(h, (n) => n.props["aria-label"] === "Tìm theo tên sản phẩm hoặc SKU");
  search.props.onFocus();
  assert.equal(h.slots[7], true);
  search.props.onKeyDown({ key: "Escape" });
  assert.equal(h.slots[7], false);
  assert.match(css, /\.stock-in-search-results\s*\{[^}]*max-height: min\(25rem, 60vh\);[^}]*overflow-y: auto;/);
  assert.match(css, /\.stock-in-search-result\s*\{\s*min-height: 3rem;/);
  assert.match(css, /\.stock-in-search-result-grid\s*\{[^}]*max-width: 70rem;[^}]*grid-template-columns: minmax\(0, 1fr\) 6rem;/);
});

test("summary region contains the unchanged totals and the only primary submit", () => {
  const h = renderHarness(page, "StockInBulkPage", pageState([item(1), item(2), item(3)]));
  const summary = find(h, (n) => n.props.className?.split(" ").includes("stock-in-summary"));
  const nodes = h.nodes(summary);
  assert.ok(nodes.some((n) => n.children.includes(3)));
  assert.ok(nodes.some((n) => n.children.includes(6)));
  assert.equal(nodes.filter((n) => n.props.type === "submit").length, 1);
  assert.equal(h.nodes().filter((n) => n.props.type === "submit").length, 1);
  assert.match(summary.props.className, /border-t/);
  assert.doesNotMatch(summary.props.className, /sticky|fixed|shadow|rounded/);
});
