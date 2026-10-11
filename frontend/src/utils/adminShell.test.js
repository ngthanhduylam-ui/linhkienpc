import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { transformSync } from "esbuild";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const headerSource = read("../components/AdminHeader.jsx");
const sidebarSource = read("../components/AdminSidebar.jsx");
const layoutSource = read("../layouts/AdminLayout.jsx");

// Real component handlers with controlled hooks/timers; no browser, auth or API.
function harness(source, exportName, props = {}, pathname = "/admin/stock-in") {
  let location = { pathname, search: "", hash: "" };
  const slots = [];
  const timers = new Map();
  let cursor = 0;
  let timerId = 0;
  let pending = [];
  let tree;
  let publicReturns = 0;
  let logouts = 0;
  let finishLogout;
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[i].value, (value) => { slots[i].value = typeof value === "function" ? value(slots[i].value) : value; }];
    },
    useRef(value) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: value };
      return slots[i];
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, index) => !Object.is(dep, slots[i].deps[index]))) {
        pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      }
    }
  };
  function createElement(type, props, ...children) {
    const flat = children.flat(Infinity);
    if (typeof type === "function") return type({ ...props, children: flat.length === 1 ? flat[0] : flat });
    return { type, props: props || {}, children: flat };
  }
  const win = {
    location: { href: "" },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  const require = (id) => {
    if (id === "react") return hooks;
    if (id === "react-router-dom") return {
      useLocation: () => location,
      Outlet: "Outlet",
      Link: ({ children, ...props }) => createElement("a", props, children),
      NavLink: ({ children, className, to, ...props }) => {
        const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
        return createElement("a", { ...props, to, className: className({ isActive }), "aria-current": isActive ? "page" : undefined }, children({ isActive }));
      }
    };
    if (id.includes("ptc-logo")) return "logo.png";
    if (id.includes("adminPublicNavigation")) return { saveAdminReturnLocation() { publicReturns++; } };
    if (id.includes("AdminSidebar")) return { AdminSidebar: "AdminSidebar" };
    if (id.includes("AdminHeader")) return { AdminHeader: "AdminHeader" };
    if (id.includes("QuickNoteWidget")) return { QuickNoteWidget: "QuickNoteWidget" };
    if (id.includes("AuthContext")) return { useAuth: () => ({ admin: { username: "Local Admin" }, logout: () => {
      logouts++;
      return new Promise((resolve) => { finishLogout = resolve; });
    } }) };
    throw new Error(`Unexpected dependency: ${id}`);
  };
  const module = { exports: {} };
  const code = transformSync(source, { loader: "jsx", format: "cjs", jsxFactory: "createElement", jsxFragment: "Fragment" }).code;
  new Function("require", "module", "exports", "createElement", "Fragment", "window", code)(require, module, module.exports, createElement, "Fragment", win);
  function render() {
    cursor = 0;
    pending = [];
    tree = module.exports[exportName](props);
    pending.forEach((effect) => effect());
    return tree;
  }
  function nodes(node = tree) {
    if (!node || typeof node !== "object") return [];
    return [node, ...node.children.flatMap((child) => child && typeof child === "object" ? nodes(child) : [])];
  }
  render();
  return {
    render, nodes, exports: module.exports, timers, win,
    navigate(pathname) { location = { ...location, pathname }; render(); render(); },
    flushTimers() { const waiting = [...timers.values()]; timers.clear(); waiting.forEach(({ fn }) => fn()); render(); },
    unmount() { slots.forEach((slot) => slot.cleanup?.()); },
    publicReturns: () => publicReturns, logouts: () => logouts, finishLogout: () => finishLogout()
  };
}

const find = (h, predicate) => h.nodes().find(predicate);

test("header supplies section context for nested routes without duplicating page headings", () => {
  const h = harness(headerSource, "AdminHeader", {});
  const context = h.exports.getAdminShellContext;
  for (const path of ["/admin/stock-in", "/admin/inventory-check", "/admin/products/new", "/admin/products/42/edit", "/admin/stock-in-single"]) {
    assert.equal(context(path), "Quản lý kho");
  }
  assert.equal(context("/admin/customers/42"), "Quản lý bán hàng");
  assert.equal(context("/admin/transaction-history/234"), "Quản lý bán hàng");
  assert.equal(context("/admin/settings/print-template/edit"), "Hệ thống");
  assert.equal(context("/admin/products-other"), "Quản trị hệ thống");
  assert.equal(context("/admin"), "Quản trị hệ thống");
  assert.equal(h.nodes().filter((n) => /^h[1-6]$/.test(n.type)).length, 0);
});

test("header menu/logout actions and pending state remain wired to their callbacks", () => {
  let opened = 0;
  let loggedOut = 0;
  const props = { onOpenMenu: () => opened++, onLogout: () => loggedOut++, adminName: "A".repeat(200), isLoggingOut: false };
  const h = harness(headerSource, "AdminHeader", props);
  find(h, (n) => n.props["aria-label"] === "Mở menu").props.onClick();
  find(h, (n) => n.type === "button" && n.children.includes("Đăng xuất")).props.onClick();
  assert.equal(opened, 1);
  assert.equal(loggedOut, 1);
  assert.ok(find(h, (n) => n.props.title === props.adminName).props.className.includes("truncate"));
  props.isLoggingOut = true;
  h.render();
  assert.equal(find(h, (n) => n.children.includes("Đang đăng xuất...")).props.disabled, true);
});

test("sidebar preserves every destination, group and nested active styling", () => {
  const h = harness(sidebarSource, "AdminSidebar", { onClose() {} }, "/admin/products/42/edit");
  assert.deepEqual(h.nodes().filter((n) => n.type === "a").map((n) => n.props.to), [
    "/", "/admin/quick-notes", "/admin/stock-in", "/admin/stock-out", "/admin/inventory-check", "/admin/products",
    "/admin/online-listing", "/admin/suppliers", "/admin/customers", "/admin/transaction-history", "/admin/settings/sku-rules"
  ]);
  assert.equal(find(h, (n) => n.props["aria-current"] === "page").props.to, "/admin/products");
  for (const path of ["/admin/stock-in", "/admin/inventory-check", "/admin/customers", "/admin/settings/sku-rules"]) {
    h.navigate(path);
    const active = find(h, (n) => n.props["aria-current"] === "page");
    assert.equal(active.props.to, path);
    assert.match(active.props.className, /bg-brand-50.*font-semibold.*text-brand-700/);
    assert.match(active.props.className, /focus-visible:ring-2/);
  }
  for (const title of ["Quản lý kho", "Quản lý bán hàng", "Hệ thống"]) {
    assert.ok(find(h, (n) => n.children.includes(title)));
  }
});

test("desktop rail keeps hover/focus expansion, 150ms collapse and timer cleanup", () => {
  const h = harness(sidebarSource, "AdminSidebar", { desktopAutoCollapse: true, onClose() {} });
  const aside = () => find(h, (n) => n.type === "aside");
  assert.match(aside().props.className, /md:w-\[72px\]/);
  aside().props.onPointerEnter(); h.render();
  assert.match(aside().props.className, /md:w-72/);
  aside().props.onFocusCapture();
  aside().props.onPointerLeave();
  assert.equal(h.timers.size, 0);
  aside().props.onBlurCapture({ currentTarget: { contains: () => true }, relatedTarget: {} });
  assert.equal(h.timers.size, 0);
  aside().props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null });
  assert.equal([...h.timers.values()][0].delay, 150);
  h.flushTimers();
  assert.match(aside().props.className, /md:w-\[72px\]/);
  aside().props.onFocusCapture(); h.render();
  assert.match(aside().props.className, /md:w-72/);
  h.navigate("/admin/inventory-check");
  assert.match(aside().props.className, /md:w-\[72px\]/);
  aside().props.onPointerEnter(); aside().props.onPointerLeave();
  assert.equal(h.timers.size, 1);
  h.unmount();
  assert.equal(h.timers.size, 0);
});

test("mobile backdrop/navigation/public lookup keep close behavior and full branding", () => {
  let closes = 0;
  const props = { desktopAutoCollapse: false, isOpen: true, onClose: () => closes++ };
  const h = harness(sidebarSource, "AdminSidebar", props);
  const aside = () => find(h, (n) => n.type === "aside");
  assert.match(aside().props.className, /w-72/);
  assert.doesNotMatch(aside().props.className, /-translate-x-full/);
  assert.ok(find(h, (n) => n.children.includes("VI TÍNH PHƯỚC TÀI")));
  find(h, (n) => n.type === "div" && n.props.onClick).props.onClick();
  find(h, (n) => n.props.to === "/admin/stock-in").props.onClick();
  find(h, (n) => n.props.to === "/").props.onClick();
  assert.equal(closes, 3);
  assert.equal(h.publicReturns(), 1);
  props.isOpen = false; h.render();
  assert.match(aside().props.className, /-translate-x-full/);
});

test("AdminLayout keeps menu and async logout flow, main padding/cap and sidebar offset", async () => {
  const h = harness(layoutSource, "AdminLayout");
  const header = () => find(h, (n) => n.type === "AdminHeader");
  header().props.onOpenMenu(); h.render();
  assert.equal(find(h, (n) => n.type === "AdminSidebar").props.isOpen, true);
  const pending = header().props.onLogout(); h.render();
  assert.equal(header().props.isLoggingOut, true);
  assert.equal(h.logouts(), 1);
  assert.equal(h.win.location.href, "");
  h.finishLogout(); await pending; h.render();
  assert.equal(h.win.location.href, "/admin/login");
  assert.equal(header().props.isLoggingOut, false);
  assert.match(find(h, (n) => n.type === "main").props.className, /max-w-7xl p-4 sm:p-6/);
  assert.ok(find(h, (n) => n.props.className?.includes("md:pl-[72px]")));
});

test("shell wide header follows only Stock In opt-in; page content styles are not generalized", () => {
  const css = read("../index.css");
  assert.match(css, /\.admin-page-container:has\(> \.stock-in-workspace\)\s*\{\s*max-width: 100%;/);
  assert.match(css, /\.admin-shell:has\(\.admin-page-container > \.stock-in-workspace\) \.admin-topbar-inner\s*\{\s*max-width: 100%;/);
  assert.doesNotMatch(css, /\.admin-shell\s+h[1-6]/);
  assert.match(headerSource, /h-14/);
  assert.doesNotMatch(headerSource, /backdrop-blur|bg-white\/95|<h1/);
  assert.match(sidebarSource, /motion-reduce:transition-none/);
});

test("router retains ProtectedRoute, shell pages, standalone POS and print without wrapping them", () => {
  const router = read("../router.jsx");
  assert.match(router, /element: <ProtectedRoute \/>/);
  const shellStart = router.indexOf("element: withSuspense(<AdminLayout />)");
  assert.ok(router.indexOf('path: "stock-out", element: withSuspense(<StockOutBulkPage />)') < shellStart);
  assert.ok(router.indexOf('path: "transaction-history/:voucherId/print"') < shellStart);
  for (const path of ["stock-in", "stock-in-single", "inventory-check", "products", "customers", "suppliers", "online-listing"]) {
    assert.ok(router.indexOf(`path: "${path}"`) > shellStart);
  }
  assert.match(router, /index: true, element: <Navigate to="\/admin\/stock-in" replace/);
});
