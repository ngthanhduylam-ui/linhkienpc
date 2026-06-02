import { apiGet } from "../api/apiClient";

export async function searchPublicProducts(keyword) {
  const query = keyword?.trim() ? { q: keyword.trim(), page: 1, limit: 20 } : { page: 1, limit: 20 };
  const response = await apiGet("/public/products", query);
  const products = response?.data || [];
  return products.map((product, index) => ({
    id: `${product.sku}-${index}`,
    name: product.name,
    sku: product.sku,
    totalQuantity: Number(product.total_quantity || 0),
    noteGroups: (product.note_groups || []).map((item) => ({
      note: item.note,
      quantity: Number(item.quantity || 0)
    }))
  }));
}
