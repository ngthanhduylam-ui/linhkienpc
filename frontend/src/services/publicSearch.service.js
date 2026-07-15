import { apiGet } from "../api/apiClient";

let publicCategoriesPromise = null;
let publicCatalogueSuggestionsPromise = null;
let availableCatalogueConditionProductsPromise = null;
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

function mapPublicProducts(products) {
  return products.map((product, index) => {
    const productId = Number(product.id || product.note_groups?.find((item) => item?.product_id)?.product_id) || null;
    const images = Array.isArray(product.images) ? product.images : [];

    return {
      id: productId || product.sku || `public-product-${index}`,
      productId,
      name: product.name,
      sku: product.sku,
      salePrice:
        product.sale_price === null || product.sale_price === undefined
          ? null
          : Number(product.sale_price),
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
  });
}

export async function searchPublicProducts(keyword, options = {}) {
  const trimmedKeyword = keyword?.trim();
  if (!trimmedKeyword) {
    return { products: [], hasHiddenOutOfStockMatches: false, totalMatches: 0 };
  }

  const { limit = 20, ...requestOptions } = options;
  const response = await apiGet("/public/products", { q: trimmedKeyword, page: 1, limit }, requestOptions);
  const products = Array.isArray(response?.data) ? response.data : [];

  return {
    products: mapPublicProducts(products),
    hasHiddenOutOfStockMatches: response?.meta?.has_hidden_out_of_stock_matches === true,
    totalMatches: Number(response?.meta?.total || products.length)
  };
}

export async function listPublicCategoryProducts(categoryId, options = {}) {
  const { page = 1, limit = 24, ...requestOptions } = options;
  const response = await apiGet("/public/products", { category_id: categoryId, page, limit }, requestOptions);
  const products = Array.isArray(response?.data) ? response.data : [];

  return {
    products: mapPublicProducts(products),
    page: Number(response?.meta?.page || page),
    limit: Number(response?.meta?.limit || limit),
    totalMatches: Number(response?.meta?.total || products.length)
  };
}

function requestPublicCatalogueSuggestions(excludedIds, options) {
  const { limit, ...requestOptions } = options;
  const safeExcludedIds = Array.from(
    new Set(
      (Array.isArray(excludedIds) ? excludedIds : [])
        .map(Number)
        .filter((id) => Number.isSafeInteger(id) && id > 0)
        .slice(0, 24)
    )
  );
  const query = { limit };
  if (safeExcludedIds.length) query.exclude_ids = safeExcludedIds.join(",");

  return apiGet("/public/catalogue/suggestions", query, requestOptions).then((response) => {
    const products = Array.isArray(response?.data) ? response.data : [];
    return mapPublicProducts(products);
  });
}

export function listPublicCatalogueSuggestions(excludedIds = [], options = {}) {
  const { limit = 6, forceRefresh = false, ...requestOptions } = options;
  const load = () => requestPublicCatalogueSuggestions(excludedIds, { limit, ...requestOptions });

  if (forceRefresh) {
    return load();
  }

  if (!publicCatalogueSuggestionsPromise) {
    const currentPromise = load().finally(() => {
      if (publicCatalogueSuggestionsPromise === currentPromise) {
        publicCatalogueSuggestionsPromise = null;
      }
    });
    publicCatalogueSuggestionsPromise = currentPromise;
  }
  return publicCatalogueSuggestionsPromise;
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

export function composeCatalogueSections(secondhandProducts, newProducts) {
  const secondhandCandidates = secondhandProducts.filter((product) => getCatalogueCondition(product) === "2nd");
  const newCandidates = newProducts.filter((product) => getCatalogueCondition(product) === "new");
  const secondhand = takeUniqueAvailableProducts(
    secondhandCandidates,
    CATALOGUE_SECTION_LIMIT,
    new Set()
  );
  const newItems = takeUniqueAvailableProducts(
    newCandidates,
    CATALOGUE_SECTION_LIMIT,
    new Set()
  );

  return { secondhand, new: newItems };
}

export function listAvailableCatalogueConditionProducts() {
  if (!availableCatalogueConditionProductsPromise) {
    availableCatalogueConditionProductsPromise = Promise.all([
      searchPublicProducts("2nd", { limit: CATALOGUE_FETCH_LIMIT }),
      searchPublicProducts("new", { limit: CATALOGUE_FETCH_LIMIT })
    ])
      .then(([secondhandResult, newResult]) => {
        return composeCatalogueSections(secondhandResult.products, newResult.products);
      })
      .catch((error) => {
        availableCatalogueConditionProductsPromise = null;
        throw error;
      });
  }

  return availableCatalogueConditionProductsPromise;
}
