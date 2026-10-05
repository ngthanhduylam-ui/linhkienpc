import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getInventoryNoteSuggestions } from "./inventoryNoteSuggestions.js";

const groups = [
  { note: "bh 8.27 Viết Sơn", note_key: "BH8.27VIẾTSƠN", quantity: 2 },
  { note: "BH 12.28", quantity: 3 },
  { note: "BH 1.29", quantity: 1 }
];
const source = readFileSync(new URL("../pages/InventoryCheckPage.jsx", import.meta.url), "utf8");
const functionSource = (name) => {
  const match = source.match(new RegExp(`^  (?:async )?function ${name}\\([\\s\\S]*?^  }`, "m"));
  assert.ok(match, `page handler ${name} exists`);
  return match[0];
};
const handlerNames = [
  "closeAdjustNoteSuggestions", "openAdjustNoteSuggestions", "handleAdjustNoteChange",
  "selectAdjustNoteSuggestion", "handleAdjustNoteKeyDown", "handleAdjustNotePointerDown", "handleQuantitySubmit", "handleNoteMoveSubmit"
];

// Execute the page's actual event handlers with controlled state/API callbacks.
// JSX wiring is checked separately; this does not claim to simulate browser event dispatch.
function harness(noteGroups = groups) {
  const detailRequestSequenceRef = { current: 0 };
  const state = {
    isAdjustNoteOpen: false, activeAdjustNoteIndex: -1, adjustNoteGroup: "",
    adjustmentType: "INCREASE", isLoadingDetail: false, isSubmitting: false,
    adjustQuantity: "1", adjustReason: "", detail: { product: { sku: "test.cpu" }, note_groups: noteGroups },
    selectedSku: "test.cpu", error: "", success: "", moveToNote: "", moveFieldErrors: {}
  };
  const setters = Object.fromEntries(Object.keys(state).map((key) => [
    `set${key[0].toUpperCase()}${key.slice(1)}`,
    (value) => { state[key] = typeof value === "function" ? value(state[key]) : value; }
  ]));
  function render(extra = {}) {
    const adjustNoteSuggestions = getInventoryNoteSuggestions(state.detail?.note_groups, state.adjustNoteGroup);
    const values = { ...state, ...setters, detailRequestSequenceRef, adjustNoteSuggestions, ...extra };
    const visibility = source.match(/const showAdjustNoteSuggestions = ([\s\S]*?);/)[1];
    values.showAdjustNoteSuggestions = new Function(...Object.keys(values), `return ${visibility};`)(...Object.values(values));
    const actions = new Function(...Object.keys(values),
      `${handlerNames.map(functionSource).join("\n")}\nreturn {${handlerNames.join(",")}};`)(...Object.values(values));
    return { ...actions, suggestions: adjustNoteSuggestions, visible: values.showAdjustNoteSuggestions };
  }
  return { state, render, setters, detailRequestSequenceRef };
}

function detailHarness() {
  const h = harness();
  const requests = [];
  const values = {
    ...h.setters, ...h.render(), detailRequestSequenceRef: h.detailRequestSequenceRef,
    getInventoryCheckProduct: (sku) => new Promise((resolve, reject) => requests.push({ sku, resolve, reject })),
    setSearchInput() {}, setDebouncedSearch() {}, setProducts() {},
    setHasFocusedProductSearch() {}, setIsProductResultsOpen() {},
    window: { setTimeout() {} }
  };
  const names = ["resetQuantityForm", "loadProductDetail", "handleClearSearch"];
  const actions = new Function(...Object.keys(values),
    `${names.map(functionSource).join("\n")}\nreturn {${names.join(",")}};`)(...Object.values(values));
  return { ...h, ...actions, requests };
}

const productDetail = (sku) => ({ product: { sku }, note_groups: [{ note: `BH ${sku}` }] });

function event(properties = {}) {
  return { prevented: false, preventDefault() { this.prevented = true; }, ...properties };
}

test("focus/click opens current-product suggestions; empty groups never show a dropdown", () => {
  const h = harness();
  h.render().openAdjustNoteSuggestions();
  assert.equal(h.render().visible, true);
  assert.deepEqual(h.render().suggestions, groups.map((group) => group.note));
  const empty = harness([]);
  empty.render().openAdjustNoteSuggestions();
  assert.equal(empty.render().visible, false);
  assert.match(source, /onFocus=\{openAdjustNoteSuggestions\}/);
  assert.match(source, /onClick=\{openAdjustNoteSuggestions\}/);
});

test("excludes no-note entries and deduplicates by case/whitespace without rewriting display text", () => {
  assert.deepEqual(getInventoryNoteSuggestions([
    ...groups, { note: " BH  8.27 VIẾT SƠN " }, { note: "bh12.28" },
    { note: "" }, { note: null }, { note: "   " }, null,
    { note: "Không ghi chú" }, { note: "__NO_NOTE__" }, { note: "ignored", is_no_note: true },
    { note: "  Bao  test 7 ngày  " }
  ]), [...groups.map((group) => group.note), "Bao  test 7 ngày"]);
  assert.deepEqual(getInventoryNoteSuggestions(null), []);
});

test("substring matching is case-insensitive and typing/selection preserve original casing", () => {
  const h = harness();
  h.render().handleAdjustNoteChange({ target: { value: "8.27" } });
  assert.deepEqual(h.render().suggestions, ["bh 8.27 Viết Sơn"]);
  assert.equal(h.state.adjustNoteGroup, "8.27");
  assert.deepEqual(getInventoryNoteSuggestions(groups, "viẾt sơn"), ["bh 8.27 Viết Sơn"]);
  h.render().selectAdjustNoteSuggestion(h.render().suggestions[0]);
  assert.equal(h.state.adjustNoteGroup, "bh 8.27 Viết Sơn");
  assert.equal(h.render().visible, false);
  assert.equal(h.state.activeAdjustNoteIndex, -1);
  assert.match(source, /onClick=\{\(\) => selectAdjustNoteSuggestion\(note\)\}/);
});

test("free input remains unchanged; Enter without an active option keeps normal form submission", () => {
  const h = harness();
  h.render().handleAdjustNoteChange({ target: { value: "  Bao  test mới  " } });
  assert.equal(h.state.adjustNoteGroup, "  Bao  test mới  ");
  assert.equal(h.render().visible, false);
  const enter = event({ key: "Enter" });
  h.render().handleAdjustNoteKeyDown(enter);
  assert.equal(enter.prevented, false);
});

test("arrows select an option, Enter accepts it without submitting, Escape/Tab close", () => {
  const h = harness();
  h.render().handleAdjustNoteKeyDown(event({ key: "ArrowDown" }));
  assert.equal(h.state.activeAdjustNoteIndex, 0);
  h.render().handleAdjustNoteKeyDown(event({ key: "ArrowDown" }));
  assert.equal(h.state.activeAdjustNoteIndex, 1);
  h.render().handleAdjustNoteKeyDown(event({ key: "ArrowUp" }));
  const enter = event({ key: "Enter" });
  h.render().handleAdjustNoteKeyDown(enter);
  assert.equal(enter.prevented, true);
  assert.equal(h.state.adjustNoteGroup, "bh 8.27 Viết Sơn");
  assert.equal(h.render().visible, false);
  for (const key of ["Escape", "Tab"]) {
    h.render().openAdjustNoteSuggestions();
    h.render().handleAdjustNoteKeyDown(event({ key }));
    assert.equal(h.render().visible, false);
  }
});

test("IME composition cannot accidentally select an option", () => {
  const h = harness();
  h.render().handleAdjustNoteKeyDown(event({ key: "ArrowDown" }));
  const composing = event({ key: "Enter", nativeEvent: { isComposing: true } });
  h.render().handleAdjustNoteKeyDown(composing);
  assert.equal(composing.prevented, false);
  assert.equal(h.state.adjustNoteGroup, "");
});

test("product loading closes suggestions; next detail is the only suggestion source", async () => {
  const h = harness();
  h.render().openAdjustNoteSuggestions();
  const next = { product: { sku: "test.ram" }, note_groups: [{ note: "BH RAM riêng" }] };
  const actions = h.render();
  const values = {
    ...actions,
    detailRequestSequenceRef: h.detailRequestSequenceRef,
    setIsLoadingDetail: (value) => { h.state.isLoadingDetail = value; },
    setError() {}, setDetail: (value) => { h.state.detail = value; }, setSelectedSku() {},
    getInventoryCheckProduct: async () => next,
    resetQuantityForm: () => { h.state.adjustNoteGroup = ""; }
  };
  const load = new Function(...Object.keys(values), `${functionSource("loadProductDetail")}\nreturn loadProductDetail;`)(...Object.values(values));
  const pending = load("test.ram");
  assert.equal(h.render().visible, false);
  h.render().openAdjustNoteSuggestions();
  assert.equal(h.state.isAdjustNoteOpen, false);
  await pending;
  assert.equal(h.render().visible, false);
  h.render().openAdjustNoteSuggestions();
  assert.deepEqual(h.render().suggestions, ["BH RAM riêng"]);
});

test("mouse down retains input focus; touch down is not cancelled and option focus does not close", () => {
  const h = harness();
  h.render().openAdjustNoteSuggestions();
  const mouse = event({ pointerType: "mouse", button: 0 });
  h.render().handleAdjustNotePointerDown(mouse);
  assert.equal(mouse.prevented, true);
  const touch = event({ pointerType: "touch", button: 0 });
  h.render().handleAdjustNotePointerDown(touch);
  assert.equal(touch.prevented, false);
  const option = {};
  const outsideSource = source.match(/    function closeOutside\(event\) \{[\s\S]*?^    }/m)[0];
  const closeOutside = new Function("adjustNoteWrapperRef", "closeAdjustNoteSuggestions",
    `${outsideSource}\nreturn closeOutside;`)(
    { current: { contains: (target) => target === option } }, h.render().closeAdjustNoteSuggestions);
  closeOutside({ target: option });
  assert.equal(h.render().visible, true);
  h.render().selectAdjustNoteSuggestion("BH 12.28");
  assert.equal(h.state.adjustNoteGroup, "BH 12.28");
  assert.equal(h.render().visible, false);
  h.render().openAdjustNoteSuggestions();
  closeOutside({ target: {} });
  assert.equal(h.render().visible, false);
  for (const type of ["pointerdown", "focusin"]) {
    assert.ok(source.includes(`document.addEventListener("${type}", closeOutside)`));
    assert.ok(source.includes(`document.removeEventListener("${type}", closeOutside)`));
  }
  const inputBlock = source.split('id="inventory-adjust-note"')[1].split("/>")[0];
  assert.doesNotMatch(inputBlock, /onBlur/);
});

test("quantity submit closes the dropdown and preserves existing payload trimming and free notes", async () => {
  for (const note of ["bh 8.27 Viết Sơn", "  Bao  test mới  ", ""]) {
    const h = harness();
    h.state.adjustNoteGroup = note;
    h.state.adjustQuantity = "2";
    h.state.adjustReason = "  Kiểm kho  ";
    h.render().openAdjustNoteSuggestions();
    let payload;
    const result = { ...h.state.detail, adjustment: { current_total_quantity: 5 } };
    await h.render({
      setError() {}, setSuccess() {}, syncAdjustedProduct() {},
      getQuantityAdjustLabel: () => "Tăng tồn",
      adjustInventoryQuantity: async (value) => { payload = value; return result; },
      loadProductDetail: async () => result
    }).handleQuantitySubmit(event());
    assert.deepEqual(payload, {
      sku: "test.cpu", adjustment_type: "INCREASE", quantity: 2,
      note_group: note.trim(), reason: "Kiểm kho"
    });
    assert.equal(h.render().visible, false);
    assert.equal(h.state.adjustQuantity, "");
  }
});

test("invalid quantity still fails validation and closes suggestions without submitting", async () => {
  const h = harness();
  h.state.adjustQuantity = "0";
  h.render().openAdjustNoteSuggestions();
  let error;
  await h.render({
    setError: (value) => { error = value; }, setSuccess() {},
    adjustInventoryQuantity: () => assert.fail("must not submit")
  }).handleQuantitySubmit(event());
  assert.equal(error, "Số lượng điều chỉnh phải là số nguyên dương.");
  assert.equal(h.render().visible, false);
});

test("race: B resolves before A; stale A cannot replace B or reset B's form/suggestions", async () => {
  const h = detailHarness();
  const a = h.loadProductDetail("A");
  const b = h.loadProductDetail("B");
  h.requests[1].resolve(productDetail("B"));
  await b;
  h.state.adjustQuantity = "3";
  h.render().openAdjustNoteSuggestions();
  const before = structuredClone(h.state);
  h.requests[0].resolve(productDetail("A"));
  assert.equal(await a, null);
  assert.deepEqual(h.state, before);
  assert.equal(h.state.detail.product.sku, "B");
  assert.equal(h.state.selectedSku, "B");
  assert.deepEqual(h.render().suggestions, ["BH B"]);
});

for (const outcome of ["resolve", "reject"]) {
  test(`race: clear invalidates pending A (${outcome}) and prevents restoring detail or error`, async () => {
    const h = detailHarness();
    h.render().openAdjustNoteSuggestions();
    const a = h.loadProductDetail("A");
    h.handleClearSearch();
    const cleared = structuredClone(h.state);
    h.requests[0][outcome](outcome === "resolve" ? productDetail("A") : new Error("old A failure"));
    await a;
    assert.deepEqual(h.state, cleared);
    assert.equal(h.state.detail, null);
    assert.equal(h.state.selectedSku, "");
    assert.equal(h.state.isLoadingDetail, false);
    assert.equal(h.render().visible, false);
    assert.deepEqual(h.render().suggestions, []);
  });

  test(`race: stale A ${outcome} cannot clear B's loading or change its error`, async () => {
    const h = detailHarness();
    const a = h.loadProductDetail("A");
    const b = h.loadProductDetail("B");
    const pendingB = structuredClone(h.state);
    h.requests[0][outcome](outcome === "resolve" ? productDetail("A") : new Error("old A failure"));
    await a;
    assert.deepEqual(h.state, pendingB);
    assert.equal(h.state.isLoadingDetail, true);
    h.requests[1].resolve(productDetail("B"));
    await b;
    assert.equal(h.state.isLoadingDetail, false);
    assert.equal(h.state.detail.product.sku, "B");
  });
}

test("race: latest B error remains visible after stale A succeeds", async () => {
  const h = detailHarness();
  const a = h.loadProductDetail("A");
  const b = h.loadProductDetail("B");
  h.requests[1].reject(new Error("current B failure"));
  await b;
  const failedB = structuredClone(h.state);
  h.requests[0].resolve(productDetail("A"));
  await a;
  assert.deepEqual(h.state, failedB);
  assert.equal(h.state.error, "current B failure");
  assert.equal(h.state.detail, null);
  assert.equal(h.state.isLoadingDetail, false);
});

test("race: save-refresh fallback cannot restore A after selecting B", async () => {
  const h = detailHarness();
  let signalRefresh;
  const refreshStarted = new Promise((resolve) => { signalRefresh = resolve; });
  const saving = h.render({
    adjustInventoryQuantity: async () => productDetail("A"),
    loadProductDetail: (...args) => {
      const pending = h.loadProductDetail(...args);
      signalRefresh();
      return pending;
    },
    syncAdjustedProduct: () => assert.fail("stale refresh must not apply the fallback"),
    getQuantityAdjustLabel: () => "Tăng tồn"
  }).handleQuantitySubmit(event());
  await refreshStarted;
  const b = h.loadProductDetail("B");
  h.requests[1].resolve(productDetail("B"));
  await b;
  h.requests[0].resolve(productDetail("A"));
  await saving;
  assert.equal(h.state.detail.product.sku, "B");
  assert.deepEqual(h.render().suggestions, ["BH B"]);
  assert.equal(h.state.error, "");
  assert.equal(h.state.success, "");
  assert.equal(h.state.isSubmitting, false);
});

test("race: save response after selection changed cannot start an old-product refresh", async () => {
  const h = detailHarness();
  let finishSave;
  const saving = h.render({
    adjustInventoryQuantity: () => new Promise((resolve) => { finishSave = resolve; }),
    loadProductDetail: () => assert.fail("must not refresh the old selection")
  }).handleQuantitySubmit(event());
  const b = h.loadProductDetail("B");
  h.requests[0].resolve(productDetail("B"));
  await b;
  finishSave(productDetail("A"));
  await saving;
  assert.equal(h.state.detail.product.sku, "B");
  assert.equal(h.state.error, "");
  assert.equal(h.state.isSubmitting, false);
});

for (const outcome of ["resolve", "reject"]) {
  test(`race: note-move refresh ${outcome} cannot restore old detail or errors after selecting B`, async () => {
    const h = detailHarness();
    h.state.moveToNote = "BH mới";
    let completeRefresh;
    let signalRefresh;
    const refreshStarted = new Promise((resolve) => { signalRefresh = resolve; });
    const moving = h.render({
      selectedAdjustGroup: { note: "BH cũ", quantity: 2 },
      normalizeNoteValue: (value) => value.trim().toUpperCase().replace(/\s+/g, ""),
      moveInventoryNoteGroup: async () => productDetail("A"),
      getInventoryCheckProduct: () => new Promise((resolve, reject) => {
        completeRefresh = outcome === "resolve" ? resolve : reject;
        signalRefresh();
      })
    }).handleNoteMoveSubmit();
    await refreshStarted;
    const b = h.loadProductDetail("B");
    h.requests[0].resolve(productDetail("B"));
    await b;
    completeRefresh(outcome === "resolve" ? productDetail("A") : new Error("old refresh failure"));
    await moving;
    assert.equal(h.state.detail.product.sku, "B");
    assert.deepEqual(h.render().suggestions, ["BH B"]);
    assert.equal(h.state.error, "");
    assert.equal(h.state.success, "");
    assert.equal(h.state.isSubmitting, false);
  });
}
