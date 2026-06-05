import { apiGet, apiPatch, apiPost } from "../api/apiClient";

export async function listActiveProducts() {
  const response = await apiGet("/admin/products", { page: 1, limit: 100 });
  return response?.data || [];
}

export async function listProductsPage({ keyword = "", page = 1, limit = 20 } = {}) {
  const query = { page, limit };
  if (keyword.trim()) query.q = keyword.trim();

  const response = await apiGet("/admin/products", query);
  return {
    items: response?.data || [],
    meta: response?.meta || {
      page,
      limit,
      total: 0,
      total_pages: 1
    }
  };
}

export async function listActiveCategories() {
  const response = await apiGet("/public/categories", { page: 1, limit: 100 });
  return response?.data || [];
}

export async function listCustomers(keyword = "") {
  const query = keyword.trim() ? { keyword: keyword.trim(), limit: 20 } : { limit: 20 };
  const response = await apiGet("/admin/customers", query);
  return response?.data || [];
}

export async function listCustomersPage({ keyword = "", page = 1, limit = 10 } = {}) {
  const query = { page, limit };
  if (keyword.trim()) query.keyword = keyword.trim();

  const response = await apiGet("/admin/customers", query);
  return {
    items: response?.data || [],
    meta: response?.meta || { page, limit, total: 0 }
  };
}

export async function getCustomerRequest(id) {
  const response = await apiGet(`/admin/customers/${encodeURIComponent(id)}`);
  return response?.data;
}

export async function listCustomerTransactions(id, { page = 1, limit = 10 } = {}) {
  const response = await apiGet(`/admin/customers/${encodeURIComponent(id)}/transactions`, { page, limit });
  return {
    items: response?.data || [],
    meta: response?.meta || { page, limit, total: 0 }
  };
}

export async function createCustomer(payload) {
  const response = await apiPost("/admin/customers", payload);
  return response?.data;
}

export async function updateCustomerRequest(id, payload) {
  const response = await apiPatch(`/admin/customers/${encodeURIComponent(id)}`, payload);
  return response?.data;
}

export async function listSuppliers(keyword = "") {
  const query = keyword.trim() ? { keyword: keyword.trim(), limit: 20 } : { limit: 20 };
  const response = await apiGet("/admin/suppliers", query);
  return response?.data || [];
}

export async function listSuppliersPage({ keyword = "", page = 1, limit = 10 } = {}) {
  const query = { page, limit };
  if (keyword.trim()) query.keyword = keyword.trim();

  const response = await apiGet("/admin/suppliers", query);
  return {
    items: response?.data || [],
    meta: response?.meta || { page, limit, total: 0 }
  };
}

export async function createSupplier(payload) {
  const response = await apiPost("/admin/suppliers", payload);
  return response?.data;
}

export async function updateSupplierRequest(id, payload) {
  const response = await apiPatch(`/admin/suppliers/${encodeURIComponent(id)}`, payload);
  return response?.data;
}

export async function createProductRequest(payload) {
  console.log("[InventoryWorkbench] BEFORE createProductRequest", payload);
  const response = await apiPost("/admin/products", payload);
  console.log("[InventoryWorkbench] API response payload", response);
  return response?.data;
}

export async function updateProductRequest(id, payload) {
  const response = await apiPatch(`/admin/products/${encodeURIComponent(id)}`, payload);
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

export async function bulkStockInRequest(payload) {
  const response = await apiPost("/admin/stock-in/bulk", payload);
  return response?.data;
}

export async function stockOutRequest(payload) {
  const response = await apiPost("/admin/stock-out", payload);
  return response?.data;
}

export async function bulkStockOutRequest(payload) {
  const response = await apiPost("/admin/stock-out/bulk", payload);
  return response?.data;
}

export async function getProductInventoryRequest(sku) {
  const response = await apiGet(`/public/products/${encodeURIComponent(sku)}/inventory`);
  return response?.data;
}

export async function searchInventoryCheckProducts(keyword = "") {
  const query = keyword.trim() ? { keyword: keyword.trim(), page: 1, limit: 20 } : { page: 1, limit: 20 };
  const response = await apiGet("/admin/inventory-check/products", query);
  return response?.data || [];
}

export async function getInventoryCheckProduct(sku) {
  const response = await apiGet(`/admin/inventory-check/products/${encodeURIComponent(sku)}`);
  return response?.data;
}

export async function moveInventoryNoteGroup(payload) {
  const response = await apiPost("/admin/inventory-check/note-move", payload);
  return response?.data;
}

export async function adjustInventoryQuantity(payload) {
  const response = await apiPost("/admin/inventory-check/quantity-adjust", payload);
  return response?.data;
}

export async function listStockTransactions(params) {
  const query = {
    page: params.page || 1,
    limit: params.limit || 10
  };

  if (params.keyword) query.keyword = params.keyword;
  if (params.sku) query.sku = params.sku;
  if (params.txn_type) query.txn_type = params.txn_type;
  if (params.note) query.note = params.note;

  const response = await apiGet("/admin/stock-transactions", query);
  return {
    items: response?.data || [],
    meta: response?.meta || { page: 1, limit: 10, total: 0 }
  };
}

export async function listStockVouchers(params = {}) {
  const query = {
    page: params.page || 1,
    limit: params.limit || 10
  };

  if (params.keyword) query.keyword = params.keyword;
  if (params.type) query.type = params.type;

  const response = await apiGet("/admin/stock-vouchers", query);
  return {
    items: response?.data || [],
    meta: response?.meta || { page: query.page, limit: query.limit, total: 0 }
  };
}

export async function getStockVoucherRequest(id) {
  const response = await apiGet(`/admin/stock-vouchers/${encodeURIComponent(id)}`);
  return response?.data;
}
