import { PublicProductGrid, PublicProductGridSkeleton } from "./PublicProductGrid";
import { PublicResultViewSwitcher } from "./PublicResultViewSwitcher";
import { PublicSearchResultsTable } from "./PublicSearchResultsTable";

export function PublicCategoryResultsSection({
  category,
  error,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  onResultViewModeChange,
  onRetry,
  onViewDetails,
  products,
  resultViewMode,
  total
}) {
  const categoryName = category?.name || "Danh mục";
  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <section className="mx-auto mt-[clamp(1.25rem,1.5vw,1.75rem)] w-full max-w-[100rem]" aria-labelledby="public-category-results-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b63f6]">Danh mục</p>
          <h1 id="public-category-results-heading" className="mt-1 text-[clamp(1.4rem,1.5vw,2rem)] font-extrabold text-[#0f2f5f]">
            {categoryName} đang có sẵn
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!isLoading && !error && (
            <p className="text-sm font-semibold text-slate-600">
              {total} sản phẩm đang có sẵn
            </p>
          )}
          <PublicResultViewSwitcher value={resultViewMode} onChange={onResultViewModeChange} />
        </div>
      </div>

      {isLoading && safeProducts.length === 0 && <PublicProductGridSkeleton />}

      {!isLoading && error && safeProducts.length === 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-medium text-red-700">
          <p>Không thể tải danh mục lúc này.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-9 rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Thử lại
          </button>
        </div>
      )}

      {!isLoading && !error && safeProducts.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-600">
          Hiện chưa có sản phẩm trong danh mục này
        </div>
      )}

      {safeProducts.length > 0 && resultViewMode === "card" && (
        <PublicProductGrid onViewDetails={onViewDetails} products={safeProducts} />
      )}

      {safeProducts.length > 0 && resultViewMode === "table" && (
        <PublicSearchResultsTable products={safeProducts} />
      )}

      {safeProducts.length > 0 && error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <p>Không thể tải thêm sản phẩm lúc này.</p>
          <button type="button" onClick={onRetry} className="mt-2 font-bold underline underline-offset-2">
            Thử lại
          </button>
        </div>
      )}

      {hasMore && !error && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="min-h-11 rounded-xl border border-blue-200 bg-white px-5 text-sm font-extrabold text-[#0b63f6] hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingMore ? "Đang tải..." : "Xem thêm"}
          </button>
        </div>
      )}
    </section>
  );
}
