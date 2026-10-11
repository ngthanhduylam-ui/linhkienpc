import { useLocation } from "react-router-dom";

// Presentation context only: routing, permissions and page titles stay with
// their existing owners. Match path segments so lookalike URLs do not match.
export function getAdminShellContext(pathname) {
  const groups = [
    ["Hệ thống", ["/admin/settings"]],
    ["Quản lý bán hàng", ["/admin/online-listing", "/admin/suppliers", "/admin/customers", "/admin/transaction-history"]],
    ["Quản lý kho", ["/admin/quick-notes", "/admin/stock-in", "/admin/stock-in-single", "/admin/stock-out-single", "/admin/inventory-check", "/admin/products"]]
  ];
  return groups.find(([, paths]) => paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)))?.[0]
    || "Quản trị hệ thống";
}

export function AdminHeader({ onOpenMenu, adminName, onLogout, isLoggingOut }) {
  const { pathname } = useLocation();
  const context = getAdminShellContext(pathname);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="admin-topbar-inner mx-auto flex h-14 w-full min-w-0 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 md:hidden"
            onClick={onOpenMenu}
            aria-label="Mở menu"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex min-w-0 items-center gap-3" aria-label="Ngữ cảnh quản trị">
            <span className="hidden shrink-0 border-r border-slate-200 pr-3 text-xs font-medium text-slate-500 sm:inline">Quản trị</span>
            <p className="truncate text-sm font-semibold text-slate-700" title={context}>{context}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden max-w-40 truncate text-xs font-medium text-slate-500 sm:block" title={adminName || "Admin"}>
            {adminName || "Admin"}
          </span>
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="min-h-11 shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10"
          >
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </div>
      </div>
    </header>
  );
}
