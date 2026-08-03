import { apiDelete, apiGet, apiPut } from "../api/apiClient";
import {
  BUILDER_DRAFT_PATH,
  buildBuilderDraftSavePayload
} from "../utils/printTemplateBuilderDraftState";

export { BUILDER_DRAFT_PATH, buildBuilderDraftSavePayload };

export async function getBuilderDraft(options = {}) {
  const response = await apiGet(BUILDER_DRAFT_PATH, {}, options);
  return response?.data ?? null;
}

export async function saveBuilderDraft(document, expectedRevision, options = {}) {
  const response = await apiPut(
    BUILDER_DRAFT_PATH,
    buildBuilderDraftSavePayload(document, expectedRevision),
    options
  );
  return response?.data ?? null;
}

export async function deleteBuilderDraft(expectedRevision, options = {}) {
  const response = await apiDelete(BUILDER_DRAFT_PATH, {
    ...options,
    body: { expected_revision: expectedRevision }
  });
  return response?.data ?? null;
}
