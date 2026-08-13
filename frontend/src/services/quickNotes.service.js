import { apiDelete, apiGet, apiPatch, apiPost } from "../api/apiClient";

const QUICK_NOTES_PATH = "/admin/quick-notes";

export async function listQuickNotes({ status = "all", limit = 100 } = {}) {
  const response = await apiGet(QUICK_NOTES_PATH, { status, limit });
  return {
    items: response?.data || [],
    pendingCount: Number(response?.meta?.pending_count || 0)
  };
}

export async function createQuickNote(content) {
  const response = await apiPost(QUICK_NOTES_PATH, { content });
  return response?.data || null;
}

export async function updateQuickNote(id, payload) {
  const response = await apiPatch(`${QUICK_NOTES_PATH}/${encodeURIComponent(id)}`, payload);
  return response?.data || null;
}

export async function deleteQuickNote(id) {
  const response = await apiDelete(`${QUICK_NOTES_PATH}/${encodeURIComponent(id)}`);
  return response?.data || null;
}
