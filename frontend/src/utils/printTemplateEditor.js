import { cloneTemplateConfig } from "./printTemplateSettings.js";

export const PRINT_TEMPLATE_SCHEMA_VERSION = 2;
export const PRINT_TEMPLATE_LIMITS = Object.freeze({
  marginMin: 0,
  marginMax: 30,
  shopName: 120,
  shopAddress: 240,
  shopPhone: 50,
  shopEmail: 120,
  documentTitle: 120,
  signatureText: 100,
  notesTitle: 60,
  noticeCount: 10,
  noticeText: 500
});

export const PRINT_TEMPLATE_LAYOUT_DEFAULTS = Object.freeze({
  shopHeader: Object.freeze({ fontSizePt: 9, spacingAfterMm: 0 }),
  receiptMetadata: Object.freeze({ fontSizePt: 9 }),
  documentTitle: Object.freeze({
    textAlign: "center",
    fontSizePt: 16.5,
    spacingBeforeMm: 4,
    spacingAfterMm: 4
  }),
  customerInformation: Object.freeze({ fontSizePt: 9, spacingAfterMm: 4 }),
  productTable: Object.freeze({ fontSizePt: 9, headerFontSizePt: 9, cellPaddingMm: 2, spacingAfterMm: 1.5 }),
  totals: Object.freeze({ fontSizePt: 9, textAlign: "right", spacingAfterMm: 3 }),
  signatures: Object.freeze({ fontSizePt: 9, writingSpaceMm: 14, spacingAfterMm: 0 }),
  notes: Object.freeze({ fontSizePt: 8.25, spacingBeforeMm: 2 })
});

export const PRINT_TEMPLATE_LAYOUT_LIMITS = Object.freeze({
  shopHeader: Object.freeze({ fontSizePt: [7, 14], spacingAfterMm: [0, 15] }),
  receiptMetadata: Object.freeze({ fontSizePt: [7, 14] }),
  documentTitle: Object.freeze({ fontSizePt: [12, 28], spacingBeforeMm: [0, 15], spacingAfterMm: [0, 15] }),
  customerInformation: Object.freeze({ fontSizePt: [7, 14], spacingAfterMm: [0, 15] }),
  productTable: Object.freeze({ fontSizePt: [7, 13], headerFontSizePt: [7, 13], cellPaddingMm: [0.5, 4], spacingAfterMm: [0, 15] }),
  totals: Object.freeze({ fontSizePt: [7, 14], spacingAfterMm: [0, 15] }),
  signatures: Object.freeze({ fontSizePt: [7, 14], writingSpaceMm: [10, 60], spacingAfterMm: [0, 20] }),
  notes: Object.freeze({ fontSizePt: [6, 12], spacingBeforeMm: [0, 20] })
});

export const PRINT_TEMPLATE_LAYOUT_FIELDS = Object.freeze(
  Object.fromEntries(Object.entries(PRINT_TEMPLATE_LAYOUT_DEFAULTS).map(([section, defaults]) => [
    section,
    Object.freeze(Object.keys(defaults))
  ]))
);

export const PRINT_TEMPLATE_SECTION_DEFINITIONS = Object.freeze([
  { id: "shopHeader", label: "Thông tin cửa hàng" },
  { id: "receiptMetadata", label: "Thông tin phiếu" },
  { id: "documentTitle", label: "Tiêu đề phiếu" },
  { id: "customerInformation", label: "Thông tin khách hàng" },
  { id: "productTable", label: "Bảng sản phẩm" },
  { id: "totals", label: "Tổng tiền" },
  { id: "signatures", label: "Chữ ký" },
  { id: "notes", label: "Lưu ý" }
]);

export const PRODUCT_TABLE_COLUMN_DEFINITIONS = Object.freeze([
  { key: "showIndex", id: "index", label: "STT" },
  { key: "showProductName", id: "productName", label: "Tên sản phẩm" },
  { key: "showQuantity", id: "quantity", label: "SL" },
  { key: "showUnitPrice", id: "unitPrice", label: "Đơn giá" },
  { key: "showDiscount", id: "discount", label: "Chiết khấu" },
  { key: "showLineTotal", id: "lineTotal", label: "Thành tiền" }
]);

const SECTION_IDS = new Set(PRINT_TEMPLATE_SECTION_DEFINITIONS.map((section) => section.id));

let noticeKeySequence = 0;

function defaultNoticeKey() {
  noticeKeySequence += 1;
  return `notice-${noticeKeySequence}`;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function configurationError(message) {
  const error = new Error(message);
  error.name = "PrintTemplateEditorConfigurationError";
  return error;
}

function assertEditableConfig(config) {
  if (!isPlainObject(config) || !isPlainObject(config.paper) || !isPlainObject(config.sections)) {
    throw configurationError("Cấu hình Mẫu tùy chỉnh không đầy đủ.");
  }
  if (config.schemaVersion !== PRINT_TEMPLATE_SCHEMA_VERSION) {
    throw configurationError("Phiên bản cấu hình Mẫu tùy chỉnh chưa được hỗ trợ.");
  }

  const requiredSections = [
    "shopHeader",
    "documentTitle",
    "receiptMetadata",
    "customerInformation",
    "productTable",
    "totals",
    "signatures",
    "notes"
  ];
  requiredSections.forEach((section) => {
    if (!isPlainObject(config.sections[section])) {
      throw configurationError(`Cấu hình thiếu phần ${section}.`);
    }
  });
  if (!Array.isArray(config.sections.notes.items)) {
    throw configurationError("Danh sách lưu ý không hợp lệ.");
  }
}

export function upgradePrintTemplateConfigToLatest(config) {
  if (!isPlainObject(config) || !isPlainObject(config.paper) || !isPlainObject(config.sections)) {
    throw configurationError("Cấu hình Mẫu tùy chỉnh không đầy đủ.");
  }
  if (![1, PRINT_TEMPLATE_SCHEMA_VERSION].includes(config.schemaVersion)) {
    throw configurationError("Phiên bản cấu hình Mẫu tùy chỉnh chưa được hỗ trợ.");
  }

  const upgraded = cloneTemplateConfig(config);
  if (upgraded.schemaVersion === 1) {
    upgraded.schemaVersion = PRINT_TEMPLATE_SCHEMA_VERSION;
    Object.entries(PRINT_TEMPLATE_LAYOUT_DEFAULTS).forEach(([sectionName, defaults]) => {
      upgraded.sections[sectionName] = { ...upgraded.sections[sectionName], ...defaults };
    });
  }
  assertEditableConfig(upgraded);
  return upgraded;
}

export function createNoticeEditorItems(items, createKey = defaultNoticeKey) {
  if (!Array.isArray(items)) {
    throw configurationError("Danh sách lưu ý không hợp lệ.");
  }
  return items.map((value) => ({ key: createKey(), value: String(value ?? "") }));
}

export function serializeNoticeEditorItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item?.value ?? "").trim());
}

export function cloneEditableTemplateConfig(config, createKey = defaultNoticeKey) {
  const upgraded = upgradePrintTemplateConfigToLatest(config);
  const draft = cloneTemplateConfig(upgraded);
  draft.sections.notes.items = createNoticeEditorItems(upgraded.sections.notes.items, createKey);
  return draft;
}

export function stripEditorOnlyFields(draft) {
  assertEditableConfig({
    ...draft,
    sections: {
      ...draft?.sections,
      notes: {
        ...draft?.sections?.notes,
        items: Array.isArray(draft?.sections?.notes?.items)
          ? draft.sections.notes.items.map((item) => item?.value ?? "")
          : draft?.sections?.notes?.items
      }
    }
  });

  const { paper, sections } = draft;
  return {
    schemaVersion: PRINT_TEMPLATE_SCHEMA_VERSION,
    paper: {
      size: paper.size,
      orientation: paper.orientation,
      marginMm: Number(paper.marginMm)
    },
    sections: {
      shopHeader: {
        visible: sections.shopHeader.visible,
        showLogo: sections.shopHeader.showLogo,
        name: String(sections.shopHeader.name ?? "").trim(),
        address: String(sections.shopHeader.address ?? "").trim(),
        phone: String(sections.shopHeader.phone ?? "").trim(),
        email: String(sections.shopHeader.email ?? "").trim(),
        fontSizePt: Number(sections.shopHeader.fontSizePt),
        spacingAfterMm: Number(sections.shopHeader.spacingAfterMm)
      },
      documentTitle: {
        visible: sections.documentTitle.visible,
        text: String(sections.documentTitle.text ?? "").trim(),
        textAlign: sections.documentTitle.textAlign,
        fontSizePt: Number(sections.documentTitle.fontSizePt),
        spacingBeforeMm: Number(sections.documentTitle.spacingBeforeMm),
        spacingAfterMm: Number(sections.documentTitle.spacingAfterMm)
      },
      receiptMetadata: {
        visible: sections.receiptMetadata.visible,
        showVoucherCode: sections.receiptMetadata.showVoucherCode,
        showDate: sections.receiptMetadata.showDate,
        showTime: sections.receiptMetadata.showTime,
        fontSizePt: Number(sections.receiptMetadata.fontSizePt)
      },
      customerInformation: {
        visible: sections.customerInformation.visible,
        showName: sections.customerInformation.showName,
        showPhone: sections.customerInformation.showPhone,
        showAddress: sections.customerInformation.showAddress,
        showNote: sections.customerInformation.showNote,
        fontSizePt: Number(sections.customerInformation.fontSizePt),
        spacingAfterMm: Number(sections.customerInformation.spacingAfterMm)
      },
      productTable: {
        visible: sections.productTable.visible,
        showIndex: sections.productTable.showIndex,
        showProductName: sections.productTable.showProductName,
        showSaleNote: sections.productTable.showSaleNote,
        showQuantity: sections.productTable.showQuantity,
        showUnitPrice: sections.productTable.showUnitPrice,
        showDiscount: sections.productTable.showDiscount,
        showLineTotal: sections.productTable.showLineTotal,
        fontSizePt: Number(sections.productTable.fontSizePt),
        headerFontSizePt: Number(sections.productTable.headerFontSizePt),
        cellPaddingMm: Number(sections.productTable.cellPaddingMm),
        spacingAfterMm: Number(sections.productTable.spacingAfterMm)
      },
      totals: {
        visible: sections.totals.visible,
        showGrossTotal: sections.totals.showGrossTotal,
        showDiscountTotal: sections.totals.showDiscountTotal,
        showGrandTotal: sections.totals.showGrandTotal,
        fontSizePt: Number(sections.totals.fontSizePt),
        textAlign: sections.totals.textAlign,
        spacingAfterMm: Number(sections.totals.spacingAfterMm)
      },
      signatures: {
        visible: sections.signatures.visible,
        sellerLabel: String(sections.signatures.sellerLabel ?? "").trim(),
        sellerHint: String(sections.signatures.sellerHint ?? "").trim(),
        customerLabel: String(sections.signatures.customerLabel ?? "").trim(),
        customerHint: String(sections.signatures.customerHint ?? "").trim(),
        fontSizePt: Number(sections.signatures.fontSizePt),
        writingSpaceMm: Number(sections.signatures.writingSpaceMm),
        spacingAfterMm: Number(sections.signatures.spacingAfterMm)
      },
      notes: {
        visible: sections.notes.visible,
        title: String(sections.notes.title ?? "").trim(),
        items: serializeNoticeEditorItems(sections.notes.items),
        fontSizePt: Number(sections.notes.fontSizePt),
        spacingBeforeMm: Number(sections.notes.spacingBeforeMm)
      }
    }
  };
}

export function normalizeEditableTemplateConfig(draft) {
  return stripEditorOnlyFields(draft);
}

export function compareTemplateConfigs(draft, persistedConfig) {
  if (!draft || !persistedConfig) return false;
  return JSON.stringify(normalizeEditableTemplateConfig(draft))
    !== JSON.stringify(normalizePersistedTemplateConfig(persistedConfig));
}

export function normalizePersistedTemplateConfig(config) {
  return normalizeEditableTemplateConfig(cloneEditableTemplateConfig(config, () => "ignored"));
}

export function moveNoticeItem(items, index, direction) {
  if (!Array.isArray(items)) return [];
  const targetIndex = index + direction;
  if (index < 0 || index >= items.length || targetIndex < 0 || targetIndex >= items.length) {
    return items.slice();
  }
  const next = items.slice();
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function updateSectionVisibility(draft, sectionName, visible) {
  if (!draft?.sections?.[sectionName]) return draft;
  return {
    ...draft,
    sections: {
      ...draft.sections,
      [sectionName]: {
        ...draft.sections[sectionName],
        visible: Boolean(visible)
      }
    }
  };
}

export function updateDraftSectionField(draft, sectionName, field, value) {
  if (!draft?.sections?.[sectionName]) return draft;
  return {
    ...draft,
    sections: {
      ...draft.sections,
      [sectionName]: {
        ...draft.sections[sectionName],
        [field]: value
      }
    }
  };
}

export function resetSectionLayoutFromSystem(draft, systemConfig, sectionName) {
  const fields = PRINT_TEMPLATE_LAYOUT_FIELDS[sectionName];
  const systemSection = systemConfig?.sections?.[sectionName];
  if (!draft?.sections?.[sectionName] || !systemSection || !fields) return draft;
  const resetValues = Object.fromEntries(fields.map((field) => [field, systemSection[field]]));
  return {
    ...draft,
    sections: {
      ...draft.sections,
      [sectionName]: { ...draft.sections[sectionName], ...resetValues }
    }
  };
}

function safeFiniteNumber(value, [min, max], fallback) {
  const numeric = value === "" || value === null || value === undefined ? NaN : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function safeAlignment(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function deriveSafePreviewLayout(config) {
  const sections = config?.sections || {};
  const result = {};
  Object.entries(PRINT_TEMPLATE_LAYOUT_DEFAULTS).forEach(([sectionName, defaults]) => {
    result[sectionName] = {};
    Object.entries(defaults).forEach(([field, fallback]) => {
      if (field === "textAlign") {
        const allowed = sectionName === "totals" ? ["left", "right"] : ["left", "center", "right"];
        result[sectionName][field] = safeAlignment(sections[sectionName]?.[field], allowed, fallback);
      } else {
        result[sectionName][field] = safeFiniteNumber(
          sections[sectionName]?.[field],
          PRINT_TEMPLATE_LAYOUT_LIMITS[sectionName][field],
          fallback
        );
      }
    });
  });
  return result;
}

export function selectEditorSection(currentSection, nextSection) {
  return SECTION_IDS.has(nextSection) ? nextSection : currentSection;
}

export function getVisibleProductColumns(productTable) {
  return PRODUCT_TABLE_COLUMN_DEFINITIONS.filter((column) => Boolean(productTable?.[column.key]));
}

export function getSectionNavigatorItems(draft, selectedSection) {
  return PRINT_TEMPLATE_SECTION_DEFINITIONS.map((section) => ({
    ...section,
    selected: section.id === selectedSection,
    visible: Boolean(draft?.sections?.[section.id]?.visible)
  }));
}

export function getSectionForFieldPath(field) {
  const normalized = String(field || "")
    .replace(/^body\.custom_template_config\.?/, "")
    .replace(/^custom_template_config\.?/, "");
  const match = normalized.match(/^sections\.([^.\[]+)/);
  return match && SECTION_IDS.has(match[1]) ? match[1] : null;
}

function containsUnsafeTemplateText(value) {
  return /<\s*\/?\s*[a-z][^>]*>/i.test(value)
    || /\{\{|\}\}|\$\{/.test(value)
    || /javascript\s*:/i.test(value)
    || /(?:\bfunction(?:\s+[\w$]+)?\s*\(|\beval\s*\(|\bnew\s+Function\s*\(|\b(?:window|document)\s*\.|=>)/i.test(value)
    || /(?:^|[;\s])(?:color|background(?:-color)?|font-size|position|display)\s*:\s*[^;]+;?/i.test(value)
    || /(?:^|\s)(?:body|html|#[\w-]+|\.[\w-]+)\s*\{[^}]*\}/i.test(value);
}

function validateText(errors, field, value, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    errors.push({ field, message: "Không được để trống." });
  } else if (normalized.length > max) {
    errors.push({ field, message: `Không được vượt quá ${max} ký tự.` });
  } else if (containsUnsafeTemplateText(normalized)) {
    errors.push({ field, message: "Chỉ được nhập văn bản thông thường." });
  }
}

export function validateTemplateEditorDraft(draft) {
  const errors = [];
  const rawMargin = draft?.paper?.marginMm;
  let config;
  try {
    config = normalizeEditableTemplateConfig(draft);
  } catch (error) {
    return { valid: false, config: null, errors: [{ field: "config", message: error.message }] };
  }

  if (config.schemaVersion !== PRINT_TEMPLATE_SCHEMA_VERSION) {
    errors.push({ field: "schemaVersion", message: "Phiên bản cấu hình chưa được hỗ trợ." });
  }
  if (config.paper.size !== "A4" || config.paper.orientation !== "portrait") {
    errors.push({ field: "paper", message: "Giai đoạn này chỉ hỗ trợ khổ A4 dọc." });
  }
  if (
    rawMargin === ""
    || rawMargin === null
    || rawMargin === undefined
    || !Number.isFinite(config.paper.marginMm)
    || config.paper.marginMm < PRINT_TEMPLATE_LIMITS.marginMin
    || config.paper.marginMm > PRINT_TEMPLATE_LIMITS.marginMax
  ) {
    errors.push({ field: "paper.marginMm", message: "Lề phải từ 0 đến 30 mm." });
  }

  const booleanFields = [
    ["sections.shopHeader.visible", config.sections.shopHeader.visible],
    ["sections.shopHeader.showLogo", config.sections.shopHeader.showLogo],
    ["sections.documentTitle.visible", config.sections.documentTitle.visible],
    ["sections.receiptMetadata.visible", config.sections.receiptMetadata.visible],
    ["sections.receiptMetadata.showVoucherCode", config.sections.receiptMetadata.showVoucherCode],
    ["sections.receiptMetadata.showDate", config.sections.receiptMetadata.showDate],
    ["sections.receiptMetadata.showTime", config.sections.receiptMetadata.showTime],
    ["sections.customerInformation.visible", config.sections.customerInformation.visible],
    ["sections.customerInformation.showName", config.sections.customerInformation.showName],
    ["sections.customerInformation.showPhone", config.sections.customerInformation.showPhone],
    ["sections.customerInformation.showAddress", config.sections.customerInformation.showAddress],
    ["sections.customerInformation.showNote", config.sections.customerInformation.showNote],
    ...["visible", "showIndex", "showProductName", "showSaleNote", "showQuantity", "showUnitPrice", "showDiscount", "showLineTotal"]
      .map((key) => [`sections.productTable.${key}`, config.sections.productTable[key]]),
    ...["visible", "showGrossTotal", "showDiscountTotal", "showGrandTotal"]
      .map((key) => [`sections.totals.${key}`, config.sections.totals[key]]),
    ["sections.signatures.visible", config.sections.signatures.visible],
    ["sections.notes.visible", config.sections.notes.visible]
  ];
  booleanFields.forEach(([field, value]) => {
    if (typeof value !== "boolean") errors.push({ field, message: "Giá trị hiển thị không hợp lệ." });
  });

  Object.entries(PRINT_TEMPLATE_LAYOUT_LIMITS).forEach(([sectionName, fields]) => {
    Object.entries(fields).forEach(([field, [min, max]]) => {
      const rawValue = draft?.sections?.[sectionName]?.[field];
      const value = config.sections[sectionName][field];
      if (
        rawValue === ""
        || rawValue === null
        || rawValue === undefined
        || !Number.isFinite(value)
        || value < min
        || value > max
      ) {
        errors.push({
          field: `sections.${sectionName}.${field}`,
          message: `Giá trị phải từ ${min} đến ${max}.`
        });
      }
    });
  });

  if (!["left", "center", "right"].includes(config.sections.documentTitle.textAlign)) {
    errors.push({ field: "sections.documentTitle.textAlign", message: "Căn tiêu đề không hợp lệ." });
  }
  if (!["left", "right"].includes(config.sections.totals.textAlign)) {
    errors.push({ field: "sections.totals.textAlign", message: "Căn tổng tiền không hợp lệ." });
  }

  const shop = config.sections.shopHeader;
  validateText(errors, "sections.shopHeader.name", shop.name, PRINT_TEMPLATE_LIMITS.shopName);
  validateText(errors, "sections.shopHeader.address", shop.address, PRINT_TEMPLATE_LIMITS.shopAddress);
  validateText(errors, "sections.shopHeader.phone", shop.phone, PRINT_TEMPLATE_LIMITS.shopPhone);
  validateText(errors, "sections.shopHeader.email", shop.email, PRINT_TEMPLATE_LIMITS.shopEmail);
  validateText(
    errors,
    "sections.documentTitle.text",
    config.sections.documentTitle.text,
    PRINT_TEMPLATE_LIMITS.documentTitle
  );

  const signatures = config.sections.signatures;
  ["sellerLabel", "sellerHint", "customerLabel", "customerHint"].forEach((key) => {
    validateText(errors, `sections.signatures.${key}`, signatures[key], PRINT_TEMPLATE_LIMITS.signatureText);
  });

  const notes = config.sections.notes;
  validateText(errors, "sections.notes.title", notes.title, PRINT_TEMPLATE_LIMITS.notesTitle);
  if (notes.items.length < 1 || notes.items.length > PRINT_TEMPLATE_LIMITS.noticeCount) {
    errors.push({
      field: "sections.notes.items",
      message: `Cần từ 1 đến ${PRINT_TEMPLATE_LIMITS.noticeCount} dòng lưu ý.`
    });
  }
  notes.items.forEach((item, index) => {
    validateText(errors, `sections.notes.items[${index}]`, item, PRINT_TEMPLATE_LIMITS.noticeText);
  });

  return { valid: errors.length === 0, config, errors };
}
