import ptcLogoUrl from "../../assets/ptc-logo.png";

export function PublicCatalogueHero() {
  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-[#d9e6f5] bg-[#f3f8ff] shadow-[0_3px_14px_rgba(15,47,95,0.06)]">
      <div className="grid min-w-0 gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-sm sm:h-20 sm:w-20">
            <img src={ptcLogoUrl} alt="" aria-hidden="true" className="h-11 w-11 object-contain sm:h-16 sm:w-16" />
          </div>
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0b4fb3] sm:text-xs">
              Kiểm tra nhanh tại shop
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0f2f5f] sm:text-3xl">
              Tra cứu tồn kho &amp; bán linh kiện PC
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-slate-600 sm:text-base">
              Tìm nhanh linh kiện theo tên, SKU hoặc ghi chú bảo hành.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-2.5 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <article className="min-w-0 rounded-xl border border-orange-200 bg-white px-3.5 py-3">
            <p className="text-sm font-extrabold text-orange-800">Hàng 2nd</p>
            <p className="mt-1 text-xs leading-4 text-slate-600">
              Hàng zin tháo máy, đã kiểm tra trước khi bán
            </p>
          </article>
          <article className="min-w-0 rounded-xl border border-blue-200 bg-white px-3.5 py-3">
            <p className="text-sm font-extrabold text-[#0b4fb3]">Hàng new</p>
            <p className="mt-1 text-xs leading-4 text-slate-600">
              Hàng mới, tình trạng được ghi rõ theo từng sản phẩm
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
