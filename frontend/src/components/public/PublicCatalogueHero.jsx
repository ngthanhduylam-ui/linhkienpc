export function PublicCatalogueHero() {
  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-[#d9e6f5] bg-[#f3f8ff] shadow-[0_3px_14px_rgba(15,47,95,0.06)]">
      <div className="grid min-w-0 gap-[clamp(0.75rem,1vw,1.5rem)] px-[clamp(1rem,1.5vw,2rem)] py-[clamp(1rem,1.2vw,1.5rem)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-sm sm:h-[clamp(4.5rem,4vw,5rem)] sm:w-[clamp(4.5rem,4vw,5rem)]">
            <svg viewBox="0 0 64 64" aria-hidden="true" className="h-10 w-10 text-[#0b63f6] sm:h-12 sm:w-12">
              <path d="M13 22 32 12l19 10-19 10-19-10Z" fill="currentColor" opacity=".16" />
              <path d="m14 23 18 9 18-9v20L32 53 14 43V23Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
              <path d="M32 32v21" fill="none" stroke="currentColor" strokeWidth="3" />
              <circle cx="46" cy="17" r="9" fill="white" stroke="currentColor" strokeWidth="3" />
              <path d="m52.5 23.5 6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0b4fb3] sm:text-xs">
              Kiểm tra nhanh tại shop
            </span>
            <h1 className="mt-1.5 text-[22px] font-extrabold leading-7 tracking-tight text-[#0f2f5f] sm:text-[clamp(1.75rem,1.35vw,2.125rem)] sm:leading-[1.15]">
              Tra cứu tồn kho &amp; bán linh kiện PC
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600 sm:text-[clamp(0.875rem,0.75vw,1rem)] sm:leading-[1.5]">
              Tìm nhanh linh kiện theo tên, SKU hoặc ghi chú bảo hành.
            </p>
          </div>
        </div>

        <div className="hidden min-w-0 rounded-xl border border-blue-100 bg-white/80 px-[clamp(0.75rem,0.8vw,1rem)] py-[clamp(0.75rem,0.8vw,1rem)] lg:block">
          <p className="text-xs font-extrabold uppercase tracking-wide text-[#0b4fb3]">Tìm nhanh theo</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Tên sản phẩm", "SKU", "Ghi chú bảo hành"].map((label) => (
              <span key={label} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2.5">
          <article className="min-w-0 rounded-xl border border-orange-200 bg-white px-[clamp(0.75rem,0.8vw,1rem)] py-[clamp(0.625rem,0.7vw,0.875rem)]">
            <p className="text-sm font-extrabold text-orange-800">Hàng 2nd</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-600 sm:text-xs">
              Hàng zin tháo máy, đã kiểm tra trước khi bán
            </p>
          </article>
          <article className="min-w-0 rounded-xl border border-blue-200 bg-white px-[clamp(0.75rem,0.8vw,1rem)] py-[clamp(0.625rem,0.7vw,0.875rem)]">
            <p className="text-sm font-extrabold text-[#0b4fb3]">Hàng new</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-600 sm:text-xs">
              Hàng mới, tình trạng được ghi rõ theo từng sản phẩm
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
