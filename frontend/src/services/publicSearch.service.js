import { apiGet } from "../api/apiClient";

let publicCategoriesPromise = null;
let availableCatalogueProductsPromise = null;

export function listPublicCategories() {
  if (!publicCategoriesPromise) {
    publicCategoriesPromise = apiGet("/public/categories", { page: 1, limit: 100, is_active: true })
      .then((response) => (Array.isArray(response?.data) ? response.data : []))
      .catch((error) => {
        publicCategoriesPromise = null;
        throw error;
      });
  }
  return publicCategoriesPromise;
}

export async function listPublicProductImages(sku, options = {}) {
  const response = await apiGet(`/public/products/${encodeURIComponent(sku)}/images`, {}, options);
  return response?.data?.images || [];
}

export async function searchPublicProducts(keyword, options = {}) {
  const trimmedKeyword = keyword?.trim();
  if (!trimmedKeyword) {
    return { products: [], hasHiddenOutOfStockMatches: false };
  }

  const { limit = 20, ...requestOptions } = options;
  const response = await apiGet("/public/products", { q: trimmedKeyword, page: 1, limit }, requestOptions);
  const products = Array.isArray(response?.data) ? response.data : [];

  return {
    products: products.map((product, index) => {
      const productId = Number(product.id || product.note_groups?.find((item) => item?.product_id)?.product_id) || null;
      const images = Array.isArray(product.images) ? product.images : [];

      return {
        id: productId || product.sku || `public-product-${index}`,
        productId,
        name: product.name,
        sku: product.sku,
        categoryName: product.category?.name || product.category_name || "",
        imageCount: Number(product.image_count || 0),
        primaryImage: product.primary_image || images[0] || null,
        images,
        totalQuantity: Number(product.total_quantity || 0),
        noteGroups: (product.note_groups || []).map((item) => ({
          note: item.note,
          label: item.label || item.note || "Không ghi chú",
          quantity: Number(item.quantity || 0)
        }))
      };
    }),
    hasHiddenOutOfStockMatches: response?.meta?.has_hidden_out_of_stock_matches === true
  };
}

function getCatalogueCondition(product) {
  const firstSkuToken = String(product?.sku || "").trim().toLowerCase().split(/[.\s_-]+/)[0];
  return firstSkuToken === "2nd" || firstSkuToken === "new" ? firstSkuToken : "";
}

function getCatalogueProductKey(product) {
  if (product?.productId) return `id:${product.productId}`;
  const normalizedSku = String(product?.sku || "").trim().toLowerCase();
  return normalizedSku ? `sku:${normalizedSku}` : "";
}

function takeUniqueAvailableProducts(candidates, limit, usedKeys) {
  const selected = [];

  for (const product of candidates) {
    if (selected.length >= limit) break;
    if (Number(product?.totalQuantity || 0) <= 0) continue;

    const key = getCatalogueProductKey(product);
    if (!key || usedKeys.has(key)) continue;

    usedKeys.add(key);
    selected.push(product);
  }

  return selected;
}

function interleaveCatalogueProducts(secondhandProducts, newProducts) {
  const products = [];
  const maxLength = Math.max(secondhandProducts.length, newProducts.length);

  for (let index = 0; index < maxLength; index += 1) {
    if (secondhandProducts[index]) products.push(secondhandProducts[index]);
    if (newProducts[index]) products.push(newProducts[index]);
  }

  return products.slice(0, 6);
}

export function listAvailableCatalogueProducts() {
  if (!availableCatalogueProductsPromise) {
    availableCatalogueProductsPromise = Promise.all([
      searchPublicProducts("2nd", { limit: 6 }),
      searchPublicProducts("new", { limit: 6 })
    ])
      .then(([secondhandResult, newResult]) => {
        const usedKeys = new Set();
        const newCandidates = newResult.products.filter((product) => getCatalogueCondition(product) === "new");
        const secondhandCandidates = secondhandResult.products.filter(
          (product) => getCatalogueCondition(product) === "2nd"
        );
        const selectedNew = takeUniqueAvailableProducts(newCandidates, 2, usedKeys);
        const selectedSecondhand = takeUniqueAvailableProducts(secondhandCandidates, 6 - selectedNew.length, usedKeys);

        return interleaveCatalogueProducts(selectedSecondhand, selectedNew);
      })
      .catch((error) => {
        availableCatalogueProductsPromise = null;
        throw error;
      });
  }

  return availableCatalogueProductsPromise;
}
