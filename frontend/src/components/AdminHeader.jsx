export function AdminHeader({ onOpenMenu, adminName, onLogout, isLoggingOut }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 md:hidden"
            onClick={onOpenMenu}
            aria-label="Mở menu"
          >
            ☰
          </button>
          <div>
            <p className="text-sm text-slate-500">Khu vực quản trị</p>
            <h1 className="text-base font-semibold text-slate-900">Quản lý tồn kho</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 sm:inline-flex">
            {adminName || "Admin"}
          </span>
          <button
            onClick={onLogout}
            disabled={isLoggingOut}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </div>
      </div>
    </header>
  );
}
