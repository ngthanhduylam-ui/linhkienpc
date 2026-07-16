import { PublicCatalogueProductCard } from "./PublicCatalogueProductCard";

export const PUBLIC_PRODUCT_GRID_CLASS_NAME =
  "mx-auto grid w-full min-w-0 grid-cols-1 gap-2.5 sm:w-fit sm:grid-cols-[repeat(2,minmax(0,13.75rem))] sm:gap-3 lg:grid-cols-[repeat(4,minmax(0,13.75rem))] min-[1366px]:grid-cols-[repeat(5,minmax(0,13.75rem))] min-[1500px]:grid-cols-[repeat(6,minmax(0,13.75rem))]";

export function PublicProductGrid({ onViewDetails, products }) {
  const safeProducts = Array.isArray(products) ? products : [];

  return (
    <div className={PUBLIC_PRODUCT_GRID_CLASS_NAME}>
      {safeProducts.map((product) => (
        <div key={product.productId || product.id} className="h-full min-w-0">
          <PublicCatalogueProductCard
            product={product}
            onViewDetails={onViewDetails}
          />
        </div>
      ))}
    </div>
  );
}

export function PublicProductGridSkeleton({ count = 6 }) {
  return (
    <div className={PUBLIC_PRODUCT_GRID_CLASS_NAME}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div className="h-32 bg-slate-100 sm:h-[clamp(7.5rem,6vw,9.5rem)]" />
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
