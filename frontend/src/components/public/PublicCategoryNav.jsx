import { useEffect, useRef } from "react";

const DISPLAY_CATEGORY_ORDER = [
  "cpu",
  "vga",
  "ram",
  "mainboard",
  "ssd",
  "hdd",
  "man hinh",
  "nguon",
  "case",
  "tan nhiet",
  "barebone"
];

const CATEGORY_NAVIGATION_ALIASES = {
  "tan nhiet cpu": "tan nhiet"
};

function normalizeCategoryName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .trim()
    .toLowerCase();
}

function getCategoryNavigationKey(category) {
  const normalizedName = normalizeCategoryName(category?.name);
  return CATEGORY_NAVIGATION_ALIASES[normalizedName] || normalizedName;
}

function getCategoryDisplayName(category) {
  return getCategoryNavigationKey(category) === "tan nhiet" ? "Tản nhiệt" : category?.name;
}

function getCategoryDisplayOrder(category) {
  const position = DISPLAY_CATEGORY_ORDER.indexOf(getCategoryNavigationKey(category));
  return position === -1 ? DISPLAY_CATEGORY_ORDER.length : position;
}

function CategoryIcon({ name }) {
  const category = normalizeCategoryName(name);

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.15rem] w-[1.15rem] shrink-0 sm:h-5 sm:w-5 lg:h-[1.35rem] lg:w-[1.35rem] min-[2200px]:h-6 min-[2200px]:w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {category === "all" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      )}
      {category === "cpu" && (
        <>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" />
        </>
      )}
      {category === "vga" && (
        <>
          <rect x="3" y="6" width="18" height="11" rx="2" />
          <circle cx="10" cy="11.5" r="3" />
          <path d="M15 9h3m-3 3h3m-3 3h2M6 17v2m11-2v2" />
        </>
      )}
      {category === "ram" && (
        <>
          <rect x="2.5" y="7" width="19" height="9" rx="1.5" />
          <path d="M6 10v3m4-3v3m4-3v3m4-3v3M6 16v2m4-2v2m4-2v2m4-2v2" />
        </>
      )}
      {category === "mainboard" && (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <rect x="7" y="6" width="7" height="7" rx="1" />
          <path d="M16 6h2m-2 3h2m-2 4h2M7 16h4m3 0h4M7 19h8" />
        </>
      )}
      {category === "ssd" && (
        <>
          <rect x="6" y="2.5" width="12" height="19" rx="2" />
          <circle cx="12" cy="9" r="3" />
          <path d="M9 16h6m-4 3h2" />
        </>
      )}
      {category === "hdd" && (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <circle cx="12" cy="10" r="4" />
          <path d="m15 13 2 2m-8 3h6" />
        </>
      )}
      {category === "man hinh" && (
        <>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8m-4-4v4" />
        </>
      )}
      {category === "nguon" && (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="11" cy="12" r="4" />
          <path d="M17 8v3m0 3v2M11 8v8M7.5 10l7 4m0-4-7 4" />
        </>
      )}
      {(category === "case" || category === "barebone") && (
        <>
          <rect x="6" y="2.5" width="12" height="19" rx="2" />
          <circle cx="12" cy="8" r="2.5" />
          <circle cx="12" cy="15" r="3.5" />
          <path d="M15.5 4.5h.01" />
        </>
      )}
      {category === "tan nhiet" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 10c.4-3.4 2-5.2 4.2-4.5 2.1.7 2.5 3.1.5 5.2M14 12c3.4.4 5.2 2 4.5 4.2-.7 2.1-3.1 2.5-5.2.5M12 14c-.4 3.4-2 5.2-4.2 4.5-2.1-.7-2.5-3.1-.5-5.2M10 12c-3.4-.4-5.2-2-4.5-4.2.7-2.1 3.1-2.5 5.2-.5" />
        </>
      )}
      {!DISPLAY_CATEGORY_ORDER.includes(category) && category !== "all" && (
        <>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
        </>
      )}
    </svg>
  );
}

function categoryButtonClass(isSelected) {
  return `group relative inline-flex h-11 items-center gap-2 whitespace-nowrap px-2 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0b63f6] sm:h-14 sm:px-2.5 sm:text-sm lg:h-16 lg:gap-2.5 lg:px-3 lg:text-[0.9375rem] min-[2200px]:h-[4.5rem] min-[2200px]:px-4 min-[2200px]:text-base ${
    isSelected
      ? "bg-blue-50/70 text-[#0755d8] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#0b63f6]"
      : "text-[#0b4fb3] hover:bg-blue-50 hover:text-[#0755d8]"
  }`;
}

export function PublicCategoryNav({ categories, onSelectCategory, selectedCategoryId }) {
  const visibleCategories = (Array.isArray(categories) ? categories : [])
    .filter(
      (category) =>
        Number(category?.id) > 0 &&
        category?.is_active !== false &&
        category?.is_active !== 0 &&
        DISPLAY_CATEGORY_ORDER.includes(getCategoryNavigationKey(category))
    )
    .sort((left, right) => {
      const orderDifference = getCategoryDisplayOrder(left) - getCategoryDisplayOrder(right);
      return orderDifference || String(left.name).localeCompare(String(right.name), "vi");
    });
  const activeChipRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const selectedId = selectedCategoryId === null || selectedCategoryId === undefined ? null : Number(selectedCategoryId);

  useEffect(() => {
    const activeChip = activeChipRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!activeChip || !scrollContainer) return;

    const nextScrollLeft = activeChip.offsetLeft - (scrollContainer.clientWidth - activeChip.offsetWidth) / 2;
    scrollContainer.scrollTo({ left: Math.max(0, nextScrollLeft), behavior: "smooth" });
  }, [selectedId]);

  if (!visibleCategories.length) return null;

  return (
    <nav aria-label="Danh mục sản phẩm" className="relative border-b border-[#d6e5f7] bg-white shadow-[0_3px_10px_rgba(15,47,95,0.055)]">
      <div className="mx-auto w-[min(calc(100%_-_clamp(1.5rem,2vw,3rem)),clamp(80rem,96vw,154rem))] min-w-0">
        <div ref={scrollContainerRef} className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex min-w-max items-center gap-[clamp(0.25rem,0.7vw,1rem)] xl:w-full xl:justify-between">
            <li>
              <button
                ref={selectedId === null ? activeChipRef : null}
                type="button"
                aria-current={selectedId === null ? "page" : undefined}
                aria-pressed={selectedId === null}
                onClick={() => onSelectCategory(null)}
                className={categoryButtonClass(selectedId === null)}
              >
                <CategoryIcon name="all" />
                <span>Tất cả</span>
              </button>
            </li>
            {visibleCategories.map((category) => {
              const isSelected = Number(category.id) === selectedId;
              return (
                <li key={category.id}>
                  <button
                    ref={isSelected ? activeChipRef : null}
                    type="button"
                    aria-current={isSelected ? "page" : undefined}
                    aria-pressed={isSelected}
                    onClick={() => onSelectCategory(category)}
                    className={categoryButtonClass(isSelected)}
                  >
                    <CategoryIcon name={getCategoryNavigationKey(category)} />
                    <span>{getCategoryDisplayName(category)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-l from-white via-white/80 to-transparent sm:hidden" />
    </nav>
  );
}
