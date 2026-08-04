import { apiGet } from "../api/apiClient";

let publicCategoriesPromise = null;
let publicCatalogueSuggestionsPromise = null;

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

export async function listPublicProductImages(productId, options = {}) {
  const safeProductId = Number(productId);
  if (!Number.isSafeInteger(safeProductId) || safeProductId < 1) return [];
  const response = await apiGet(`/public/catalogue/products/${safeProductId}/images`, {}, options);
  return response?.data?.images || [];
}

function mapPublicProducts(products) {
  return products.map((product, index) => {
    const productId = Number(product.id) || null;
    const images = Array.isArray(product.images) ? product.images : [];

    return {
      id: productId || `public-product-${index}`,
      productId,
      name: product.name,
      condition: product.condition || null,
      salePrice:
        product.sale_price === null || product.sale_price === undefined
          ? null
          : Number(product.sale_price),
      categoryName: product.category?.name || product.category_name || "",
      specSummary: product.spec_summary,
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

export async function getPublicProductById(productId, options = {}) {
  const safeProductId = Number(productId);
  if (!Number.isSafeInteger(safeProductId) || safeProductId < 1) {
    return { products: [], hasHiddenOutOfStockMatches: false, totalMatches: 0 };
  }

  const response = await apiGet("/public/products", { product_id: safeProductId, page: 1, limit: 1 }, options);
  const products = Array.isArray(response?.data) ? response.data : [];
  return {
    products: mapPublicProducts(products),
    hasHiddenOutOfStockMatches: response?.meta?.has_hidden_out_of_stock_matches === true,
    totalMatches: Number(response?.meta?.total || products.length)
  };
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
