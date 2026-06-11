export const RECENT_CUSTOMERS_KEY = "recent_customers";
export const RECENT_SUPPLIERS_KEY = "recent_suppliers";
export const RECENT_PRODUCTS_KEY = "recent_products";

function getItemId(item) {
  return item?.id ?? item?.sku ?? item?.name ?? "";
}

export function readRecentItems(storageKey) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export function saveRecentItem(storageKey, item, maxItems) {
  if (!item) return [];
  if (item.is_active === false) return readRecentItems(storageKey);

  const itemId = getItemId(item);
  const currentItems = readRecentItems(storageKey);
  const nextItems = [
    item,
    ...currentItems.filter((currentItem) => String(getItemId(currentItem)) !== String(itemId))
  ].slice(0, maxItems);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(nextItems));
  } catch {
    return currentItems;
  }

  return nextItems;
}

export function mergeRecentFirst(recentItems, normalItems) {
  const recentIds = new Set(recentItems.map((item) => String(getItemId(item))));
  return [
    ...recentItems,
    ...normalItems.filter((item) => !recentIds.has(String(getItemId(item))))
  ];
}

export function filterRecentItemsByAvailable(recentItems, availableItems) {
  const availableById = new Map(
    availableItems
      .filter((item) => item?.is_active !== false)
      .map((item) => [String(getItemId(item)), item])
  );

  return recentItems
    .map((item) => availableById.get(String(getItemId(item))))
    .filter(Boolean);
}
