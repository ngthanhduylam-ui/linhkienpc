import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transformSync } from "esbuild";
import { getInventoryNoteSuggestions } from "./inventoryNoteSuggestions.js";
import { filterRecentItemsByAvailable } from "./recentItems.js";

const source = readFileSync(new URL("../components/StockInNoteInput.jsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../pages/StockInBulkPage.jsx", import.meta.url), "utf8");
const compiled = transformSync(source, { loader: "jsx", format: "cjs", jsxFactory: "createElement" }).code;
const groups = [{ note: "bh 8.27 Viết Sơn" }, { note: "BH 12.28" }, { note: "BH 1.29" }];
const event = (props = {}) => ({ prevented: false, preventDefault() { this.prevented = true; }, ...props });

// Execute the actual component's handlers/effects with controlled hooks, not a browser
// simulation. Verify JSX event wiring as well as listener cleanup without new dependencies.
function harness(noteGroups = groups, sharedDocument) {
  const listeners = new Map();
  const document = sharedDocument || {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, target) { [...(listeners.get(type) || [])].forEach((fn) => fn({ target })); },
    count() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  };
  const slots = [];
  let cursor = 0;
  let pending = [];
  let tree;
  let fallbackCalls = 0;
  const props = {
    id: "note-row", groups: noteGroups, value: "", inputRef() {},
    onChange(value) { props.value = value; }, onKeyDown() { fallbackCalls++; }
  };
  const hooks = {
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: initial };
      return [slots[i].value, (value) => { slots[i].value = typeof value === "function" ? value(slots[i].value) : value; }];
    },
    useRef(initial) {
      const i = cursor++;
      slots[i] ??= { ref: { current: initial } };
      return slots[i].ref;
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) {
        pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      }
    }
  };
  const createElement = (type, attributes, ...children) => ({ type, props: attributes || {}, children: children.flat().filter(Boolean) });
  const module = { exports: {} };
  new Function("require", "module", "exports", "createElement", "document", compiled)(
    (name) => {
      if (name === "react") return hooks;
      assert.equal(name, "../utils/inventoryNoteSuggestions");
      return { getInventoryNoteSuggestions };
    }, module, module.exports, createElement, document
  );
  function nodes(node = tree) {
    return typeof node === "object" ? [node, ...node.children.flatMap((child) => nodes(child))] : [];
  }
  function render() {
    cursor = 0;
    pending = [];
    tree = module.exports.StockInNoteInput(props);
    tree.props.ref.current = { contains: (target) => target === props.id };
    pending.forEach((effect) => effect());
    return api;
  }
  const api = {
    props, document, render,
    input: () => nodes().find((node) => node.type === "input").props,
    options: () => nodes().filter((node) => node.props.role === "option"),
    visible: () => api.input()["aria-expanded"],
    fallbackCalls: () => fallbackCalls,
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); props.inputRef(null); },
    focus() { api.input().onFocus(); return render(); },
    type(value) { api.input().onChange({ target: { value } }); return render(); },
    key(key, extra = {}) { const e = event({ key, ...extra }); api.input().onKeyDown(e); render(); return e; }
  };
  return render();
}

test("focus/click opens only existing notes; no-note groups never show", () => {
  const h = harness([...groups, { note: null }, { note: " " }, { note: "Không ghi chú" },
    { note: "__NO_NOTE__" }, { note: "ignored", is_no_note: true }, { note: " BH12.28 " }]);
  assert.equal(h.visible(), false);
  h.focus();
  assert.deepEqual(h.options().map((node) => node.children[0]), groups.map((g) => g.note));
  h.key("Escape");
  h.input().onClick();
  assert.equal(h.render().visible(), true);
  for (const empty of [[], undefined, [{ note: "Không ghi chú" }]]) {
    const noNotes = harness(empty === undefined ? [] : empty).focus();
    assert.equal(noNotes.visible(), false);
  }
});

test("case-insensitive substring and duplicate matching preserve display casing", () => {
  const h = harness().type("viẾt sơn");
  assert.equal(h.options().length, 1);
  h.options()[0].props.onClick();
  h.render();
  assert.equal(h.props.value, "bh 8.27 Viết Sơn");
  assert.equal(h.visible(), false);
});

test("each row owns suggestions/value; opening another row closes only the old popup", () => {
  const a = harness();
  a.props.id = "row-a";
  const b = harness([{ note: "Bao test B" }], a.document);
  b.props.id = "row-b";
  a.focus();
  a.document.dispatch("pointerdown", "row-b");
  b.focus();
  assert.equal(a.render().visible(), false);
  assert.deepEqual(b.options().map((n) => n.children[0]), ["Bao test B"]);
  b.options()[0].props.onClick();
  assert.equal(b.render().visible(), false);
  assert.equal(b.props.value, "Bao test B");
  assert.equal(a.props.value, "");
});

test("mouse/touch selection survives internal pointer/focus events; outside closes", () => {
  for (const pointerType of ["mouse", "touch"]) {
    const h = harness().focus();
    const option = h.options()[0];
    const e = event({ pointerType, button: 0 });
    option.props.onPointerDown(e);
    assert.equal(e.prevented, pointerType === "mouse");
    h.document.dispatch("pointerdown", h.props.id);
    h.document.dispatch("focusin", h.props.id);
    assert.equal(h.render().visible(), true);
    assert.equal(h.input().onBlur, undefined);
    option.props.onClick();
    assert.equal(h.render().visible(), false);
    assert.equal(h.props.value, groups[0].note);
    h.focus();
    h.document.dispatch("pointerdown", "outside");
    assert.equal(h.render().visible(), false);
    h.focus();
    h.document.dispatch("focusin", "outside");
    assert.equal(h.render().visible(), false);
  }
});

test("keyboard selection, Escape/Tab and free-text Enter preserve the existing workflow", () => {
  const h = harness().focus();
  assert.equal(h.key("ArrowDown").prevented, true);
  h.key("ArrowDown");
  h.key("ArrowUp");
  assert.equal(h.key("Enter").prevented, true);
  assert.equal(h.props.value, groups[0].note);
  assert.equal(h.fallbackCalls(), 0);
  assert.equal(h.visible(), false);
  h.type("  Bao  test mới  ");
  h.key("Enter");
  assert.equal(h.fallbackCalls(), 1);
  assert.equal(h.props.value, "  Bao  test mới  ");
  h.type("");
  h.key("Enter"); // Visible list, but no active option: still delegates.
  assert.equal(h.fallbackCalls(), 2);
  for (const key of ["Escape", "Tab"]) {
    h.focus();
    h.key(key);
    assert.equal(h.visible(), false);
  }
  h.focus().key("ArrowDown");
  h.key("Enter", { nativeEvent: { isComposing: true } });
  assert.equal(h.props.value, "");
  assert.equal(h.fallbackCalls(), 2);
});

test("row deletion/product replacement cleans listeners and remounts closed with new groups", () => {
  const a = harness().focus();
  assert.equal(a.document.count(), 2);
  a.unmount();
  assert.equal(a.document.count(), 0);
  const b = harness([{ note: "BH product B" }], a.document);
  assert.equal(b.visible(), false);
  assert.deepEqual(b.focus().options().map((n) => n.children[0]), ["BH product B"]);
  b.unmount();
  assert.equal(a.document.count(), 0);
  assert.match(page, /key=\{item.rowId\}/);
  assert.match(page, /<StockInNoteInput\s+key=\{item.product.id\}/);
  assert.match(page, /else delete rowNoteRefs.current\[item.rowId\]/);
});

test("page wires current row groups/update/Enter; recent products use fresh API data", () => {
  assert.match(page, /groups=\{item.product.note_groups\}/);
  assert.match(page, /onChange=\{\(note\) => updateItem\(item.rowId, \{ note \}\)\}/);
  assert.match(page, /onKeyDown=\{\(event\) => handleNoteKeyDown\(event, item.rowId\)\}/);
  assert.match(page, /rowQuantityRefs.current\[rowId\]\?\.focus\(\)/);
  const current = { id: 1, note_groups: groups };
  const recent = filterRecentItemsByAvailable([{ id: 1, note_groups: [{ note: "stale" }] }], [current]);
  assert.equal(recent[0], current);
  assert.doesNotMatch(source, /(?:apiGet|fetch|Request|async|services\/)/);
});

test("existing Stock In save submits free text with only edge trimming, supplier and quantities unchanged", async () => {
  const names = ["validateItems", "handleSubmit"];
  const functions = names.map((name) => {
    const match = page.match(new RegExp(`^  (?:async )?function ${name}\\([\\s\\S]*?^  }`, "m"));
    assert.ok(match);
    return match[0];
  }).join("\n");
  const h = harness().type("  bh  mới  tại shop  ");
  let payload;
  let remaining;
  const noop = () => {};
  const bindings = {
    items: [{ sku: "A", quantity: "2", note: h.props.value }, { sku: "B", quantity: "1", note: "" }],
    isSubmitting: false, selectedSupplier: { id: 7 }, setError: noop, setSuccess: noop,
    setIsSubmitting: noop, setSelectedSupplier: noop, setSearchInput: noop, setDebouncedSearch: noop,
    setItems(value) { remaining = value; }, reloadProducts: async () => {},
    bulkStockInRequest: async (value) => { payload = value; return {}; }, window: { setTimeout: noop }
  };
  const submit = new Function(...Object.keys(bindings), `${functions}; return handleSubmit;`)(...Object.values(bindings));
  await submit(event());
  assert.deepEqual(payload, { supplier_id: 7, items: [
    { sku: "A", quantity: 2, note: "bh  mới  tại shop" }, { sku: "B", quantity: 1, note: undefined }
  ] });
  assert.deepEqual(remaining, []);
});
