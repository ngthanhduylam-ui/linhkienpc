import { PublicCatalogueProductCard } from "./PublicCatalogueProductCard";

export function PublicAvailableProductsSection({ isLoading, onViewDetails, products }) {
  if (!isLoading && products.length === 0) return null;

  return (
    <section className="mt-5" aria-labelledby="available-products-heading">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="h-6 w-1 rounded-full bg-[#0b63f6]" />
        <h2 id="available-products-heading" className="text-lg font-extrabold text-[#0f2f5f] sm:text-xl">
          Sản phẩm đang có sẵn
        </h2>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 min-[1440px]:grid-cols-5 min-[1800px]:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-[4/3] bg-slate-100" />
                <div className="space-y-2 p-3">
                  <div className="h-4 rounded bg-slate-200" />
                  <div className="h-3 w-2/3 rounded bg-slate-100" />
                  <div className="h-9 rounded bg-slate-100" />
                </div>
              </div>
            ))
          : products.map((product) => (
              <PublicCatalogueProductCard key={product.id || product.sku} product={product} onViewDetails={onViewDetails} />
            ))}
      </div>
    </section>
  );
}
