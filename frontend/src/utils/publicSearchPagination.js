export const PUBLIC_SEARCH_PAGE_SIZE = 20;

export function dedupePublicProducts(products) {
  const usedKeys = new Set();
  return (Array.isArray(products) ? products : []).filter((product) => {
    const productId = Number(product?.productId);
    const key = Number.isInteger(productId) && productId > 0 ? `id:${productId}` : "";
    if (!key || usedKeys.has(key) || Number(product?.totalQuantity || 0) <= 0) return false;
    usedKeys.add(key);
    return true;
  });
}

export function mergePublicSearchPages(currentProducts, nextProducts) {
  return dedupePublicProducts([
    ...(Array.isArray(currentProducts) ? currentProducts : []),
    ...(Array.isArray(nextProducts) ? nextProducts : [])
  ]);
}

export function getPublicSearchLoadMoreCount(loadedCount, totalMatches, pageSize = PUBLIC_SEARCH_PAGE_SIZE) {
  const loaded = Math.max(0, Number(loadedCount) || 0);
  const total = Math.max(0, Number(totalMatches) || 0);
  const limit = Math.max(0, Number(pageSize) || 0);
  return Math.min(limit, Math.max(0, total - loaded));
}
