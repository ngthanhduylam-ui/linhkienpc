import { apiGet } from "../api/apiClient";

let publicCategoriesPromise = null;
let availableCatalogueProductsPromise = null;
const CATALOGUE_SECTION_LIMIT = 6;
const CATALOGUE_FETCH_LIMIT = 20;

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

function interleaveNewestCatalogueProducts(newProducts, secondhandProducts) {
  const interleaved = [];
  const maxLength = Math.max(newProducts.length, secondhandProducts.length);

  for (let index = 0; index < maxLength; index += 1) {
    if (newProducts[index]) interleaved.push(newProducts[index]);
    if (secondhandProducts[index]) interleaved.push(secondhandProducts[index]);
  }

  return interleaved;
}

export function composeCatalogueSections(secondhandProducts, newProducts) {
  const secondhandCandidates = secondhandProducts.filter((product) => getCatalogueCondition(product) === "2nd");
  const newCandidates = newProducts.filter((product) => getCatalogueCondition(product) === "new");
  const newestUsedKeys = new Set();
  const newest = takeUniqueAvailableProducts(
    interleaveNewestCatalogueProducts(newCandidates, secondhandCandidates),
    CATALOGUE_SECTION_LIMIT,
    newestUsedKeys
  );
  const sectionUsedKeys = new Set(newestUsedKeys);
  const secondhand = takeUniqueAvailableProducts(
    secondhandCandidates,
    CATALOGUE_SECTION_LIMIT,
    sectionUsedKeys
  );
  const newItems = takeUniqueAvailableProducts(
    newCandidates,
    CATALOGUE_SECTION_LIMIT,
    sectionUsedKeys
  );

  return { newest, secondhand, new: newItems };
}

export function listAvailableCatalogueProducts() {
  if (!availableCatalogueProductsPromise) {
    availableCatalogueProductsPromise = Promise.all([
      searchPublicProducts("2nd", { limit: CATALOGUE_FETCH_LIMIT }),
      searchPublicProducts("new", { limit: CATALOGUE_FETCH_LIMIT })
    ])
      .then(([secondhandResult, newResult]) => {
        return composeCatalogueSections(secondhandResult.products, newResult.products);
      })
      .catch((error) => {
        availableCatalogueProductsPromise = null;
        throw error;
      });
  }

  return availableCatalogueProductsPromise;
}
