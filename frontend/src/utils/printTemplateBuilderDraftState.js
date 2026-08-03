import {
  createDefaultBuilderDocument,
  normalizeBuilderLabDocumentToCanonical,
  serializeBuilderDocument
} from "./printTemplateBuilderLab.js";

export const BUILDER_DRAFT_PATH = "/admin/print-template-settings/sale-delivery-note/builder-draft";

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])])
    );
  }
  return value;
}

export function buildBuilderDraftSavePayload(document, expectedRevision) {
  return {
    draft: serializeBuilderDocument(document),
    expected_revision: expectedRevision
  };
}

export function builderDraftFingerprint(document) {
  return JSON.stringify(stableJsonValue(serializeBuilderDocument(document)));
}

export function normalizeServerBuilderDraft(response) {
  if (!response?.draft) return null;
  const normalized = normalizeBuilderLabDocumentToCanonical(response.draft);
  if (!normalized.ok) throw new Error("Bản nháp hệ thống không hợp lệ.");
  return normalized.document;
}

export function resolveInitialBuilderSources(response, localInspection, defaultFactory = createDefaultBuilderDocument) {
  const serverDocument = normalizeServerBuilderDraft(response);
  const document = serverDocument || defaultFactory();
  const baseline = builderDraftFingerprint(document);
  const localDocument = localInspection?.status === "valid" ? localInspection.document : null;
  return {
    document,
    serverBaseline: baseline,
    serverRevision: response?.revision ?? 0,
    serverUpdatedAt: response?.updated_at ?? null,
    serverDraftExists: Boolean(serverDocument),
    sourceChoice: localDocument && builderDraftFingerprint(localDocument) !== baseline
      ? (serverDocument ? "different" : "local-only")
      : null,
    localInvalid: localInspection?.status === "invalid"
  };
}

export function applyBuilderDraftSaveResponse(response) {
  const document = normalizeServerBuilderDraft(response);
  if (!document) throw new Error("Máy chủ không trả về bản nháp đã lưu.");
  return {
    document,
    serverBaseline: builderDraftFingerprint(document),
    serverRevision: response.revision,
    serverUpdatedAt: response.updated_at,
    serverDraftExists: true
  };
}

export function isBuilderDraftDirty(document, serverBaseline) {
  return builderDraftFingerprint(document) !== serverBaseline;
}

export function isBuilderDraftConflictError(error) {
  return error?.status === 409
    && error?.payload?.error?.code === "PRINT_TEMPLATE_BUILDER_DRAFT_CONFLICT";
}
