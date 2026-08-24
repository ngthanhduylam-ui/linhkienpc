const VIEW_OPTIONS = [
  {
    id: "card",
    label: "Thẻ",
    title: "Dạng thẻ",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="2.5" y="3" width="6" height="5.5" rx="1" />
        <rect x="11.5" y="3" width="6" height="5.5" rx="1" />
        <rect x="2.5" y="11.5" width="6" height="5.5" rx="1" />
        <rect x="11.5" y="11.5" width="6" height="5.5" rx="1" />
      </svg>
    )
  },
  {
    id: "table",
    label: "Bảng",
    title: "Dạng bảng",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="2.5" y="3" width="15" height="14" rx="1.5" />
        <path d="M2.5 7.5h15M2.5 12h15M10 3v14" />
      </svg>
    )
  }
];

export function PublicResultViewSwitcher({ value, onChange, ariaLabel = "Kiểu hiển thị kết quả" }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label={ariaLabel}>
      {VIEW_OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            title={option.title}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 sm:px-3 sm:text-sm ${
              active
                ? "bg-brand-700 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-brand-50 hover:text-brand-900"
            }`}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
