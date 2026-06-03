import { NavLink } from "react-router-dom";

const inventoryItems = [
  { label: "Nhập hàng", to: "/admin/stock-in" },
  { label: "Xuất hàng", to: "/admin/stock-out" }
];

const mainItems = [
  { label: "Sản phẩm", to: "/admin/products" },
  { label: "Nhà cung cấp", to: "/admin/suppliers" },
  { label: "Khách hàng", to: "/admin/customers" },
  { label: "Lịch sử giao dịch", to: "/admin/transaction-history" }
];

function navClassName({ isActive }) {
  return `block rounded-md px-3 py-2 text-sm ${
    isActive ? "bg-brand-50 text-brand-900" : "text-slate-700 hover:bg-slate-100"
  }`;
}

export function AdminSidebar({ isOpen, onClose }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-slate-900/30 transition md:hidden ${isOpen ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-30 h-screen w-72 border-r border-slate-200 bg-white p-4 transition-transform md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 px-2">
          <h2 className="text-xl font-bold text-brand-900">VI TÍNH PHƯỚC TÀI</h2>
          <p className="text-xs text-slate-500">Quản trị hệ thống</p>
        </div>

        <nav className="space-y-4">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Tra cứu ↗
          </a>

          <div>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Quản lý kho</p>
            <div className="space-y-1">
              {inventoryItems.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={onClose} className={navClassName}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            {mainItems.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={onClose} className={navClassName}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}
