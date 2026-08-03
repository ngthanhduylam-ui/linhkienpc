import test from "node:test";
import assert from "node:assert/strict";
import {
  PRINT_TEMPLATE_LAYOUT_DEFAULTS,
  PRINT_TEMPLATE_SECTION_DEFINITIONS,
  cloneEditableTemplateConfig,
  compareTemplateConfigs,
  createNoticeEditorItems,
  deriveSafePreviewLayout,
  getSectionForFieldPath,
  getSectionNavigatorItems,
  getVisibleProductColumns,
  moveNoticeItem,
  normalizeEditableTemplateConfig,
  resetSectionLayoutFromSystem,
  selectEditorSection,
  serializeNoticeEditorItems,
  updateDraftSectionField,
  updateSectionVisibility,
  upgradePrintTemplateConfigToLatest,
  validateTemplateEditorDraft
} from "./printTemplateEditor.js";
import { SALE_DELIVERY_NOTE_PREVIEW_SAMPLE } from "../components/settings/saleDeliveryNotePreviewSample.js";

function config(overrides = {}) {
  const base = {
    schemaVersion: 1,
    paper: { size: "A4", orientation: "portrait", marginMm: 7 },
    sections: {
      shopHeader: {
        visible: true,
        showLogo: true,
        name: "Vi Tính Phước Tài",
        address: "Gò Vấp",
        phone: "0933712571",
        email: "shop@example.com"
      },
      documentTitle: { visible: true, text: "PHIẾU BÁN & GIAO HÀNG" },
      receiptMetadata: { visible: true, showVoucherCode: true, showDate: true, showTime: true },
      customerInformation: { visible: true, showName: true, showPhone: true, showAddress: true, showNote: true },
      productTable: {
        visible: true,
        showIndex: true,
        showProductName: true,
        showSaleNote: true,
        showQuantity: true,
        showUnitPrice: true,
        showDiscount: true,
        showLineTotal: true
      },
      totals: { visible: true, showGrossTotal: true, showDiscountTotal: true, showGrandTotal: true },
      signatures: {
        visible: true,
        sellerLabel: "Người bán",
        sellerHint: "(Ký và ghi rõ họ tên)",
        customerLabel: "Khách hàng",
        customerHint: "(Kiểm tra và ký nhận)"
      },
      notes: { visible: true, title: "Lưu ý:", items: ["Dòng một", "Dòng hai"] }
    }
  };
  return { ...base, ...overrides };
}

function keyedDraft(source = config()) {
  let id = 0;
  return cloneEditableTemplateConfig(source, () => `key-${++id}`);
}

test("clones Custom independently without mutating the API config", () => {
  const source = config();
  const draft = keyedDraft(source);
  draft.sections.documentTitle.text = "Đã sửa";
  draft.sections.notes.items[0].value = "Đã sửa lưu ý";
  assert.equal(source.sections.documentTitle.text, "PHIẾU BÁN & GIAO HÀNG");
  assert.equal(source.sections.notes.items[0], "Dòng một");
});

test("dirty comparison detects a persisted field change", () => {
  const source = config();
  const draft = keyedDraft(source);
  draft.paper.marginMm = 9;
  assert.equal(compareTemplateConfigs(draft, source), true);
});

test("dirty comparison ignores editor-only notice keys", () => {
  const source = config();
  const draft = keyedDraft(source);
  draft.sections.notes.items[0].key = "another-key";
  assert.equal(compareTemplateConfigs(draft, source), false);
});

test("resetting a draft from System leaves System immutable", () => {
  const system = config();
  const resetDraft = keyedDraft(system);
  resetDraft.sections.shopHeader.name = "Tên mới";
  assert.equal(system.sections.shopHeader.name, "Vi Tính Phước Tài");
});

test("save serialization removes local notice keys and trims text", () => {
  const draft = keyedDraft();
  draft.sections.notes.items[0].value = "  Dòng một  ";
  const serialized = normalizeEditableTemplateConfig(draft);
  assert.deepEqual(serialized.sections.notes.items, ["Dòng một", "Dòng hai"]);
  assert.equal(JSON.stringify(serialized).includes("key-"), false);
});

test("section visibility changes preserve nested values", () => {
  const draft = keyedDraft();
  const updated = updateSectionVisibility(draft, "shopHeader", false);
  assert.equal(updated.sections.shopHeader.visible, false);
  assert.equal(updated.sections.shopHeader.name, "Vi Tính Phước Tài");
});

test("notice items support add, edit, and remove with stable keys", () => {
  let id = 0;
  const items = createNoticeEditorItems(["A"], () => `n-${++id}`);
  const added = [...items, ...createNoticeEditorItems(["B"], () => `n-${++id}`)];
  added[1] = { ...added[1], value: "B sửa" };
  const removed = added.filter((item) => item.key !== "n-1");
  assert.deepEqual(removed, [{ key: "n-2", value: "B sửa" }]);
});

test("notice items move up and down without changing keys", () => {
  const items = [{ key: "a", value: "A" }, { key: "b", value: "B" }];
  assert.deepEqual(moveNoticeItem(items, 1, -1).map((item) => item.key), ["b", "a"]);
  assert.deepEqual(moveNoticeItem(items, 0, 1).map((item) => item.key), ["b", "a"]);
  assert.deepEqual(moveNoticeItem(items, 0, -1), items);
});

test("notice stable keys never enter persisted JSON", () => {
  const draft = keyedDraft();
  const persisted = normalizeEditableTemplateConfig(draft);
  assert.equal(typeof persisted.sections.notes.items[0], "string");
  assert.equal(JSON.stringify(persisted).includes("key-1"), false);
});

test("rejects an unsupported schema version", () => {
  assert.throws(() => keyedDraft(config({ schemaVersion: 3 })), /chưa được hỗ trợ/);
});

test("version 1 upgrade preserves content and visibility without mutating its source", () => {
  const source = config();
  source.sections.shopHeader.name = "Tên Custom v1";
  source.sections.totals.visible = false;
  const snapshot = structuredClone(source);
  const upgraded = upgradePrintTemplateConfigToLatest(source);
  assert.deepEqual(source, snapshot);
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.sections.shopHeader.name, "Tên Custom v1");
  assert.equal(upgraded.sections.totals.visible, false);
  assert.deepEqual(
    {
      fontSizePt: upgraded.sections.documentTitle.fontSizePt,
      textAlign: upgraded.sections.documentTitle.textAlign
    },
    {
      fontSizePt: PRINT_TEMPLATE_LAYOUT_DEFAULTS.documentTitle.fontSizePt,
      textAlign: PRINT_TEMPLATE_LAYOUT_DEFAULTS.documentTitle.textAlign
    }
  );
});

test("version 2 draft clone and serialization retain layout without editor-only fields", () => {
  const draft = keyedDraft();
  draft.sections.documentTitle.fontSizePt = "20";
  draft.sections.documentTitle.textAlign = "right";
  const persisted = normalizeEditableTemplateConfig(draft);
  assert.equal(persisted.schemaVersion, 2);
  assert.equal(persisted.sections.documentTitle.fontSizePt, 20);
  assert.equal(persisted.sections.documentTitle.textAlign, "right");
  assert.equal(typeof persisted.sections.documentTitle.fontSizePt, "number");
  assert.equal(typeof persisted.sections.notes.items[0], "string");
});

test("rejects a missing Custom config", () => {
  assert.throws(() => cloneEditableTemplateConfig(null), /không đầy đủ/);
});

test("validates the exact supported margin range", () => {
  const draft = keyedDraft();
  draft.paper.marginMm = 31;
  assert.equal(validateTemplateEditorDraft(draft).valid, false);
  draft.paper.marginMm = 0;
  assert.equal(validateTemplateEditorDraft(draft).valid, true);
  draft.paper.marginMm = 30;
  assert.equal(validateTemplateEditorDraft(draft).valid, true);
  draft.paper.marginMm = "";
  assert.equal(validateTemplateEditorDraft(draft).valid, false);
});

test("validates layout ranges, numeric strings as draft inputs, and alignments", () => {
  const draft = keyedDraft();
  draft.sections.productTable.cellPaddingMm = "4";
  draft.sections.signatures.writingSpaceMm = "60";
  assert.equal(validateTemplateEditorDraft(draft).valid, true);
  draft.sections.productTable.cellPaddingMm = "4.1";
  draft.sections.documentTitle.textAlign = "justify";
  assert.equal(validateTemplateEditorDraft(draft).valid, false);
  assert.equal(validateTemplateEditorDraft(draft).errors.some((error) => error.field.endsWith("cellPaddingMm")), true);
  assert.equal(validateTemplateEditorDraft(draft).errors.some((error) => error.field.endsWith("textAlign")), true);
});

test("safe preview layout clamps invalid numeric drafts and maps alignment allowlists", () => {
  const draft = keyedDraft();
  draft.sections.documentTitle.fontSizePt = "999";
  draft.sections.documentTitle.textAlign = "right";
  draft.sections.productTable.cellPaddingMm = "invalid";
  draft.sections.totals.textAlign = "center";
  const layout = deriveSafePreviewLayout(draft);
  assert.equal(layout.documentTitle.fontSizePt, 28);
  assert.equal(layout.documentTitle.textAlign, "right");
  assert.equal(layout.productTable.cellPaddingMm, PRINT_TEMPLATE_LAYOUT_DEFAULTS.productTable.cellPaddingMm);
  assert.equal(layout.totals.textAlign, "right");
  Object.values(layout).forEach((section) => {
    Object.entries(section).forEach(([field, value]) => {
      if (field !== "textAlign") assert.equal(Number.isFinite(value), true);
    });
  });
});

test("selected-section layout reset preserves Custom text and visibility", () => {
  const system = upgradePrintTemplateConfigToLatest(config());
  const draft = keyedDraft();
  draft.sections.documentTitle.text = "CUSTOM";
  draft.sections.documentTitle.visible = false;
  draft.sections.documentTitle.fontSizePt = 27;
  draft.sections.documentTitle.textAlign = "right";
  const reset = resetSectionLayoutFromSystem(draft, system, "documentTitle");
  assert.equal(reset.sections.documentTitle.text, "CUSTOM");
  assert.equal(reset.sections.documentTitle.visible, false);
  assert.equal(reset.sections.documentTitle.fontSizePt, system.sections.documentTitle.fontSizePt);
  assert.equal(reset.sections.documentTitle.textAlign, system.sections.documentTitle.textAlign);
});

test("validates text limits and plain-text input", () => {
  const draft = keyedDraft();
  draft.sections.documentTitle.text = "x".repeat(121);
  assert.equal(validateTemplateEditorDraft(draft).errors.some((error) => error.field.endsWith("documentTitle.text")), true);
  draft.sections.documentTitle.text = "<strong>Phiếu</strong>";
  assert.equal(validateTemplateEditorDraft(draft).errors.some((error) => /văn bản/.test(error.message)), true);
});

test("validates notice count and item length", () => {
  const draft = keyedDraft();
  draft.sections.notes.items = [];
  assert.equal(validateTemplateEditorDraft(draft).errors.some((error) => error.field === "sections.notes.items"), true);
  draft.sections.notes.items = [{ key: "long", value: "x".repeat(501) }];
  assert.equal(validateTemplateEditorDraft(draft).errors.some((error) => error.field.includes("items[0]")), true);
});

test("Custom serialization never includes active_template", () => {
  const draft = keyedDraft();
  draft.active_template = "custom";
  const serialized = normalizeEditableTemplateConfig(draft);
  assert.equal("active_template" in serialized, false);
});

test("successful-save normalization clears dirty state", () => {
  const original = config();
  const draft = keyedDraft(original);
  draft.sections.documentTitle.text = "Tiêu đề mới";
  const saved = normalizeEditableTemplateConfig(draft);
  const reloadedDraft = keyedDraft(saved);
  assert.equal(compareTemplateConfigs(reloadedDraft, saved), false);
});

test("cancel can restore the last saved Custom config", () => {
  const saved = config();
  const draft = keyedDraft(saved);
  draft.sections.shopHeader.phone = "000";
  draft.sections.shopHeader.fontSizePt = 14;
  const restored = keyedDraft(saved);
  assert.equal(compareTemplateConfigs(restored, saved), false);
  assert.equal(restored.sections.shopHeader.fontSizePt, PRINT_TEMPLATE_LAYOUT_DEFAULTS.shopHeader.fontSizePt);
  assert.equal(serializeNoticeEditorItems(restored.sections.notes.items)[0], "Dòng một");
});

test("selected section changes independently from the template config", () => {
  const draft = keyedDraft();
  const before = normalizeEditableTemplateConfig(draft);
  assert.equal(selectEditorSection("shopHeader", "documentTitle"), "documentTitle");
  assert.deepEqual(normalizeEditableTemplateConfig(draft), before);
  assert.equal(selectEditorSection("shopHeader", "unknown"), "shopHeader");
});

test("hidden product fields alter preview columns while preserving their fixed order", () => {
  const productTable = config().sections.productTable;
  productTable.showIndex = false;
  productTable.showDiscount = false;
  assert.deepEqual(
    getVisibleProductColumns(productTable).map((column) => column.id),
    ["productName", "quantity", "unitPrice", "lineTotal"]
  );
});

test("all eight visual-editor sections are defined once", () => {
  assert.deepEqual(
    PRINT_TEMPLATE_SECTION_DEFINITIONS.map((section) => section.id),
    ["shopHeader", "receiptMetadata", "documentTitle", "customerInformation", "productTable", "totals", "signatures", "notes"]
  );
});

test("hidden sections remain selectable in navigator data", () => {
  const draft = keyedDraft();
  draft.sections.customerInformation.visible = false;
  const item = getSectionNavigatorItems(draft, "customerInformation").find((entry) => entry.id === "customerInformation");
  assert.deepEqual({ selected: item.selected, visible: item.visible }, { selected: true, visible: false });
});

test("deterministic preview sample data never enters persisted config", () => {
  const draft = keyedDraft();
  draft.previewSample = SALE_DELIVERY_NOTE_PREVIEW_SAMPLE;
  const persisted = normalizeEditableTemplateConfig(draft);
  assert.equal("previewSample" in persisted, false);
  assert.equal(JSON.stringify(persisted).includes("OUT-000114"), false);
});

test("title update changes only the editable draft", () => {
  const source = config();
  const draft = keyedDraft(source);
  const updated = updateDraftSectionField(draft, "documentTitle", "text", "TIÊU ĐỀ XEM TRƯỚC");
  assert.equal(updated.sections.documentTitle.text, "TIÊU ĐỀ XEM TRƯỚC");
  assert.equal(source.sections.documentTitle.text, "PHIẾU BÁN & GIAO HÀNG");
  assert.equal(updated.sections.shopHeader.name, draft.sections.shopHeader.name);
});

test("System reset produces an unsaved preview draft without mutating System", () => {
  const savedCustom = config();
  savedCustom.sections.documentTitle.text = "CUSTOM";
  const system = config();
  const resetDraft = keyedDraft(system);
  assert.equal(compareTemplateConfigs(resetDraft, savedCustom), true);
  resetDraft.sections.documentTitle.text = "LOCAL";
  assert.equal(system.sections.documentTitle.text, "PHIẾU BÁN & GIAO HÀNG");
});

test("notice order in the preview matches serialized order", () => {
  const draft = keyedDraft();
  draft.sections.notes.items = moveNoticeItem(draft.sections.notes.items, 1, -1);
  assert.deepEqual(
    draft.sections.notes.items.map((item) => item.value),
    normalizeEditableTemplateConfig(draft).sections.notes.items
  );
});

test("backend field errors map to the correct inspector section", () => {
  assert.equal(
    getSectionForFieldPath("body.custom_template_config.sections.documentTitle.text"),
    "documentTitle"
  );
  assert.equal(getSectionForFieldPath("sections.notes.items[1]"), "notes");
  assert.equal(getSectionForFieldPath("paper.marginMm"), null);
});
