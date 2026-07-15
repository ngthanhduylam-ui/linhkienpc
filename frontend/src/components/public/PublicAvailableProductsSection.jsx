import { PublicCatalogueProductCard } from "./PublicCatalogueProductCard";

const CATALOGUE_GRID_CLASS_NAME =
  "grid min-w-0 grid-cols-1 gap-[clamp(0.75rem,1vw,1.25rem)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1680px]:grid-cols-5 min-[2200px]:grid-cols-6";

const SUGGESTION_DEFINITION = {
  key: "suggestions",
  title: "Có thể bạn đang cần",
  accent: "bg-[#0b63f6]",
  icon: "spark"
};

const CONDITION_SECTION_DEFINITIONS = [
  { key: "secondhand", title: "Hàng 2nd", accent: "bg-orange-500", icon: "secondhand" },
  { key: "new", title: "Hàng new", accent: "bg-blue-600", icon: "new" }
];

function SectionIcon({ type }) {
  if (type === "secondhand") {
    return <span aria-hidden="true" className="text-sm font-black leading-none">2nd</span>;
  }
  if (type === "new") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m4 8 8-4 8 4-8 4-8-4Z" />
        <path d="m4 8 8 4 8-4v8l-8 4-8-4V8Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

function CatalogueSection({ definition, onViewDetails, products, showPrice = false }) {
  if (!products.length) return null;

  return (
    <section className="mt-[clamp(1.25rem,1.5vw,1.75rem)]" aria-labelledby={`catalogue-${definition.key}-heading`}>
      <div className="mb-2.5 flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-white ${definition.accent}`}>
            <SectionIcon type={definition.icon} />
          </span>
          <h2 id={`catalogue-${definition.key}-heading`} className="truncate text-[clamp(1.125rem,1.1vw,1.5rem)] font-extrabold text-[#0f2f5f]">
            {definition.title}
          </h2>
        </div>
      </div>

      <div className={CATALOGUE_GRID_CLASS_NAME}>
        {products.map((product) => (
          <div key={product.id || product.sku} className="h-full min-w-0">
            <PublicCatalogueProductCard product={product} onViewDetails={onViewDetails} showPrice={showPrice} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CatalogueSkeleton({ label }) {
  return (
    <section className="mt-[clamp(1.25rem,1.5vw,1.75rem)]" aria-label={label}>
      <div className="mb-2.5 h-7 w-52 animate-pulse rounded bg-slate-200" />
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
    </section>
  );
}

function SuggestionError({ onRetry }) {
  return (
    <section className="mt-[clamp(1.25rem,1.5vw,1.75rem)]" aria-labelledby="catalogue-suggestions-heading">
      <div className="mb-2.5 flex min-w-0 items-center gap-2">
        <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-[#0b63f6] px-1.5 text-white">
          <SectionIcon type="spark" />
        </span>
        <h2 id="catalogue-suggestions-heading" className="text-[clamp(1.125rem,1.1vw,1.5rem)] font-extrabold text-[#0f2f5f]">
          Có thể bạn đang cần
        </h2>
      </div>
      <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm text-slate-600">
        <span>Chưa thể tải gợi ý lúc này.</span>
        <button
          type="button"
          onClick={onRetry}
          className="ml-2 font-bold text-[#0b63f6] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6]"
        >
          Thử lại
        </button>
      </div>
    </section>
  );
}

export function PublicAvailableProductsSection({
  isLoading,
  isSuggestionsLoading,
  onRetrySuggestions,
  onViewDetails,
  sections,
  suggestionError,
  suggestions
}) {
  const safeSections = sections || {};
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const hasConditionProducts = CONDITION_SECTION_DEFINITIONS.some(
    (definition) => (safeSections[definition.key] || []).length > 0
  );
  if (!isLoading && !isSuggestionsLoading && !suggestionError && !safeSuggestions.length && !hasConditionProducts) {
    return null;
  }

  return (
    <div aria-label="Danh sách sản phẩm catalogue">
      {isSuggestionsLoading && <CatalogueSkeleton label="Đang tải sản phẩm có thể bạn đang cần" />}
      {!isSuggestionsLoading && safeSuggestions.length > 0 && (
        <CatalogueSection
          definition={SUGGESTION_DEFINITION}
          onViewDetails={onViewDetails}
          products={safeSuggestions}
          showPrice
        />
      )}
      {!isSuggestionsLoading && suggestionError && <SuggestionError onRetry={onRetrySuggestions} />}

      {isLoading ? (
        <CatalogueSkeleton label="Đang tải sản phẩm theo tình trạng" />
      ) : (
        CONDITION_SECTION_DEFINITIONS.map((definition) => (
          <CatalogueSection
            key={definition.key}
            definition={definition}
            onViewDetails={onViewDetails}
            products={safeSections[definition.key] || []}
          />
        ))
      )}
    </div>
  );
}
