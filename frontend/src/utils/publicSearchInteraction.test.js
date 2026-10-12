import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transformSync } from "esbuild";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pageSource = read("../pages/PublicSearchPage.jsx");
const headerSource = read("../components/public/PublicCatalogueHeader.jsx");
const dropdownSource = read("../components/public/PublicSearchDropdown.jsx");
const product = { productId: 760, name: "MSI 760", totalQuantity: 3 };

// Execute the real JSX handlers with a loaded-search fixture. This models event
// ordering/unmounting, not browser focus synthesis or a real Safari touch tap.
function component(source, name, seeds, dependencies, win, events) {
  const names = [...source.matchAll(/const \[([^,]+),\s*\w+\] = useState\(/g)].map((match) => match[1]);
  const states = new Map();
  const refs = [];
  const effects = [];
  let stateIndex = 0;
  let refIndex = 0;
  const hooks = {
    useState(initial) {
      const key = names[stateIndex++];
      assert.ok(key, "state fixture tracks every real useState declaration");
      if (!states.has(key)) states.set(key, key in seeds ? seeds[key] : typeof initial === "function" ? initial() : initial);
      return [states.get(key), (value) => {
        states.set(key, typeof value === "function" ? value(states.get(key)) : value);
        events.push({ type: "state", key, value: states.get(key) });
      }];
    },
    useRef(initial) {
      const index = refIndex++;
      return refs[index] ||= { current: initial };
    },
    useEffect(effect) { effects.push(effect); }
  };
  const createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
  const require = (id) => id === "react" ? hooks : dependencies(id);
  const module = { exports: {} };
  const code = transformSync(source, { loader: "jsx", format: "cjs", jsxFactory: "createElement", jsxFragment: "Fragment" }).code;
  new Function("require", "module", "exports", "createElement", "Fragment", "window", "localStorage", "document", code)(
    require, module, module.exports, createElement, "Fragment", win, win.localStorage, win.document
  );
  return {
    states, effects,
    render(props = {}) {
      stateIndex = 0;
      refIndex = 0;
      effects.length = 0;
      return module.exports[name](props);
    }
  };
}

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  return [node, ...(node.children || []).flatMap(nodes)];
}

function setup() {
  const events = [];
  function eventTarget() {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type, listener) {
        if (listeners.get(type) === listener) listeners.delete(type);
      }
    };
  }
  const win = {
    ...eventTarget(),
    document: eventTarget(),
    history: {
      state: { public_catalogue_view: { view: "home", input: "msi 760" } },
      replaceState(state) { this.state = state; events.push({ type: "replace", state }); },
      pushState(state) { this.state = state; events.push({ type: "navigate", state }); }
    },
    localStorage: { getItem: () => null, setItem() {} },
    navigator: {},
    scrollTo() {},
    setTimeout() { throw new Error("Selection must not use a timer"); }
  };
  const symbols = new Proxy({}, { get: (_, key) => key });
  const dependencies = (id) => {
    if (id.includes("publicSearchResultsView")) return { loadPublicResultViewMode: () => "card" };
    if (id.includes("publicSearchPagination")) return { PUBLIC_SEARCH_PAGE_SIZE: 20, getPublicSearchLoadMoreCount: () => 0 };
    if (id.includes("adminPublicNavigation")) return { readAdminReturnLocation: () => null };
    if (id.includes("publicProductPresentation")) return { formatPublicSellingPrice: () => "Liên hệ" };
    if (id.includes("PublicSearchDropdown")) return { PublicSearchDropdown: "PublicSearchDropdown", PUBLIC_SEARCH_LISTBOX_ID: "public-live-search-results" };
    if (id.includes("service")) return new Proxy({}, { get: () => () => { throw new Error("No API during interaction"); } });
    return symbols;
  };
  const page = component(pageSource, "PublicSearchPage", {
    liveSearchProducts: [product], liveSearchTotal: 1, isDropdownOpen: true, isSearchFocused: true
  }, dependencies, win, events);
  const header = component(headerSource, "PublicCatalogueHeader", {}, dependencies, win, events);
  const dropdown = component(dropdownSource, "PublicSearchDropdown", {}, dependencies, win, events);
  let props;
  let form;
  let option;
  function render() {
    props = nodes(page.render()).find((node) => node.type === "PublicCatalogueHeader").props;
    form = nodes(header.render(props)).find((node) => node.type === "form");
    const popup = nodes(form).find((node) => node.type === "PublicSearchDropdown");
    option = popup ? nodes(dropdown.render(popup.props)).find((node) => node.props.role === "option") : null;
  }
  render();
  return {
    page, win, events, render,
    props: () => props,
    option: () => option,
    mountOutsideDismiss() {
      // Run the real listener effect only; network effects are outside this
      // loaded-search interaction fixture. Keep its real cleanup for assertions.
      const effect = page.effects.find((callback) => callback.toString().includes("handleOutsidePointerDown"));
      assert.ok(effect);
      const insideTarget = {};
      props.searchFormRef.current = { contains: (target) => target === insideTarget };
      const cleanup = effect();
      return {
        insideTarget, cleanup,
        pointerDown(target, pointerType) {
          const listener = win.document.listeners.get("pointerdown");
          assert.equal(typeof listener, "function");
          listener({ target, pointerType });
          render();
        }
      };
    },
    blur(relatedTarget, inside = false) {
      form.props.onBlur({ currentTarget: { contains: (target) => Boolean(target) && inside }, relatedTarget });
      render(); // Flush blur's React update before click, reproducing the lost target.
    },
    click() { option?.props.onClick(); render(); },
    key(key) {
      let prevented = false;
      props.onInputKeyDown({ key, currentTarget: { value: "msi 760" }, preventDefault() { prevented = true; } });
      render();
      return prevented;
    }
  };
}

function assertSelectedOnce(h) {
  const navigations = h.events.filter((event) => event.type === "navigate");
  assert.equal(navigations.length, 1);
  assert.deepEqual(navigations[0].state.public_catalogue_view, {
    view: "search", query: "msi 760", input: "msi 760", result_product_id: 760,
    category_id: null, category_name: ""
  });
  assert.equal(h.page.states.get("selectedSearchProductId"), 760);
  assert.equal(h.page.states.get("isDropdownOpen"), false);
  assert.equal(h.page.states.get("searchInput"), "msi 760");
  const navigateIndex = h.events.findIndex((event) => event.type === "navigate");
  const closeIndex = h.events.findIndex((event) => event.key === "isDropdownOpen" && event.value === false);
  assert.ok(closeIndex > navigateIndex, "selection commits history before closing/resetting dropdown");
}

test("null-relatedTarget blur before touch click keeps result mounted and selects once", () => {
  const h = setup();
  h.blur(null);
  assert.ok(h.option(), "blur must not unmount the pending click target");
  assert.deepEqual(h.page.states.get("liveSearchProducts"), [product]);
  h.click();
  assertSelectedOnce(h);
});

test("mouse focus transfer inside form followed by click preserves existing selection", () => {
  const h = setup();
  h.blur({}, true);
  h.click();
  assertSelectedOnce(h);
});

test("semantic result button uses only click for activation, not parallel pointer/touch handlers", () => {
  const h = setup();
  assert.equal(h.option().type, "button");
  assert.equal(h.option().props.type, "button");
  for (const key of ["onPointerDown", "onPointerUp", "onMouseDown", "onTouchStart", "onTouchEnd"]) {
    assert.equal(h.option().props[key], undefined);
  }
  h.click();
  assertSelectedOnce(h);
});

test("keyboard ArrowDown/Enter selects once and Escape still closes", () => {
  const h = setup();
  assert.equal(h.key("ArrowDown"), true);
  assert.equal(h.page.states.get("activeSearchIndex"), 0);
  assert.equal(h.key("Enter"), true);
  assertSelectedOnce(h);
  const escaped = setup();
  assert.equal(escaped.key("Escape"), true);
  assert.equal(escaped.option(), null);
  assert.equal(escaped.events.some((event) => event.type === "navigate"), false);
});

test("keyboard Enter without active result still performs full search", () => {
  const h = setup();
  h.key("Enter");
  assert.equal(h.win.history.state.public_catalogue_view.view, "search");
  assert.equal(h.win.history.state.public_catalogue_view.result_product_id, null);
  assert.equal(h.win.history.state.public_catalogue_view.query, "msi 760");
});

test("known focus destination outside form still dismisses; inside focus does not", () => {
  const h = setup();
  h.blur({}, true);
  assert.ok(h.option());
  h.blur({}, false);
  assert.equal(h.option(), null);
  assert.equal(h.events.some((event) => event.type === "navigate"), false);
});

test("outside mouse/touch pointerdown dismisses after null blur and cleans up listeners", () => {
  for (const pointerType of ["mouse", "touch"]) {
    const h = setup();
    const outside = h.mountOutsideDismiss();
    h.blur(null);
    assert.ok(h.option());
    outside.pointerDown(outside.insideTarget, pointerType);
    assert.ok(h.option(), "inside pointer must not dismiss");
    outside.pointerDown({}, pointerType);
    assert.equal(h.option(), null);
    assert.equal(h.page.states.get("isDropdownOpen"), false);
    assert.deepEqual(h.page.states.get("liveSearchProducts"), []);
    assert.equal(h.events.some((event) => event.type === "navigate"), false);
    outside.cleanup();
    assert.equal(h.win.document.listeners.size, 0);
    assert.equal(h.win.listeners.size, 0);
  }
});

test("outside-pointer dismissal and existing selected-product lookup remain in place", () => {
  assert.match(pageSource, /if \(!searchFormRef\.current\?\.contains\(event.target\)\) \{\s+closeLiveDropdown\(\{ abort: true \}\)/);
  assert.match(pageSource, /document.addEventListener\("pointerdown", handleOutsidePointerDown\)/);
  assert.match(pageSource, /document.removeEventListener\("pointerdown", handleOutsidePointerDown\)/);
  assert.match(pageSource, /const selectedProductId = Number\(selectedSearchProductId\)/);
  assert.match(pageSource, /const requestedProductId = detailProductId \|\| exactSearchProductId/);
  assert.match(pageSource, /getPublicProductById\(requestedProductId,/);
});
