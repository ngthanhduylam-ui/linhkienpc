import { apiGet } from "../api/apiClient";

export async function searchPublicProducts(keyword) {
  const trimmedKeyword = keyword?.trim();
  if (!trimmedKeyword) return [];

  const response = await apiGet("/public/products", { q: trimmedKeyword, page: 1, limit: 20 });
  const products = response?.data || [];

  return products.map((product, index) => ({
    id: `${product.sku}-${index}`,
    name: product.name,
    sku: product.sku,
    categoryName: product.category?.name || product.category_name || "",
    totalQuantity: Number(product.total_quantity || 0),
    noteGroups: (product.note_groups || []).map((item) => ({
      note: item.note,
      label: item.label || item.note || "Không ghi chú",
      quantity: Number(item.quantity || 0)
    }))
  }));
}
