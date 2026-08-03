import { NavLink } from "react-router-dom";

const SETTINGS_SECTIONS = [
  { label: "Quy ước SKU", to: "/admin/settings/sku-rules" },
  { label: "Mẫu in", to: "/admin/settings/print-template" }
];

function itemClassName({ isActive }) {
  return `flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
    isActive
      ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  }`;
}

export function SettingsSectionNav() {
  return (
    <nav
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
      aria-label="Các mục cài đặt"
    >
      <div className="flex min-w-0 flex-wrap gap-1">
        {SETTINGS_SECTIONS.map((section) => (
          <NavLink key={section.to} to={section.to} className={itemClassName}>
            {section.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
