export function AdminHeader({ onOpenMenu }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 md:hidden"
            onClick={onOpenMenu}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div>
            <p className="text-sm text-slate-500">Admin Panel</p>
            <h1 className="text-base font-semibold text-slate-900">Inventory Management</h1>
          </div>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Mock Mode</div>
      </div>
    </header>
  );
}
