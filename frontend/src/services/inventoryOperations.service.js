import { apiGet, apiPost } from "../api/apiClient";

export async function listActiveProducts() {
  const response = await apiGet("/admin/products", { page: 1, limit: 500 });
  return response?.data || [];
}

export async function listBatchesByProduct(productId) {
  if (!productId) return [];
  const response = await apiGet(`/admin/products/${productId}/batches`, { page: 1, limit: 500 });
  return response?.data || [];
}

export async function stockInRequest(payload) {
  const response = await apiPost("/admin/stock-in", payload);
  return response?.data;
}

export async function stockOutRequest(payload) {
  const response = await apiPost("/admin/stock-out", payload);
  return response?.data;
}

export async function listStockTransactions(params) {
  const query = {
    page: params.page || 1,
    limit: params.limit || 10
  };

  if (params.sku) query.sku = params.sku;
  if (params.batch_code) query.batch_code = params.batch_code;
  if (params.txn_type) query.txn_type = params.txn_type;

  const response = await apiGet("/admin/stock-transactions", query);
  return {
    items: response?.data || [],
    meta: response?.meta || { page: 1, limit: 10, total: 0 }
  };
}
