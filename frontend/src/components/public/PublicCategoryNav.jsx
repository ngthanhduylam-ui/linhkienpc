const QUICK_CATEGORY_GROUPS = [
  ["cpu"],
  ["mainboard", "main"],
  ["ram"],
  ["vga"],
  ["ssd"],
  ["hdd"],
  ["nguon", "psu"],
  ["man hinh", "lcd"],
  ["case"],
  ["barebone"],
  ["laptop"]
];

function normalizeCategoryName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();
}

function getQuickCategories(categories) {
  const activeCategories = (Array.isArray(categories) ? categories : [])
    .filter((category) => category?.is_active !== false && category?.is_active !== 0 && category?.name);
  const usedIds = new Set();

  return QUICK_CATEGORY_GROUPS.flatMap((aliases) => {
    const match = aliases
      .map((alias) => activeCategories.find((category) => normalizeCategoryName(category.name) === alias))
      .find(Boolean);
    if (!match || usedIds.has(String(match.id))) return [];
    usedIds.add(String(match.id));
    return [match];
  });
}

export function PublicCategoryNav({ categories }) {
  const quickCategories = getQuickCategories(categories);
  if (!quickCategories.length) return null;

  return (
    <nav aria-label="Danh mục sản phẩm" className="border-b border-[#d9e6f5] bg-[#f3f8ff]">
      <div className="mx-auto flex w-[min(calc(100%_-_clamp(2rem,3vw,6rem)),clamp(80rem,86vw,131.25rem))] min-w-0 items-center gap-[clamp(0.75rem,1vw,1rem)] overflow-hidden py-[clamp(0.625rem,0.7vw,0.75rem)]">
        <p className="shrink-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[#0f2f5f]">Danh mục</p>
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max max-w-none items-center gap-1.5 pr-2 sm:gap-2">
            {quickCategories.map((category) => (
              <li key={category.id}>
                <span className="inline-flex h-[clamp(2rem,1.9vw,2.25rem)] items-center rounded-full border border-[#d9e6f5] bg-white px-[clamp(0.875rem,0.9vw,1rem)] text-[clamp(0.875rem,0.75vw,0.9375rem)] font-semibold text-[#0b4fb3]">
                  {category.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
