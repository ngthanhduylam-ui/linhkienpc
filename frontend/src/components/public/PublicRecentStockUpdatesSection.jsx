import {
  formatPublicStockUpdatedAt,
  sanitizePublicRecentStockUpdates
} from "../../utils/publicRecentStockUpdates";

const RECENT_STOCK_LOADING_ROW_COUNT = 5;

function RecentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.9 4.9A10 10 0 1 1 2 12" strokeLinecap="round" />
      <path d="M2 5v7h7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function conditionLabel(condition) {
  if (condition === "2nd") return "2nd";
  if (condition === "new") return "New";
  return "Sản phẩm";
}

function RecentStockTable({ isLoading, onViewDetails, products }) {
  return (
    <div className="w-full overflow-hidden border border-slate-300 bg-white">
      <div className="hidden min-[900px]:block">
        <table className="w-full table-fixed border-collapse text-sm text-slate-800">
          <colgroup>
            <col className="w-[55%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="bg-slate-100">
            <tr>
              {['Sản phẩm', 'Tình trạng', 'Tồn kho', 'Cập nhật'].map((label, index) => (
                <th key={label} className={`border-b border-r border-slate-300 px-3 py-2.5 font-bold last:border-r-0 ${index === 0 ? 'text-left' : 'text-center'}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: RECENT_STOCK_LOADING_ROW_COUNT }, (_, index) => (
                  <tr key={index} aria-hidden="true">
                    {[55, 15, 12, 18].map((width) => (
                      <td key={width} className="border-b border-r border-slate-200 px-3 py-3 last:border-r-0">
                        <span className="block h-4 animate-pulse rounded bg-slate-100" style={{ width: `${Math.min(width + 20, 75)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : products.map((product) => (
                  <tr key={product.productId} className="odd:bg-white even:bg-slate-50/70">
                    <td className="border-b border-r border-slate-200 px-3 py-2.5 align-top">
                      <button type="button" onClick={() => onViewDetails(product)} className="block w-full text-left font-semibold text-[#0f2f5f] hover:text-[#0b63f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6]">
                        <span className="block [overflow-wrap:anywhere]">{product.name}</span>
                      </button>
                    </td>
                    <td className="border-b border-r border-slate-200 px-3 py-2.5 text-center align-top font-semibold">{conditionLabel(product.condition)}</td>
                    <td className="border-b border-r border-slate-200 px-3 py-2.5 text-center align-top text-base font-bold">{product.totalQuantity}</td>
                    <td className="border-b border-slate-200 px-3 py-2.5 text-center align-top text-slate-600">{formatPublicStockUpdatedAt(product.stockUpdatedAt)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="min-[900px]:hidden" role="list" aria-label="Sản phẩm vừa cập nhật kho dạng bảng">
        {isLoading
          ? Array.from({ length: RECENT_STOCK_LOADING_ROW_COUNT }, (_, index) => (
              <div key={index} className="space-y-2 border-b border-slate-200 px-3 py-3 last:border-b-0" aria-hidden="true">
                <span className="block h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                <span className="block h-8 animate-pulse rounded bg-slate-100" />
              </div>
            ))
          : products.map((product) => (
              <article key={product.productId} className="border-b border-slate-200 px-3 py-3 last:border-b-0" role="listitem">
                <button type="button" onClick={() => onViewDetails(product)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6]">
                  <span className="block text-sm font-bold text-[#0f2f5f] [overflow-wrap:anywhere]">{product.name}</span>
                </button>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-xs">
                  <p><span className="block font-semibold text-slate-500">Tình trạng</span>{conditionLabel(product.condition)}</p>
                  <p className="text-center"><span className="block font-semibold text-slate-500">Tồn kho</span><strong>{product.totalQuantity}</strong></p>
                  <p className="text-right"><span className="block font-semibold text-slate-500">Cập nhật</span>{formatPublicStockUpdatedAt(product.stockUpdatedAt)}</p>
                </div>
              </article>
            ))}
      </div>
    </div>
  );
}

export function PublicRecentStockUpdatesSection({ isLoading, onViewDetails, products }) {
  const safeProducts = sanitizePublicRecentStockUpdates(products);
  if (!isLoading && safeProducts.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[100rem]" aria-labelledby="public-recent-stock-heading">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b63f6] text-white shadow-[0_4px_10px_rgba(11,99,246,0.18)]">
            <RecentIcon />
          </span>
          <h2 id="public-recent-stock-heading" className="truncate text-[clamp(1.2rem,1.15vw,1.6rem)] font-black tracking-[-0.015em] text-[#0f2f5f]">
            Vừa cập nhật kho
          </h2>
        </div>
      </div>

      <RecentStockTable isLoading={isLoading} onViewDetails={onViewDetails} products={safeProducts} />
    </section>
  );
}
