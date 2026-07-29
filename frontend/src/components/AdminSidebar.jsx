import { Link, NavLink } from "react-router-dom";
import { saveAdminReturnLocation } from "../utils/adminPublicNavigation";

const inventoryItems = [
  { label: "Nhập hàng", to: "/admin/stock-in", icon: "package-plus" },
  { label: "Bán tại quầy", to: "/admin/stock-out", icon: "shopping-cart" },
  { label: "Kiểm hàng", to: "/admin/inventory-check", icon: "clipboard-check" },
  { label: "Sản phẩm", to: "/admin/products", icon: "boxes" }
];

const salesItems = [
  { label: "Đăng bán online", to: "/admin/online-listing", icon: "megaphone" },
  { label: "Nhà cung cấp", to: "/admin/suppliers", icon: "truck" },
  { label: "Khách hàng", to: "/admin/customers", icon: "users" },
  { label: "Lịch sử giao dịch", to: "/admin/transaction-history", icon: "history" }
];

const settingsItems = [
  { label: "Cài đặt", to: "/admin/settings/sku-rules", icon: "settings" }
];

function navClassName({ isActive }) {
  return `relative flex min-h-11 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-r-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
    isActive
      ? "bg-brand-50 font-semibold text-brand-700 before:bg-brand-500"
      : "font-medium text-slate-700 before:bg-transparent hover:bg-slate-50 hover:text-slate-900"
  }`;
}

function SidebarIcon({ name, className = "" }) {
  const commonProps = {
    "aria-hidden": true,
    className,
    fill: "none",
    focusable: "false",
    height: 20,
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 20
  };

  switch (name) {
    case "search":
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case "package-plus":
      return (
        <svg {...commonProps}>
          <path d="m4 7 8-4 8 4-8 4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7M12 11v10" />
          <path d="M18 12v5M15.5 14.5h5" />
        </svg>
      );
    case "shopping-cart":
      return (
        <svg {...commonProps}>
          <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 8H6" />
          <circle cx="9" cy="20" r="1" />
          <circle cx="18" cy="20" r="1" />
        </svg>
      );
    case "clipboard-check":
      return (
        <svg {...commonProps}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4.5V3h6v1.5M9 13l2 2 4-4" />
        </svg>
      );
    case "boxes":
      return (
        <svg {...commonProps}>
          <rect x="3" y="11" width="8" height="8" rx="1" />
          <rect x="13" y="11" width="8" height="8" rx="1" />
          <rect x="8" y="3" width="8" height="6" rx="1" />
          <path d="M7 11v8M17 11v8M12 3v6" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...commonProps}>
          <path d="M3 11v2a2 2 0 0 0 2 2h2l9 4V5L7 9H5a2 2 0 0 0-2 2Z" />
          <path d="m7 15 1 5h3l-1-3.5M19 9a4 4 0 0 1 0 6" />
        </svg>
      );
    case "truck":
      return (
        <svg {...commonProps}>
          <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      );
    case "users":
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5M17 14a5 5 0 0 1 4 5" />
        </svg>
      );
    case "history":
      return (
        <svg {...commonProps}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5M12 7v5l3 2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      );
    default:
      return null;
  }
}

function SidebarNavGroup({ title, items, divided = false, onNavigate }) {
  return (
    <div className={divided ? "border-t border-slate-200 pt-4" : ""}>
      <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {title}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={onNavigate} className={navClassName}>
            {({ isActive }) => (
              <>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${isActive ? "text-brand-700" : "text-slate-500"}`}>
                  <SidebarIcon name={item.icon} />
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function AdminSidebar({ isOpen, onClose }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-slate-900/30 transition md:hidden ${isOpen ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-30 h-screen w-72 overflow-y-auto border-r border-slate-200 bg-white p-4 transition-transform md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 px-2 pt-1">
          <h2 className="truncate text-xl font-bold tracking-[0.01em] text-brand-900">VI TÍNH PHƯỚC TÀI</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Quản trị hệ thống</p>
        </div>

        <nav className="space-y-5" aria-label="Điều hướng quản trị">
          <Link
            to="/"
            onClick={() => {
              saveAdminReturnLocation();
              onClose();
            }}
            className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-500">
              <SidebarIcon name="search" />
            </span>
            <span className="min-w-0 truncate">Tra cứu</span>
          </Link>

          <SidebarNavGroup title="Quản lý kho" items={inventoryItems} onNavigate={onClose} />
          <SidebarNavGroup title="Quản lý bán hàng" items={salesItems} divided onNavigate={onClose} />
          <SidebarNavGroup title="Hệ thống" items={settingsItems} divided onNavigate={onClose} />
        </nav>
      </aside>
    </>
  );
}
