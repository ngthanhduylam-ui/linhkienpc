import { PublicCatalogueProductCard } from "./PublicCatalogueProductCard";

const CATALOGUE_GRID_CLASS_NAME =
  "grid min-w-0 grid-cols-1 gap-[clamp(0.75rem,1vw,1.25rem)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1680px]:grid-cols-5 min-[2200px]:grid-cols-6";

function CategoryGrid({ onViewDetails, products }) {
  return (
    <div className={CATALOGUE_GRID_CLASS_NAME}>
      {products.map((product) => (
        <div key={product.id || product.sku} className="h-full min-w-0">
          <PublicCatalogueProductCard product={product} onViewDetails={onViewDetails} showPrice />
        </div>
      ))}
    </div>
  );
}

function CategoryGridSkeleton() {
  return (
    <div className={CATALOGUE_GRID_CLASS_NAME}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="h-36 bg-slate-100 sm:h-[clamp(9rem,8vw,11rem)]" />
          <div className="space-y-2 p-3">
            <div className="h-4 rounded bg-slate-200" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
            <div className="h-8 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PublicCategoryResultsSection({
  category,
  error,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  onRetry,
  onViewDetails,
  products,
  total
}) {
  const categoryName = category?.name || "Danh mục";
  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <section className="mt-[clamp(1.25rem,1.5vw,1.75rem)]" aria-labelledby="public-category-results-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 sm:mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b63f6]">Danh mục</p>
          <h1 id="public-category-results-heading" className="mt-1 text-[clamp(1.4rem,1.5vw,2rem)] font-extrabold text-[#0f2f5f]">
            {categoryName} đang có sẵn
          </h1>
        </div>
        {!isLoading && !error && (
          <p className="text-sm font-semibold text-slate-600">
            {total} sản phẩm đang có sẵn
          </p>
        )}
      </div>

      {isLoading && safeProducts.length === 0 && <CategoryGridSkeleton />}

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

      {safeProducts.length > 0 && <CategoryGrid onViewDetails={onViewDetails} products={safeProducts} />}

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
