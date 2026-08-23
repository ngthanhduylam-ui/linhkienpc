const SERVICE_ITEMS = [
  {
    title: "Tra cứu sản phẩm",
    description: "Nhanh chóng, dễ tìm",
    icon: "search"
  },
  {
    title: "Kiểm tra tồn kho",
    description: "Cập nhật theo hệ thống",
    icon: "package"
  },
  {
    title: "Hình ảnh sản phẩm",
    description: "Xem trực tiếp trên web",
    icon: "image"
  },
  {
    title: "Giờ hoạt động",
    description: "08:00 - 21:00 (T2 - CN)",
    icon: "clock"
  }
];

function ServiceIcon({ type }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 min-[1920px]:h-7 min-[1920px]:w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {type === "search" && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </>
      )}
      {type === "package" && (
        <>
          <path d="m4 7 8-4 8 4-8 4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7M12 11v10" />
        </>
      )}
      {type === "image" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-5-5L5 20" />
        </>
      )}
      {type === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
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
