import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import ptcLogoUrl from "../assets/ptc-logo.png";
import { saveAdminReturnLocation } from "../utils/adminPublicNavigation";

const SIDEBAR_COLLAPSE_DELAY_MS = 150;

const inventoryItems = [
  { label: "Sổ nhanh", to: "/admin/quick-notes", icon: "message-square" },
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

function navClassName(labelsVisible) {
  return ({ isActive }) => `relative flex min-h-11 min-w-0 items-center rounded-lg py-2 text-sm outline-none transition-colors before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-r-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
    labelsVisible ? "gap-3 px-3" : "justify-center px-0"
  } ${
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
    case "message-square":
      return (
        <svg {...commonProps}>
          <path d="M5 18.5 3.5 21l.7-4A8.5 8.5 0 1 1 12 20.5H7" />
          <path d="M8 10h8M8 14h5" />
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

function SidebarLabel({ children, visible }) {
  return (
    <span
      aria-hidden="true"
      className={`min-w-0 truncate transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
        visible
          ? "translate-x-0 opacity-100"
          : "w-0 -translate-x-1 overflow-hidden opacity-0"
      }`}
    >
      {children}
    </span>
  );
}

function SidebarNavGroup({ title, items, divided = false, labelsVisible, onNavigate }) {
  return (
    <div className={divided ? `border-t border-slate-200 ${labelsVisible ? "pt-4" : "pt-2"}` : ""}>
      {labelsVisible && (
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {title}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={navClassName(labelsVisible)}
            aria-label={item.label}
            title={labelsVisible ? undefined : item.label}
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${isActive ? "text-brand-700" : "text-slate-500"}`}>
                  <SidebarIcon name={item.icon} />
                </span>
                <SidebarLabel visible={labelsVisible}>{item.label}</SidebarLabel>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function AdminSidebar({ isOpen, onClose, desktopAutoCollapse = false }) {
  const location = useLocation();
  const collapseTimerRef = useRef(null);
  const pointerInsideRef = useRef(false);
  const focusInsideRef = useRef(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const labelsVisible = !desktopAutoCollapse || desktopExpanded;

  function clearCollapseTimer() {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }

  function scheduleCollapse() {
    if (!desktopAutoCollapse) return;
    clearCollapseTimer();
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null;
      if (!pointerInsideRef.current && !focusInsideRef.current) {
        setDesktopExpanded(false);
      }
    }, SIDEBAR_COLLAPSE_DELAY_MS);
  }

  function handlePointerEnter() {
    if (!desktopAutoCollapse) return;
    pointerInsideRef.current = true;
    clearCollapseTimer();
    setDesktopExpanded(true);
  }

  function handlePointerLeave() {
    if (!desktopAutoCollapse) return;
    pointerInsideRef.current = false;
    if (!focusInsideRef.current) scheduleCollapse();
  }

  function handleFocusCapture() {
    if (!desktopAutoCollapse) return;
    focusInsideRef.current = true;
    clearCollapseTimer();
    setDesktopExpanded(true);
  }

  function handleBlurCapture(event) {
    if (!desktopAutoCollapse || event.currentTarget.contains(event.relatedTarget)) return;
    focusInsideRef.current = false;
    if (!pointerInsideRef.current) scheduleCollapse();
  }

  function handleNavigate() {
    onClose();
    if (!desktopAutoCollapse) return;
    clearCollapseTimer();
    pointerInsideRef.current = false;
    focusInsideRef.current = false;
    setDesktopExpanded(false);
  }

  useEffect(() => {
    clearCollapseTimer();
    pointerInsideRef.current = false;
    focusInsideRef.current = false;
    setDesktopExpanded(false);
  }, [
    desktopAutoCollapse,
    location.pathname,
    location.search,
    location.hash
  ]);

  useEffect(() => () => clearCollapseTimer(), []);

  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-slate-900/30 transition md:hidden ${isOpen ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-30 h-screen w-72 overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white p-4 transition-[transform,width,box-shadow] duration-200 ease-out motion-reduce:transition-none md:translate-x-0 ${
          desktopAutoCollapse
            ? desktopExpanded
              ? "md:w-72 md:shadow-xl"
              : "md:w-[72px] md:shadow-none"
            : "md:w-72"
        } ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
      >
        <div className={`mb-3 flex h-12 min-w-0 items-center ${labelsVisible ? "justify-start gap-3 px-2" : "justify-center"}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <img
              src={ptcLogoUrl}
              alt="Logo VI TÍNH PHƯỚC TÀI"
              className="h-full w-full object-contain"
            />
          </span>
          <div
            aria-hidden={!labelsVisible}
            className={`min-w-0 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
              labelsVisible
                ? "translate-x-0 flex-1 opacity-100"
                : "w-0 -translate-x-1 overflow-hidden opacity-0"
            }`}
          >
            <p className="truncate whitespace-nowrap text-sm font-bold tracking-[0.01em] text-brand-900">
              VI TÍNH PHƯỚC TÀI
            </p>
            <p className="mt-0.5 truncate whitespace-nowrap text-xs font-medium text-slate-500">
              Quản trị hệ thống
            </p>
          </div>
        </div>

        <nav className={labelsVisible ? "space-y-5" : "space-y-2"} aria-label="Điều hướng quản trị">
          <Link
            to="/"
            onClick={() => {
              saveAdminReturnLocation();
              handleNavigate();
            }}
            className={`flex min-h-11 min-w-0 items-center rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
              labelsVisible ? "gap-3 px-3" : "justify-center px-0"
            }`}
            aria-label="Tra cứu"
            title={labelsVisible ? undefined : "Tra cứu"}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-500">
              <SidebarIcon name="search" />
            </span>
            <SidebarLabel visible={labelsVisible}>Tra cứu</SidebarLabel>
          </Link>

          <SidebarNavGroup
            title="Quản lý kho"
            items={inventoryItems}
            labelsVisible={labelsVisible}
            onNavigate={handleNavigate}
          />
          <SidebarNavGroup
            title="Quản lý bán hàng"
            items={salesItems}
            divided
            labelsVisible={labelsVisible}
            onNavigate={handleNavigate}
          />
          <SidebarNavGroup
            title="Hệ thống"
            items={settingsItems}
            divided
            labelsVisible={labelsVisible}
            onNavigate={handleNavigate}
          />
        </nav>
      </aside>
    </>
  );
}
