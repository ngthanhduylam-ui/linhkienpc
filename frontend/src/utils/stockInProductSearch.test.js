import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transformSync } from "esbuild";
import * as services from "../services/inventoryOperations.service.js";

const source = readFileSync(new URL("../pages/StockInBulkPage.jsx", import.meta.url), "utf8");
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
const target = {
  id: 1, name: "Màn hình AOC 24G50Z/71 (24 inch) IPS", sku: "lcd.aoc.24g50z.71",
  is_active: true, total_quantity: 1, note_groups: [{ note: "bh 3 tháng", quantity: 1 }]
};
const zeroStock = { ...target, id: 2, sku: "lcd.aoc.zero", total_quantity: 0 };
const database = [target, zeroStock, ...Array.from({ length: 350 }, (_, i) => ({
  id: i + 100, name: `RAM fixture ${i}`, sku: `ram.fixture.${i}`, is_active: true, total_quantity: 2
}))];

// HTTP fixture searches BEFORE paging, as the existing Admin SQL does. Service
// and page code are real; backend SQL semantics have separate service tests.
function server(rows = database, intercept) {
  const requests = [];
  globalThis.fetch = async (url) => {
    const request = new URL(url);
    requests.push(request);
    if (request.pathname.endsWith("/categories")) return Response.json({ data: [] });
    assert.equal(request.pathname, "/api/v1/admin/products");
    const q = request.searchParams.get("q") || "";
    if (q && intercept) return intercept(request);
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = rows.filter((row) => row.is_active && tokens.every((token) => (
      `${row.name} ${row.sku}`.toLowerCase().includes(token)
    )) && (request.searchParams.get("in_stock") !== "true" || row.total_quantity > 0))
      .sort((a, b) => b.id - a.id);
    const page = Number(request.searchParams.get("page"));
    const limit = Number(request.searchParams.get("limit"));
    return Response.json({ data: matches.slice((page - 1) * limit, page * limit), meta: {
      page, limit, total: matches.length, total_pages: Math.max(1, Math.ceil(matches.length / limit))
    } });
  };
  return requests;
}

function harness() {
  const slots = [];
  const timers = new Map();
  let cursor = 0;
  let dirty = true;
  let tree;
  let pending = [];
  let timerId = 0;
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
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, index) => !Object.is(dep, slots[i].deps[index]))) {
        pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    }
  };
  const require = (id) => {
    if (id === "react") return react;
    if (id.includes("inventoryOperations")) return services;
    if (id === "react-router-dom") return { Link: "Link", useNavigate: () => () => {} };
    if (id.includes("recentItems")) return { readRecentItems: () => [], filterRecentItemsByAvailable: () => [], saveRecentItem: (_, p) => [p] };
    if (id.includes("SupplierSelector")) return { SupplierSelector: "SupplierSelector" };
    if (id.includes("StockInNoteInput")) return { StockInNoteInput: "StockInNoteInput" };
    throw new Error(`Unexpected import: ${id}`);
  };
  const win = {
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); }, localStorage: { setItem() {} }
  };
  const module = { exports: {} };
  const code = transformSync(source, { loader: "jsx", format: "cjs", jsxFactory: "element" }).code;
  new Function("require", "module", "exports", "element", "window", "document", code)(
    require, module, module.exports,
    (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    win, { addEventListener() {}, removeEventListener() {} }
  );
  function nodes(node = tree) {
    return !node || typeof node !== "object" ? [] : [node, ...node.children.flatMap(nodes)];
  }
  const find = (predicate) => nodes().find(predicate);
  function flush() {
    let count = 0;
    while (dirty) {
      assert.ok(count++ < 20, "no render loop");
      dirty = false; cursor = 0; pending = [];
      tree = module.exports.StockInBulkPage();
      pending.forEach((effect) => effect());
    }
  }
  async function settle() {
    for (let i = 0; i < 4; i++) { await new Promise(setImmediate); flush(); }
  }
  flush();
  return {
    nodes, find, flush, settle,
    type(value) {
      find((node) => node.props["aria-label"] === "Tìm theo tên sản phẩm hoặc SKU").props.onChange({ target: { value } });
      flush();
    },
    async debounce() {
      for (const [id, timer] of [...timers]) if (timer.delay === 300) { timers.delete(id); timer.fn(); }
      flush(); await settle();
    },
    results: () => nodes().filter((n) => n.props.className?.split(" ").includes("stock-in-search-result")),
    text: () => nodes().flatMap((n) => n.children.filter((c) => typeof c === "string")).join(" "),
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); }
  };
}

test("Stock In finds AND name/model/SKU beyond first 100 of a large catalogue, including zero stock", async () => {
  const requests = server();
  const h = harness();
  await h.settle();
  assert.equal(requests.filter((r) => r.pathname.endsWith("/products")).length, 1);
  for (const query of ["Aoc 24", "24g50z", target.sku, zeroStock.sku]) {
    h.type(query);
    await h.debounce();
    const rows = h.results();
    assert.ok(rows.length > 0, `${query} must find a product outside preload`);
    const request = requests.at(-1);
    assert.equal(request.searchParams.get("q"), query);
    assert.equal(request.searchParams.get("is_active"), "true");
    assert.notEqual(request.searchParams.get("in_stock"), "true");
    assert.ok(Number(request.searchParams.get("limit")) <= 100);
  }
  h.results()[0].props.onClick(); h.flush();
  const note = h.find((n) => n.type === "StockInNoteInput");
  assert.deepEqual(note.props.groups, zeroStock.note_groups);
  assert.equal(h.find((n) => n.props.type === "number").props.value, "1");
  assert.equal(h.results().length, 0);
  h.unmount();
});

test("multi-token AND does not require a contiguous name substring even inside preload", async () => {
  server([{ ...target, name: "Màn hình AOC Gaming 24G50Z/71" }]);
  const h = harness(); await h.settle();
  h.type("Aoc 24"); await h.debounce();
  assert.equal(h.results().length, 1);
  h.unmount();
});

test("debounce searches only the final query; more results remain reachable via server pages", async () => {
  const requests = server();
  const h = harness(); await h.settle();
  h.type("r"); h.type("ra"); h.type("ram");
  assert.equal(requests.filter((r) => r.searchParams.has("q")).length, 0);
  assert.match(h.text(), /Đang tìm sản phẩm/);
  assert.doesNotMatch(h.text(), /Không tìm thấy/);
  await h.debounce();
  assert.equal(h.results().length, 14);
  assert.equal(requests.filter((r) => r.searchParams.has("q")).length, 1);
  const more = h.find((n) => n.type === "button" && n.children.includes("Xem thêm sản phẩm"));
  more.props.onClick(); h.flush(); await h.settle();
  assert.equal(requests.at(-1).searchParams.get("page"), "2");
  assert.equal(h.results().length, 28);
  assert.equal(new Set(h.results().map((n) => n.props.key)).size, 28);
  h.type("24g50z"); await h.debounce();
  assert.equal(requests.at(-1).searchParams.get("page"), "1");
  assert.equal(h.results().length, 2);
  h.unmount();
});

test("request failure is an error, not an empty match, and retry recovers", async () => {
  const requests = server(database, () => Response.json({ error: { message: "Failed" } }, { status: 500 }));
  const h = harness(); await h.settle();
  h.type("24g50z"); await h.debounce();
  assert.match(h.text(), /Không thể tìm sản phẩm/);
  assert.doesNotMatch(h.text(), /Không tìm thấy/);
  assert.equal(requests.at(-1).searchParams.get("q"), "24g50z");
  server();
  h.find((n) => n.children.includes("Thử lại tìm kiếm")).props.onClick();
  h.flush(); await h.settle();
  assert.equal(h.results().length, 2);
  assert.doesNotMatch(h.text(), /Không thể tìm sản phẩm/);
  h.type("does-not-exist"); await h.debounce();
  assert.match(h.text(), /Không tìm thấy sản phẩm phù hợp/);
  h.unmount();
});

test("old success/error cannot overwrite a new query, clear, or unmounted page", async () => {
  const pending = [];
  server(database, (request) => new Promise((resolve, reject) => pending.push({ request, resolve, reject })));
  const h = harness(); await h.settle();
  h.type("Aoc 24"); await h.debounce();
  h.type("ram"); await h.debounce();
  pending[0].reject(new Error("Old request failed")); await h.settle();
  assert.match(h.text(), /Đang tìm sản phẩm/);
  assert.doesNotMatch(h.text(), /Không thể tìm sản phẩm/);
  pending[1].resolve(Response.json({ data: [database[2]], meta: { total_pages: 1 } }));
  await h.settle();
  assert.equal(h.results()[0].props.key, database[2].id);
  h.type("Aoc 24"); await h.debounce();
  h.type("24g50z"); await h.debounce();
  pending[3].resolve(Response.json({ data: [zeroStock], meta: { total_pages: 1 } })); await h.settle();
  pending[2].resolve(Response.json({ data: [target], meta: { total_pages: 1 } })); await h.settle();
  assert.deepEqual(h.results().map((n) => n.props.key), [zeroStock.id]);
  h.type("new query"); await h.debounce();
  h.find((n) => n.props["aria-label"] === "Xóa tìm kiếm sản phẩm").props.onClick(); h.flush();
  pending[4].resolve(Response.json({ data: [target], meta: { total_pages: 1 } })); await h.settle();
  assert.equal(h.results().length, 0);
  h.type("last query"); await h.debounce(); h.unmount();
  pending[5].resolve(Response.json({ data: [target], meta: { total_pages: 1 } })); await h.settle();
  assert.equal(h.results().length, 0);
});
