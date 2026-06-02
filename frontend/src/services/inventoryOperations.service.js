import { apiGet, apiPost } from "../api/apiClient";

export async function listActiveProducts() {
  const response = await apiGet("/admin/products", { page: 1, limit: 100 });
  return response?.data || [];
}

export async function listActiveCategories() {
  const response = await apiGet("/public/categories", { page: 1, limit: 100 });
  return response?.data || [];
}

export async function createProductRequest(payload) {
  console.log("[InventoryWorkbench] BEFORE createProductRequest", payload);
  const response = await apiPost("/admin/products", payload);
  console.log("[InventoryWorkbench] API response payload", response);
  return response?.data;
}

export async function createCategoryRequest(payload) {
  const rawName = (payload?.name || "").trim();
  const asciiName = rawName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const baseCode = asciiName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const uniqueSuffix = Date.now().toString(36).slice(-6);
  const finalBase = baseCode.length >= 2 ? baseCode : "dm";
  const code = `${finalBase}-${uniqueSuffix}`.slice(0, 50);

  const response = await apiPost("/admin/categories", {
    name: rawName,
    code
  });
  return response?.data;
}

export async function stockInRequest(payload) {
  const response = await apiPost("/admin/stock-in", payload);
  return response?.data;
}

export async function stockOutRequest(payload) {
  const response = await apiPost("/admin/stock-out", payload);
  return response?.data;
}

export async function getProductInventoryRequest(sku) {
  const response = await apiGet(`/public/products/${encodeURIComponent(sku)}/inventory`);
  return response?.data;
}

export async function listStockTransactions(params) {
  const query = {
    page: params.page || 1,
    limit: params.limit || 10
  };

  if (params.sku) query.sku = params.sku;
  if (params.txn_type) query.txn_type = params.txn_type;
  if (params.note) query.note = params.note;

  const response = await apiGet("/admin/stock-transactions", query);
  return {
    items: response?.data || [],
    meta: response?.meta || { page: 1, limit: 10, total: 0 }
  };
}
