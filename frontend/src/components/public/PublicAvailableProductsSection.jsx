import { PublicProductGrid, PublicProductGridSkeleton } from "./PublicProductGrid";

const SUGGESTION_DEFINITION = {
  key: "suggestions",
  title: "Có thể bạn đang cần",
  accent: "bg-[#0b63f6]"
};

function SectionIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.125rem] w-[1.125rem] min-[2200px]:h-5 min-[2200px]:w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

function CatalogueSection({ definition, onViewDetails, products }) {
  if (!products.length) return null;

  return (
    <section className="mt-[clamp(1rem,1.2vw,1.5rem)]" aria-labelledby={`catalogue-${definition.key}-heading`}>
      <div className="mb-3 flex items-center gap-3 min-[2200px]:mb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-white shadow-[0_4px_10px_rgba(11,99,246,0.18)] min-[2200px]:h-9 min-[2200px]:min-w-9 ${definition.accent}`}>
            <SectionIcon />
          </span>
          <h2 id={`catalogue-${definition.key}-heading`} className="truncate text-[clamp(1.2rem,1.15vw,1.6rem)] font-black tracking-[-0.015em] text-[#0f2f5f] min-[2200px]:text-[1.75rem]">
            {definition.title}
          </h2>
        </div>
      </div>

      <PublicProductGrid onViewDetails={onViewDetails} products={products} />
    </section>
  );
}

function CatalogueSkeleton({ label }) {
  return (
    <section className="mt-[clamp(1rem,1.2vw,1.5rem)]" aria-label={label}>
      <div className="mb-3 h-8 w-56 animate-pulse rounded bg-slate-200" />
      <PublicProductGridSkeleton />
    </section>
  );
}

function SuggestionError({ onRetry }) {
  return (
    <section className="mt-[clamp(1rem,1.2vw,1.5rem)]" aria-labelledby="catalogue-suggestions-heading">
      <div className="mb-3 flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b63f6] px-1.5 text-white shadow-[0_4px_10px_rgba(11,99,246,0.18)] min-[2200px]:h-9 min-[2200px]:min-w-9">
          <SectionIcon />
        </span>
        <h2 id="catalogue-suggestions-heading" className="text-[clamp(1.2rem,1.15vw,1.6rem)] font-black tracking-[-0.015em] text-[#0f2f5f] min-[2200px]:text-[1.75rem]">
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
  isSuggestionsLoading,
  onRetrySuggestions,
  onViewDetails,
  suggestionError,
  suggestions
}) {
  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
  if (!isSuggestionsLoading && !suggestionError && !safeSuggestions.length) {
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
        />
      )}
      {!isSuggestionsLoading && suggestionError && <SuggestionError onRetry={onRetrySuggestions} />}
    </div>
  );
}
