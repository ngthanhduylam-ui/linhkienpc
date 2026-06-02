import { NavLink } from "react-router-dom";

const sidebarItems = [
  { label: "Quản lý kho", to: "/admin/inventory-workbench" },
  { label: "Sản phẩm", to: "/admin/products" },
  { label: "Lịch sử giao dịch", to: "/admin/transaction-history" }
];

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
          <h2 className="text-xl font-bold text-brand-900">LINHKIENPC</h2>
          <p className="text-xs text-slate-500">Quản trị hệ thống</p>
        </div>

        <nav className="space-y-1">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-brand-50 text-brand-900" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
