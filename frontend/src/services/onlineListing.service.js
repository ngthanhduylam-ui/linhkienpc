import { apiGet, apiGetBlob } from "../api/apiClient";

export async function listOnlineListingProducts({ keyword = "", page = 1, limit = 20 } = {}) {
  const query = {
    page,
    limit,
    is_active: "true"
  };

  if (keyword.trim()) {
    query.q = keyword.trim();
  }

  const response = await apiGet("/admin/products", query);
  const sourceItems = response?.data || [];
  const items = sourceItems.filter((product) => Number(product.total_quantity || 0) > 0);

  return {
    items,
    source_count: sourceItems.length,
    meta: response?.meta || {
      page,
      limit,
      total: 0,
      total_pages: 1
    }
  };
}

export async function listOnlineListingProductImages(productId) {
  const response = await apiGet(`/admin/products/${encodeURIComponent(productId)}/images`);
  return response?.data || [];
}

export async function downloadOnlineListingProductImage(productId, image) {
  const blob = await apiGetBlob(
    `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(image.id)}/download`
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = image.original_name || "product-image";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}
