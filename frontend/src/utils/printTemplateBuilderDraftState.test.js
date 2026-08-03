import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILDER_STORAGE_KEY,
  commitBuilderHistory,
  createBuilderHistory,
  createDefaultBuilderDocument,
  nudgeBuilderBlock,
  removeBuilderDocumentFromStorage,
  undoBuilderHistory
} from "./printTemplateBuilderLab.js";
import {
  applyBuilderDraftSaveResponse,
  BUILDER_DRAFT_PATH,
  buildBuilderDraftSavePayload,
  builderDraftFingerprint,
  isBuilderDraftConflictError,
  isBuilderDraftDirty,
  resolveInitialBuilderSources
} from "./printTemplateBuilderDraftState.js";

let nextId = 0;
function documentFactory() {
  return createDefaultBuilderDocument(null, () => `test-${nextId++}`);
}

test("backend draft response becomes the working document and server baseline", () => {
  const draft = documentFactory();
  const source = resolveInitialBuilderSources({ draft, revision: 3, updated_at: "2026-08-03T10:00:00Z" }, { status: "absent" }, documentFactory);
  assert.deepEqual(source.document, draft);
  assert.equal(source.serverRevision, 3);
  assert.equal(source.serverDraftExists, true);
  assert.equal(source.sourceChoice, null);
  assert.equal(isBuilderDraftDirty(source.document, source.serverBaseline), false);
});

test("no-server plus local draft offers a browser-source choice without uploading it", () => {
  const local = documentFactory();
  const source = resolveInitialBuilderSources({ draft: null, revision: 0, updated_at: null }, { status: "valid", document: local }, documentFactory);
  assert.equal(source.serverDraftExists, false);
  assert.equal(source.sourceChoice, "local-only");
  assert.notDeepEqual(source.document, local);
});

test("differing server and local drafts load server and offer the local choice", () => {
  const server = documentFactory();
  const local = structuredClone(server);
  local.blocks[0].xMm += 2;
  const source = resolveInitialBuilderSources({ draft: server, revision: 2 }, { status: "valid", document: local }, documentFactory);
  assert.deepEqual(source.document, server);
  assert.equal(source.sourceChoice, "different");
});

test("backend save response updates revision and clears server dirty state", () => {
  const document = documentFactory();
  const changed = nudgeBuilderBlock(document, document.blocks[0].id, 2, 0);
  const saved = applyBuilderDraftSaveResponse({ draft: changed, revision: 7, updated_at: "2026-08-03T11:00:00Z" });
  assert.equal(saved.serverRevision, 7);
  assert.equal(saved.serverDraftExists, true);
  assert.equal(isBuilderDraftDirty(changed, saved.serverBaseline), false);
});

test("server JSON key reordering does not produce a false dirty state", () => {
  const document = documentFactory();
  const reordered = structuredClone(document);
  const table = reordered.blocks.find((block) => block.type === "productTable");
  table.props.columnWidthWeights = Object.fromEntries(Object.entries(table.props.columnWidthWeights).reverse());
  table.props.columnVisibility = Object.fromEntries(Object.entries(table.props.columnVisibility).reverse());
  assert.equal(builderDraftFingerprint(reordered), builderDraftFingerprint(document));
  assert.equal(isBuilderDraftDirty(document, builderDraftFingerprint(reordered)), false);
});

test("local save cannot falsely clear a differing server baseline", () => {
  const server = documentFactory();
  const changed = nudgeBuilderBlock(server, server.blocks[0].id, 2, 0);
  const baseline = builderDraftFingerprint(server);
  const localSnapshot = builderDraftFingerprint(changed);
  assert.notEqual(localSnapshot, baseline);
  assert.equal(isBuilderDraftDirty(changed, baseline), true);
});

test("stale conflict detection is exact and preserves the caller-owned document", () => {
  const document = documentFactory();
  const snapshot = structuredClone(document);
  const conflict = { status: 409, payload: { error: { code: "PRINT_TEMPLATE_BUILDER_DRAFT_CONFLICT" } } };
  assert.equal(isBuilderDraftConflictError(conflict), true);
  assert.equal(isBuilderDraftConflictError({ status: 409, payload: { error: { code: "OTHER" } } }), false);
  assert.deepEqual(document, snapshot);
});

test("save payload contains only canonical draft and expected revision", () => {
  const payload = buildBuilderDraftSavePayload(documentFactory(), 4);
  assert.deepEqual(Object.keys(payload), ["draft", "expected_revision"]);
  assert.equal(payload.expected_revision, 4);
  assert.deepEqual(Object.keys(payload.draft), ["builderSchemaVersion", "paper", "blocks"]);
  assert.equal("active_template" in payload, false);
  assert.equal("custom_template_config" in payload, false);
  assert.equal(BUILDER_DRAFT_PATH, "/admin/print-template-settings/sale-delivery-note/builder-draft");
});

test("delete-local operation touches only the dedicated Builder Lab key", () => {
  const removed = [];
  const storage = { removeItem: (key) => removed.push(key) };
  assert.equal(removeBuilderDocumentFromStorage(storage), true);
  assert.deepEqual(removed, [BUILDER_STORAGE_KEY]);
});

test("undo remains available after a backend document is loaded as a fresh baseline", () => {
  const loaded = documentFactory();
  let history = createBuilderHistory(loaded);
  history = commitBuilderHistory(history, nudgeBuilderBlock(loaded, loaded.blocks[0].id, 2, 0));
  assert.deepEqual(undoBuilderHistory(history).present, loaded);
});
