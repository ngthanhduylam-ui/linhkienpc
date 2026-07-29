import { apiDelete, apiGet, apiPatch, apiPost } from "../api/apiClient";

const RULES_PATH = "/admin/sku-category-rules";

export async function listSkuCategoryRules() {
  const response = await apiGet(RULES_PATH);
  return response?.data || [];
}

export async function createSkuCategoryRule(payload) {
  const response = await apiPost(RULES_PATH, payload);
  return response?.data || null;
}

export async function updateSkuCategoryRule(id, payload) {
  const response = await apiPatch(`${RULES_PATH}/${encodeURIComponent(id)}`, payload);
  return response?.data || null;
}

export async function deleteSkuCategoryRule(id) {
  const response = await apiDelete(`${RULES_PATH}/${encodeURIComponent(id)}`);
  return response?.data || null;
}
