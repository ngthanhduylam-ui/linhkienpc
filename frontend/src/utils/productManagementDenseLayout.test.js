import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transformSync } from "esbuild";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../pages/ProductManagementPage.jsx");
const css = read("../index.css").replace(/\r\n/g, "\n");
const compiled = transformSync(source, { loader: "jsx", format: "cjs", jsxFactory: "element" }).code;
const product = {
  id: 234, name: "Màn hình AOC 24G50Z/71 tên sản phẩm rất dài ".repeat(3),
  sku: `2nd.lcd.${"long.model.".repeat(15)}24g50z`, category_id: 3,
  total_quantity: 0, sale_price: 1234567, is_active: true, primary_image: { id: 88 }
};
const otherProduct = { ...product, id: 235, sku: "lcd.other", name: "Sản phẩm ngừng sử dụng", is_active: false, sale_price: null, primary_image: null };

// Exercise real page effects and JSX handlers. The mock represents API responses,
// not a local search engine; request/SQL semantics are covered by service tests.
function harness(overrides = {}) {
  const calls = [];
  const confirmations = [];
  const slots = [];
  const timers = new Map();
  let cursor = 0;
  let dirty = true;
  let tree;
  let pending = [];
  let timerId = 0;
  const services = {
    listActiveCategories: async () => [{ id: 3, name: "Màn hình" }],
    listProductsPage: async (query) => {
      calls.push({ ...query });
      return { items: [product, otherProduct], meta: { total: 43, total_pages: 3 } };
    },
    activateProductRequest: async () => {}, deactivateProductRequest: async () => {},
    ...overrides
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], (next) => {
        const value = typeof next === "function" ? next(slots[i]) : next;
        if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useMemo: (fn) => fn(),
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, index) => !Object.is(dep, slots[i].deps[index]))) {
        pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    }
  };
  const require = (id) => {
    if (id === "react") return react;
    if (id === "react-router-dom") return { Link: "Link", useLocation: () => ({ search: "" }), useNavigate: () => () => {} };
    if (id.includes("AuthenticatedImage")) return { AuthenticatedImage: "AuthenticatedImage" };
    if (id.includes("inventoryOperations")) return services;
    throw new Error(`Unexpected import: ${id}`);
  };
  const win = {
    confirm(message) { confirmations.push(message); return win.confirmed; }, confirmed: true,
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); }, addEventListener() {}, removeEventListener() {}
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "element", "window", compiled)(
    require, module, module.exports,
    (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }), win
  );
  function nodes(node = tree) {
    return !node || typeof node !== "object" ? [] : [node, ...node.children.flatMap((c) => c && typeof c === "object" ? nodes(c) : [])];
  }
  function flush() {
    let count = 0;
    while (dirty) {
      assert.ok(count++ < 20, "no render loop");
      dirty = false; cursor = 0; pending = [];
      tree = module.exports.ProductManagementPage();
      pending.forEach((effect) => effect());
    }
  }
  async function settle() {
    for (let i = 0; i < 4; i++) { await new Promise(setImmediate); flush(); }
  }
  const find = (predicate) => nodes().find(predicate);
  flush();
  return {
    calls, confirmations, win, nodes, find, flush, settle,
    byId: (id) => find((n) => n.props.id === id),
    button: (text) => find((n) => n.type === "button" && n.children.includes(text)),
    rows: () => nodes().filter((n) => n.props.className?.split(" ").includes("product-management-row")),
    async debounce() {
      for (const [id, timer] of [...timers]) if (timer.delay === 300) { timers.delete(id); timer.fn(); }
      flush(); await settle();
    },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); }
  };
}
function texts(h, node = h.nodes()[0]) {
  const collect = (value) => value && typeof value === "object"
    ? value.children.map(collect).join(" ")
    : typeof value === "string" || typeof value === "number" ? String(value) : "";
  return collect(node).replace(/\s+/g, " ").trim();
}

test("Products alone opts into wide workspace alongside existing Stock In and Inventory Check", () => {
  assert.match(read("../layouts/AdminLayout.jsx"), /admin-page-container mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6/);
  for (const name of ["product-management-container", "stock-in-workspace", "inventory-check-container"]) {
    assert.ok(css.includes(`.admin-page-container:has(> .${name}) {\n  max-width: 100%;\n}`));
  }
  assert.doesNotMatch(read("../pages/ProductFormPage.jsx"), /product-management-container/);
  assert.doesNotMatch(read("../pages/StockOutBulkPage.jsx"), /product-management-container/);
});

test("search remains debounced server-side and resets pagination with the unchanged query", async () => {
  const h = harness(); await h.settle();
  h.button("Sau").props.onClick(); h.flush(); await h.settle();
  assert.equal(h.calls.at(-1).page, 2);
  const before = h.calls.length;
  h.byId("product-list-search").props.onChange({ target: { value: "Aoc" } }); h.flush();
  h.byId("product-list-search").props.onChange({ target: { value: "  Aoc 24  " } }); h.flush();
  assert.equal(h.calls.length, before);
  await h.debounce();
  assert.deepEqual(h.calls.at(-1), { keyword: "Aoc 24", page: 1, limit: 20, is_active: true });
  assert.equal(h.rows().length, 2, "render API results directly, without another local filter");
  h.find((n) => n.props["aria-label"] === "Xóa tìm kiếm").props.onClick(); h.flush(); await h.settle();
  assert.equal(h.byId("product-list-search").props.value, "");
  assert.equal(h.calls.at(-1).keyword, "");
  h.unmount();
});

test("status filters send explicit all/true/false and reset to page one with the same search", async () => {
  const h = harness(); await h.settle();
  h.byId("product-list-search").props.onChange({ target: { value: "aoc 24" } }); h.flush(); await h.debounce();
  for (const [filter, value] of [["inactive", false], ["all", "all"], ["active", true]]) {
    h.button("Sau").props.onClick(); h.flush(); await h.settle();
    h.byId("product-list-status").props.onChange({ target: { value: filter } }); h.flush(); await h.settle();
    assert.equal(h.calls.at(-1).page, 1);
    assert.equal(h.calls.at(-1).is_active, value);
    assert.equal(h.calls.at(-1).keyword, "aoc 24");
    assert.equal(h.calls.at(-1).in_stock, undefined);
  }
  h.unmount();
});

test("changing status/search ignores stale success and error responses including old pagination", async () => {
  const requests = [];
  const h = harness({ listProductsPage: (query) => new Promise((resolve, reject) => requests.push({ query, resolve, reject })) });
  const response = (items, total = items.length) => ({ items, meta: { total, total_pages: Math.max(1, Math.ceil(total / 20)) } });
  requests[0].resolve(response([product], 43)); await h.settle();
  h.button("Sau").props.onClick(); h.flush();
  h.byId("product-list-status").props.onChange({ target: { value: "all" } }); h.flush();
  assert.deepEqual(requests[2].query, { keyword: "", page: 1, limit: 20, is_active: "all" });
  assert.equal(h.rows().length, 0, "old rows are hidden while the new filter loads");
  requests[1].reject(new Error("stale page error")); await h.settle();
  assert.ok(texts(h).includes("Đang tải danh sách sản phẩm..."));
  assert.equal(h.find((n) => n.props.role === "alert"), undefined);
  h.byId("product-list-status").props.onChange({ target: { value: "inactive" } }); h.flush();
  requests[3].resolve(response([otherProduct])); await h.settle();
  requests[2].resolve(response([product, otherProduct], 99)); await h.settle();
  assert.equal(h.rows().length, 1);
  assert.ok(texts(h, h.rows()[0]).includes(otherProduct.name));
  assert.match(texts(h), /Tổng: 1 sản phẩm/);
  assert.match(texts(h), /Trang 1 \/ 1/);
  h.byId("product-list-search").props.onChange({ target: { value: "old" } }); h.flush(); await h.debounce();
  h.byId("product-list-search").props.onChange({ target: { value: "new" } }); h.flush(); await h.debounce();
  assert.equal(requests[5].query.is_active, false);
  requests[5].resolve(response([])); await h.settle();
  requests[4].resolve(response([otherProduct], 99)); await h.settle();
  assert.equal(h.rows().length, 0);
  assert.match(texts(h), /Tổng: 0 sản phẩm/);
  assert.equal(h.find((n) => n.props.role === "alert"), undefined);
  h.unmount();
});

test("pagination uses API metadata, keeps the current query and disables both boundaries", async () => {
  const h = harness(); await h.settle();
  assert.equal(h.button("Trước").props.disabled, true);
  h.byId("product-list-search").props.onChange({ target: { value: "lcd" } }); h.flush(); await h.debounce();
  for (const page of [2, 3]) {
    h.button("Sau").props.onClick(); h.flush(); await h.settle();
    assert.equal(h.calls.at(-1).page, page);
    assert.equal(h.calls.at(-1).keyword, "lcd");
  }
  assert.equal(h.button("Sau").props.disabled, true);
  assert.match(texts(h), /Tổng: 43 sản phẩm/);
  assert.match(texts(h), /Trang 3 \/ 3/);
  h.button("Trước").props.onClick(); h.flush(); await h.settle();
  assert.equal(h.calls.at(-1).page, 2);
  h.unmount();
});

test("rows preserve full identity, thumbnail, category, admin price, zero stock and status", async () => {
  const h = harness(); await h.settle();
  const [active, inactive] = h.rows();
  assert.ok(texts(h, active).includes(product.name.trim()));
  assert.ok(texts(h, active).includes(product.sku));
  assert.ok(texts(h, active).includes("Màn hình"));
  assert.ok(texts(h, active).includes("1.234.567 ₫"));
  assert.ok(h.nodes(active).some((n) => n.children.includes(0)));
  assert.ok(texts(h, active).includes("Đang sử dụng"));
  assert.ok(texts(h, inactive).includes("Ngừng sử dụng"));
  assert.ok(texts(h, inactive).includes("Chưa thiết lập"));
  const images = h.nodes().filter((n) => n.type === "AuthenticatedImage");
  assert.equal(images[0].props.path, "/admin/products/234/images/88/thumbnail");
  assert.equal(images[1].props.path, "");
  const identity = h.nodes(active).find((n) => n.props.className?.split(" ").includes("product-management-name"));
  assert.ok(texts(h, identity).includes(product.sku));
  assert.ok(h.nodes(identity).every((n) => !/truncate|line-clamp/.test(n.props.className || "")));
  h.unmount();
});

test("Add/Edit routes and inline row actions stay discoverable without a new menu", async () => {
  const h = harness(); await h.settle();
  assert.deepEqual(h.nodes().filter((n) => n.type === "Link").map((n) => n.props.to), [
    "/admin/products/new", "/admin/products/234/edit", "/admin/products/235/edit"
  ]);
  assert.ok(h.button("Ngừng")); assert.ok(h.button("Khôi phục"));
  assert.equal(h.nodes().filter((n) => n.props["aria-haspopup"] === "menu").length, 0);
  h.unmount();
});

test("deactivate and restore retain confirmations, product IDs, refresh and feedback", async () => {
  const mutations = [];
  const h = harness({ deactivateProductRequest: async (id) => mutations.push(["deactivate", id]), activateProductRequest: async (id) => mutations.push(["activate", id]) });
  await h.settle();
  h.win.confirmed = false;
  await h.button("Ngừng").props.onClick();
  assert.equal(mutations.length, 0);
  h.win.confirmed = true;
  await h.button("Ngừng").props.onClick(); h.flush(); await h.settle();
  assert.deepEqual(mutations[0], ["deactivate", 234]);
  assert.ok(texts(h).includes(`Đã ngừng sử dụng sản phẩm: ${product.name}.`));
  await h.button("Khôi phục").props.onClick(); h.flush(); await h.settle();
  assert.deepEqual(mutations[1], ["activate", 235]);
  assert.ok(texts(h).includes(`Đã khôi phục sản phẩm: ${otherProduct.name}.`));
  assert.equal(h.calls.length, 3);
  assert.ok(h.confirmations.at(-1).includes(otherProduct.name));
  h.unmount();
});

test("action errors retain the existing message and do not report success", async () => {
  const h = harness({ deactivateProductRequest: async () => { throw new Error("Thao tác thất bại"); } });
  await h.settle(); await h.button("Ngừng").props.onClick(); h.flush();
  assert.equal(h.find((n) => n.props.role === "alert").children[0], "Thao tác thất bại");
  assert.equal(h.find((n) => n.props.role === "status"), undefined);
  assert.equal(h.calls.length, 1);
  h.unmount();
});

test("loading and empty results keep search/filter and pagination available", async () => {
  let resolve;
  const h = harness({ listProductsPage: () => new Promise((done) => { resolve = done; }) });
  assert.ok(texts(h).includes("Đang tải danh sách sản phẩm..."));
  assert.equal(h.button("Sau").props.disabled, true);
  resolve({ items: [], meta: { total: 0, total_pages: 1 } }); await h.settle();
  assert.ok(texts(h).includes("Không tìm thấy sản phẩm."));
  assert.ok(h.byId("product-list-search")); assert.ok(h.byId("product-list-status"));
  assert.equal(h.rows().length, 0);
  h.unmount();
});

test("responsive CSS preserves all cells, wrapping and inline touch-size actions", () => {
  const block = css.slice(css.indexOf(".product-management-container {"), css.indexOf(".transaction-history-grid-header {"));
  assert.match(block, /@container product-management \(min-width: 1000px\)/);
  assert.match(block, /grid-template-areas: "image name category price stock status actions"/);
  assert.match(block, /"image name name"/);
  assert.match(block, /flex-wrap: nowrap/);
  assert.match(block, /overflow-wrap: anywhere/);
  assert.doesNotMatch(block, /text-overflow|white-space: nowrap|position: sticky|position: fixed/);
  const listMarkup = source.slice(source.indexOf("  return (\n    <section")).split("      {isModalOpen && (")[0];
  assert.doesNotMatch(listMarkup, /line-clamp|text-ellipsis|shadow|h-9/);
  assert.match(listMarkup, /id="product-list-search"[\s\S]*?text-base/);
  assert.match(listMarkup, /id="product-list-status"[\s\S]*?text-base/);
});

test("wide desktop caps product identity at 42% without narrowing utility columns", () => {
  const wide = css.match(/@container product-management \(min-width: 1200px\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(wide);
  assert.match(wide, /\.product-management-grid-header,\s*\.product-management-row/);
  assert.match(wide, /grid-template-columns: 48px 42% minmax\(96px, 1fr\) 112px 48px 104px 148px;/);
  // This override changes only tracks, not row density, mobile rules or alignment.
  assert.equal((wide.match(/;/g) || []).length, 1);
  for (const containerWidth of [1200, 1366, 1920, 2560]) {
    const contentWidth = containerWidth - 32; // Existing px-4 row/header gutters.
    const nameWidth = contentWidth * 0.42;
    const categoryWidth = contentWidth - nameWidth - (48 + 112 + 48 + 104 + 148) - 6 * 12;
    assert.ok(categoryWidth >= 96, `category fits at ${containerWidth}px`);
    assert.ok(nameWidth >= 220);
  }
});
