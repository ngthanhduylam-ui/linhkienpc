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
      <div className="mx-auto flex max-w-7xl min-w-0 items-center gap-3 overflow-hidden px-4 py-2.5 sm:px-6">
        <p className="shrink-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[#0f2f5f]">Danh mục</p>
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max max-w-none items-center gap-1.5 pr-2 sm:gap-2">
            {quickCategories.map((category) => (
              <li key={category.id}>
                <span className="inline-flex h-8 items-center rounded-full border border-[#d9e6f5] bg-white px-3.5 text-sm font-semibold text-[#0b4fb3]">
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
