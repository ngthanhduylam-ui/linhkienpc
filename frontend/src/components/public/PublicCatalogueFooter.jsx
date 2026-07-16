const SERVICE_ITEMS = [
  {
    title: "Cam kết hàng chất lượng",
    description: "Test kỹ trước khi bán",
    icon: "quality"
  },
  {
    title: "Bảo hành rõ ràng",
    description: "Hỗ trợ nhanh chóng",
    icon: "shield"
  },
  {
    title: "Giao hàng toàn quốc",
    description: "Nhanh chóng – An toàn",
    icon: "delivery"
  },
  {
    title: "Hỗ trợ bán hàng",
    description: "08:30 - 18:30 (T2 - CN)",
    icon: "support"
  }
];

function ServiceIcon({ type }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 min-[1920px]:h-7 min-[1920px]:w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {type === "quality" && (
        <>
          <path d="M4 5h16v14H4z" />
          <path d="M7 15c1.1-1.7 2.2-2.5 3.4-2.5 1.4 0 1.9 1.5 3.2 1.5 1 0 1.7-.6 3.4-2M8 8h8" />
        </>
      )}
      {type === "shield" && (
        <>
          <path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      )}
      {type === "delivery" && (
        <>
          <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
          <circle cx="7" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" />
        </>
      )}
      {type === "support" && (
        <>
          <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
          <path d="M4 13a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Z" />
          <path d="M17 18c-1 2-2.5 3-5 3" />
        </>
      )}
    </svg>
  );
}

export function PublicCatalogueFooter() {
  return (
    <footer className="shrink-0 border-t border-[#dbe8f7] bg-[#f7faff]">
      <div className="mx-auto grid w-[min(calc(100%_-_clamp(1.5rem,2vw,3rem)),clamp(80rem,96vw,154rem))] grid-cols-1 gap-4 py-6 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-center lg:gap-0 lg:py-7 min-[1920px]:py-8">
        {SERVICE_ITEMS.map((item, index) => (
          <div
            key={item.title}
            className={`flex min-w-0 items-center gap-3.5 lg:px-[clamp(0.75rem,1vw,1.75rem)] ${index > 0 ? "lg:border-l lg:border-[#dbe8f7]" : ""}`}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[#0b63f6] min-[1920px]:h-14 min-[1920px]:w-14">
              <ServiceIcon type={item.icon} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[#0f2f5f] min-[1920px]:text-base">{item.title}</p>
              <p className="mt-1 text-xs font-medium text-[#637b9f] min-[1920px]:text-sm">{item.description}</p>
            </div>
          </div>
        ))}
        <p className="border-t border-[#dbe8f7] pt-4 text-center text-xs font-medium leading-5 text-[#637b9f] sm:col-span-2 lg:col-span-1 lg:ml-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right min-[1920px]:text-sm">
          © 2026 VI TÍNH PHƯỚC TÀI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
