import { useEffect, useRef } from "react";

const DISPLAY_CATEGORY_ORDER = [
  "cpu",
  "mainboard",
  "ram",
  "vga",
  "ssd",
  "hdd",
  "nguon",
  "man hinh",
  "case",
  "barebone",
  "laptop"
];

function normalizeCategoryName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .trim()
    .toLowerCase();
}

function getCategoryDisplayOrder(category) {
  const position = DISPLAY_CATEGORY_ORDER.indexOf(normalizeCategoryName(category?.name));
  return position === -1 ? DISPLAY_CATEGORY_ORDER.length : position;
}

export function PublicCategoryNav({ categories, onSelectCategory, selectedCategoryId }) {
  const visibleCategories = (Array.isArray(categories) ? categories : [])
    .filter(
      (category) =>
        Number(category?.id) > 0 &&
        category?.is_active !== false &&
        category?.is_active !== 0 &&
        String(category?.name || "").trim()
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
    <nav aria-label="Danh mục sản phẩm" className="border-b border-[#d9e6f5] bg-[#f3f8ff]">
      <div className="mx-auto flex w-[min(calc(100%_-_clamp(2rem,3vw,6rem)),clamp(80rem,86vw,131.25rem))] min-w-0 items-center gap-[clamp(0.75rem,1vw,1rem)] overflow-hidden py-[clamp(0.625rem,0.7vw,0.75rem)]">
        <p className="shrink-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[#0f2f5f]">Danh mục</p>
        <div ref={scrollContainerRef} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max max-w-none items-center gap-1.5 pr-2 sm:gap-2">
            <li>
              <button
                ref={selectedId === null ? activeChipRef : null}
                type="button"
                aria-current={selectedId === null ? "page" : undefined}
                aria-pressed={selectedId === null}
                onClick={() => onSelectCategory(null)}
                className={`inline-flex h-[clamp(2rem,1.9vw,2.25rem)] items-center rounded-full border px-[clamp(0.875rem,0.9vw,1rem)] text-[clamp(0.875rem,0.75vw,0.9375rem)] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] focus-visible:ring-offset-2 ${
                  selectedId === null
                    ? "border-[#0b63f6] bg-[#0b63f6] text-white"
                    : "border-[#d9e6f5] bg-white text-[#0b4fb3] hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                Tất cả
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
                    className={`inline-flex h-[clamp(2rem,1.9vw,2.25rem)] items-center rounded-full border px-[clamp(0.875rem,0.9vw,1rem)] text-[clamp(0.875rem,0.75vw,0.9375rem)] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b63f6] focus-visible:ring-offset-2 ${
                      isSelected
                        ? "border-[#0b63f6] bg-[#0b63f6] text-white"
                        : "border-[#d9e6f5] bg-white text-[#0b4fb3] hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {category.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
