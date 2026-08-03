export const BUILDER_STORAGE_KEY = "print_template_builder_lab_v1";
export const BUILDER_DOCUMENT_VERSION = 1;
export const BUILDER_MAX_CONFIG_BYTES = 128 * 1024;
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const LOGICAL_PAGE_WIDTH_PX = 794;
export const LOGICAL_PAGE_HEIGHT_PX = 1123;
export const BUILDER_HISTORY_LIMIT = 75;
export const MAX_BUILDER_BLOCKS = 100;

export const PRODUCT_TABLE_COLUMNS = Object.freeze([
  { id: "index", label: "STT" },
  { id: "productName", label: "Tên sản phẩm" },
  { id: "quantity", label: "SL" },
  { id: "unitPrice", label: "Đơn giá" },
  { id: "discount", label: "Chiết khấu" },
  { id: "lineTotal", label: "Thành tiền" }
]);

export const BUILDER_BLOCK_TYPES = Object.freeze([
  "text",
  "title",
  "logo",
  "shopInfo",
  "voucherMetadata",
  "customerInfo",
  "productTable",
  "totals",
  "signatures",
  "notes",
  "horizontalRule"
]);

export const BUILDER_PALETTE_ITEMS = Object.freeze([
  { type: "text", label: "Văn bản" },
  { type: "title", label: "Tiêu đề" },
  { type: "logo", label: "Logo cửa hàng" },
  { type: "shopInfo", label: "Thông tin cửa hàng" },
  { type: "voucherMetadata", label: "Thông tin phiếu" },
  { type: "customerInfo", label: "Thông tin khách hàng" },
  { type: "productTable", label: "Bảng sản phẩm" },
  { type: "totals", label: "Tổng tiền" },
  { type: "signatures", label: "Chữ ký" },
  { type: "notes", label: "Lưu ý" },
  { type: "horizontalRule", label: "Đường kẻ ngang" }
]);

const BLOCK_DEFAULTS = Object.freeze({
  text: { widthMm: 80, heightMm: 14, props: { text: "Văn bản mới", fontSizePt: 10, bold: false, italic: false, underline: false, textAlign: "left", lineHeight: 1.35 } },
  title: { widthMm: 150, heightMm: 16, props: { text: "TIÊU ĐỀ MỚI", fontSizePt: 17, bold: true, italic: false, underline: false, textAlign: "center", lineHeight: 1.2 } },
  logo: { widthMm: 28, heightMm: 22, props: { preserveAspectRatio: true } },
  shopInfo: { widthMm: 105, heightMm: 24, props: { showLogo: false, showName: true, showAddress: true, showPhone: true, showEmail: true, fontSizePt: 9, textAlign: "center" } },
  voucherMetadata: { widthMm: 47, heightMm: 24, props: { showVoucherCode: true, showDate: true, showTime: true, fontSizePt: 9, textAlign: "left" } },
  customerInfo: { widthMm: 196, heightMm: 26, props: { showName: true, showPhone: true, showAddress: true, showNote: true, fontSizePt: 9 } },
  productTable: {
    widthMm: 196,
    heightMm: 72,
    props: {
      bodyFontSizePt: 9,
      headerFontSizePt: 9,
      cellPaddingMm: 2,
      showSaleNote: true,
      columnVisibility: Object.fromEntries(PRODUCT_TABLE_COLUMNS.map((column) => [column.id, true])),
      columnWidthWeights: { index: 11, productName: 91, quantity: 13, unitPrice: 27, discount: 27, lineTotal: 27 }
    }
  },
  totals: { widthMm: 82, heightMm: 25, props: { showSubtotal: true, showDiscount: true, showGrandTotal: true, fontSizePt: 9, textAlign: "right" } },
  signatures: { widthMm: 196, heightMm: 36, props: { sellerLabel: "Người bán", sellerHint: "(Ký và ghi rõ họ tên)", customerLabel: "Khách hàng", customerHint: "(Kiểm tra và ký nhận)", fontSizePt: 9, writingSpaceMm: 14 } },
  notes: { widthMm: 196, heightMm: 48, props: { text: "Lưu ý:\n- Vui lòng kiểm tra hàng trước khi nhận.\n- Giữ phiếu để được hỗ trợ bảo hành.", fontSizePt: 8.25, bold: false, italic: false, underline: false, textAlign: "left", lineHeight: 1.35 } },
  horizontalRule: { widthMm: 100, heightMm: 2, props: { thicknessMm: 0.3, lineStyle: "solid" } }
});

const MIN_SIZES = Object.freeze({
  text: [20, 8], title: [35, 10], logo: [12, 10], shopInfo: [45, 18],
  voucherMetadata: [38, 18], customerInfo: [70, 20], productTable: [110, 45],
  totals: [45, 18], signatures: [70, 24], notes: [45, 20], horizontalRule: [20, 1]
});

const TEXT_BLOCK_TYPES = new Set(["text", "title", "notes"]);
const ALIGNMENTS = new Set(["left", "center", "right"]);
const PLAIN_TEXT_PATTERN = /<[^>]*>|\{\{|\}\}|javascript\s*:|expression\s*\(/i;
const COMMON_TEXT_PROP_KEYS = ["text", "fontSizePt", "bold", "italic", "underline", "textAlign", "lineHeight"];
const PROP_KEYS_BY_TYPE = Object.freeze({
  text: COMMON_TEXT_PROP_KEYS,
  title: COMMON_TEXT_PROP_KEYS,
  notes: COMMON_TEXT_PROP_KEYS,
  logo: ["preserveAspectRatio"],
  shopInfo: ["showLogo", "showName", "showAddress", "showPhone", "showEmail", "fontSizePt", "textAlign"],
  voucherMetadata: ["showVoucherCode", "showDate", "showTime", "fontSizePt", "textAlign"],
  customerInfo: ["showName", "showPhone", "showAddress", "showNote", "fontSizePt"],
  productTable: ["columnVisibility", "columnWidthWeights", "bodyFontSizePt", "headerFontSizePt", "cellPaddingMm", "showSaleNote"],
  totals: ["showSubtotal", "showDiscount", "showGrandTotal", "fontSizePt", "textAlign"],
  signatures: ["sellerLabel", "sellerHint", "customerLabel", "customerHint", "fontSizePt", "writingSpaceMm"],
  horizontalRule: ["thicknessMm", "lineStyle"]
});
const BLOCK_KEYS = new Set(["id", "type", "xMm", "yMm", "widthMm", "heightMm", "zIndex", "locked", "props"]);
const PAPER_KEYS = new Set(["size", "orientation", "marginMm", "gridMm"]);
const DOCUMENT_KEYS = new Set(["builderSchemaVersion", "paper", "blocks"]);

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, precision = 3) {
  return Number(finite(value).toFixed(precision));
}

export function createBuilderId(prefix = "block") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function mmToRenderedPixels(mm, renderedPagePixels, pageMm = A4_WIDTH_MM) {
  return finite(mm) * finite(renderedPagePixels) / finite(pageMm, 1);
}

export function renderedPixelsToMm(pixels, renderedPagePixels, pageMm = A4_WIDTH_MM) {
  return finite(pixels) * finite(pageMm) / finite(renderedPagePixels, 1);
}

export function snapMm(value, gridMm = 2, bypass = false) {
  const safeValue = finite(value);
  const safeGrid = finite(gridMm, 2);
  return bypass || safeGrid <= 0 ? round(safeValue) : round(Math.round(safeValue / safeGrid) * safeGrid);
}

export function getBlockMinimumSize(type) {
  const [widthMm, heightMm] = MIN_SIZES[type] || [12, 8];
  return { widthMm, heightMm };
}

export function clampBlockGeometry(block, paper = { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM }) {
  const min = getBlockMinimumSize(block?.type);
  const maxWidth = finite(paper.widthMm, A4_WIDTH_MM);
  const maxHeight = finite(paper.heightMm, A4_HEIGHT_MM);
  const widthMm = round(Math.min(maxWidth, Math.max(min.widthMm, finite(block?.widthMm, min.widthMm))));
  const heightMm = round(Math.min(maxHeight, Math.max(min.heightMm, finite(block?.heightMm, min.heightMm))));
  return {
    ...block,
    xMm: round(Math.min(maxWidth - widthMm, Math.max(0, finite(block?.xMm)))),
    yMm: round(Math.min(maxHeight - heightMm, Math.max(0, finite(block?.yMm)))),
    widthMm,
    heightMm
  };
}

export function snapBlockPosition(block, paper, { bypassSnap = false, thresholdMm = 1 } = {}) {
  const clamped = clampBlockGeometry(block, paper);
  if (bypassSnap) return { block: clamped, guides: { vertical: [], horizontal: [] } };
  const grid = finite(paper.gridMm, 2);
  let xMm = snapMm(clamped.xMm, grid);
  let yMm = snapMm(clamped.yMm, grid);
  const margin = finite(paper.marginMm, 7);
  const xTargets = [margin, A4_WIDTH_MM - margin - clamped.widthMm, (A4_WIDTH_MM - clamped.widthMm) / 2];
  const yTargets = [margin, A4_HEIGHT_MM - margin - clamped.heightMm, (A4_HEIGHT_MM - clamped.heightMm) / 2];
  const guides = { vertical: [], horizontal: [] };
  xTargets.forEach((target, index) => {
    if (Math.abs(xMm - target) <= thresholdMm) {
      xMm = target;
      guides.vertical = [index === 0 ? margin : index === 1 ? A4_WIDTH_MM - margin : A4_WIDTH_MM / 2];
    }
  });
  yTargets.forEach((target, index) => {
    if (Math.abs(yMm - target) <= thresholdMm) {
      yMm = target;
      guides.horizontal = [index === 0 ? margin : index === 1 ? A4_HEIGHT_MM - margin : A4_HEIGHT_MM / 2];
    }
  });
  return { block: clampBlockGeometry({ ...clamped, xMm, yMm }, paper), guides };
}

export function createBlock(type, geometry = {}, idFactory = createBuilderId) {
  if (!BUILDER_BLOCK_TYPES.includes(type)) throw new Error("Loại khối thử nghiệm không được hỗ trợ.");
  const defaults = BLOCK_DEFAULTS[type];
  return clampBlockGeometry({
    id: idFactory("block"),
    type,
    xMm: finite(geometry.xMm, 20),
    yMm: finite(geometry.yMm, 20),
    widthMm: finite(geometry.widthMm, defaults.widthMm),
    heightMm: finite(geometry.heightMm, defaults.heightMm),
    zIndex: Number.isInteger(geometry.zIndex) ? geometry.zIndex : 1,
    locked: false,
    props: clone(defaults.props)
  });
}

export function createDefaultBuilderDocument(_systemConfig = null, idFactory = createBuilderId) {
  const placements = [
    ["logo", 7, 7, 28, 22], ["shopInfo", 36, 7, 110, 22], ["voucherMetadata", 155, 7, 48, 22],
    ["title", 20, 35, 170, 14], ["customerInfo", 7, 53, 196, 24], ["productTable", 7, 82, 196, 72],
    ["totals", 121, 158, 82, 25], ["signatures", 7, 188, 196, 34], ["notes", 7, 228, 196, 48]
  ];
  const blocks = placements.map(([type, xMm, yMm, widthMm, heightMm], index) => ({
    ...createBlock(type, { xMm, yMm, widthMm, heightMm, zIndex: index + 1 }, idFactory),
    zIndex: index + 1
  }));
  blocks.find((block) => block.type === "title").props.text = "PHIẾU BÁN & GIAO HÀNG";
  return {
    builderSchemaVersion: BUILDER_DOCUMENT_VERSION,
    paper: { size: "A4", orientation: "portrait", marginMm: 7, gridMm: 2 },
    blocks
  };
}

export function updateBuilderBlock(document, blockId, updater) {
  let changed = false;
  const blocks = document.blocks.map((block) => {
    if (block.id !== blockId) return block;
    if (block.locked && typeof updater === "object" && ["xMm", "yMm", "widthMm", "heightMm"].some((key) => key in updater)) return block;
    let next = typeof updater === "function" ? updater(clone(block)) : { ...block, ...updater };
    if (block.locked) {
      next = { ...next, xMm: block.xMm, yMm: block.yMm, widthMm: block.widthMm, heightMm: block.heightMm };
    }
    changed = JSON.stringify(next) !== JSON.stringify(block);
    return clampBlockGeometry(next, document.paper);
  });
  return changed ? { ...document, blocks } : document;
}

export function moveBlockByRenderedDelta(document, blockId, deltaXpx, deltaYpx, renderedWidthPx, options = {}) {
  const block = document.blocks.find((item) => item.id === blockId);
  if (!block || block.locked) return { document, guides: { vertical: [], horizontal: [] } };
  const moved = {
    ...block,
    xMm: block.xMm + renderedPixelsToMm(deltaXpx, renderedWidthPx),
    yMm: block.yMm + renderedPixelsToMm(deltaYpx, renderedWidthPx, A4_WIDTH_MM)
  };
  const snapped = snapBlockPosition(moved, document.paper, options);
  return { document: updateBuilderBlock(document, blockId, snapped.block), guides: snapped.guides };
}

export function resizeBlockByRenderedDelta(document, blockId, handle, deltaXpx, deltaYpx, renderedWidthPx, options = {}) {
  const block = document.blocks.find((item) => item.id === blockId);
  if (!block || block.locked) return document;
  const dx = renderedPixelsToMm(deltaXpx, renderedWidthPx);
  const dy = renderedPixelsToMm(deltaYpx, renderedWidthPx, A4_WIDTH_MM);
  let { xMm, yMm, widthMm, heightMm } = block;
  if (handle.includes("e")) widthMm += dx;
  if (handle.includes("s")) heightMm += dy;
  if (handle.includes("w")) { xMm += dx; widthMm -= dx; }
  if (handle.includes("n")) { yMm += dy; heightMm -= dy; }
  if (!options.bypassSnap) {
    const grid = document.paper.gridMm;
    xMm = snapMm(xMm, grid);
    yMm = snapMm(yMm, grid);
    widthMm = snapMm(widthMm, grid);
    heightMm = snapMm(heightMm, grid);
  }
  if (block.type === "logo" && block.props.preserveAspectRatio && ["ne", "nw", "se", "sw"].includes(handle)) {
    const ratio = block.widthMm / block.heightMm;
    heightMm = widthMm / ratio;
    if (handle.includes("n")) yMm = block.yMm + block.heightMm - heightMm;
  }
  if (handle.includes("e")) widthMm = Math.min(widthMm, A4_WIDTH_MM - xMm);
  if (handle.includes("s")) heightMm = Math.min(heightMm, A4_HEIGHT_MM - yMm);
  if (handle.includes("w") && xMm < 0) { widthMm += xMm; xMm = 0; }
  if (handle.includes("n") && yMm < 0) { heightMm += yMm; yMm = 0; }
  return updateBuilderBlock(document, blockId, clampBlockGeometry({ ...block, xMm, yMm, widthMm, heightMm }, document.paper));
}

export function addBlockAtDropPosition(document, type, renderedXpx, renderedYpx, renderedWidthPx, idFactory = createBuilderId) {
  const defaults = BLOCK_DEFAULTS[type];
  const xMm = renderedPixelsToMm(renderedXpx, renderedWidthPx) - defaults.widthMm / 2;
  const yMm = renderedPixelsToMm(renderedYpx, renderedWidthPx, A4_WIDTH_MM) - defaults.heightMm / 2;
  const block = createBlock(type, { xMm, yMm, zIndex: document.blocks.length + 1 }, idFactory);
  const snapped = snapBlockPosition(block, document.paper);
  return { document: normalizeZOrder({ ...document, blocks: [...document.blocks, snapped.block] }), block: snapped.block };
}

export function addBlockFromPaletteClick(document, type, offsetIndex = 0, idFactory = createBuilderId) {
  const offset = (Math.max(0, offsetIndex) % 8) * 3;
  const defaults = BLOCK_DEFAULTS[type];
  const block = createBlock(type, {
    xMm: (A4_WIDTH_MM - defaults.widthMm) / 2 + offset,
    yMm: (A4_HEIGHT_MM - defaults.heightMm) / 2 + offset,
    zIndex: document.blocks.length + 1
  }, idFactory);
  const safe = clampBlockGeometry(block, document.paper);
  return { document: normalizeZOrder({ ...document, blocks: [...document.blocks, safe] }), block: safe };
}

export function duplicateBuilderBlock(document, blockId, idFactory = createBuilderId) {
  const source = document.blocks.find((block) => block.id === blockId);
  if (!source || document.blocks.length >= MAX_BUILDER_BLOCKS) return { document, block: null };
  const duplicate = clampBlockGeometry({ ...clone(source), id: idFactory("block"), xMm: source.xMm + 4, yMm: source.yMm + 4, locked: false, zIndex: document.blocks.length + 1 }, document.paper);
  return { document: normalizeZOrder({ ...document, blocks: [...document.blocks, duplicate] }), block: duplicate };
}

export function deleteBuilderBlock(document, blockId) {
  const target = document.blocks.find((block) => block.id === blockId);
  if (!target || target.locked) return document;
  return normalizeZOrder({ ...document, blocks: document.blocks.filter((block) => block.id !== blockId) });
}

export function normalizeZOrder(document) {
  const ordered = document.blocks.map((block, index) => ({ block, index }))
    .sort((a, b) => finite(a.block.zIndex) - finite(b.block.zIndex) || a.index - b.index);
  const zById = new Map(ordered.map(({ block }, index) => [block.id, index + 1]));
  return { ...document, blocks: document.blocks.map((block) => ({ ...block, zIndex: zById.get(block.id) })) };
}

export function changeBlockZOrder(document, blockId, action) {
  const normalized = normalizeZOrder(document);
  const ordered = [...normalized.blocks].sort((a, b) => a.zIndex - b.zIndex);
  const index = ordered.findIndex((block) => block.id === blockId);
  if (index < 0) return document;
  let target = index;
  if (action === "up") target = Math.min(ordered.length - 1, index + 1);
  if (action === "down") target = Math.max(0, index - 1);
  if (action === "top") target = ordered.length - 1;
  if (action === "bottom") target = 0;
  if (target === index) return normalized;
  const [block] = ordered.splice(index, 1);
  ordered.splice(target, 0, block);
  const zById = new Map(ordered.map((item, order) => [item.id, order + 1]));
  return { ...normalized, blocks: normalized.blocks.map((item) => ({ ...item, zIndex: zById.get(item.id) })) };
}

export function blocksOverlap(first, second) {
  if (!first || !second || first.id === second.id) return false;
  return first.xMm < second.xMm + second.widthMm
    && first.xMm + first.widthMm > second.xMm
    && first.yMm < second.yMm + second.heightMm
    && first.yMm + first.heightMm > second.yMm;
}

export function getOverlappingBlockIds(document, blockId) {
  const selected = document.blocks.find((block) => block.id === blockId);
  if (!selected) return [];
  return document.blocks.filter((block) => blocksOverlap(selected, block)).map((block) => block.id);
}

export function nudgeBuilderBlock(document, blockId, deltaXmm, deltaYmm) {
  const block = document.blocks.find((item) => item.id === blockId);
  if (!block || block.locked) return document;
  return updateBuilderBlock(document, blockId, clampBlockGeometry({ ...block, xMm: block.xMm + finite(deltaXmm), yMm: block.yMm + finite(deltaYmm) }, document.paper));
}

export function createBuilderHistory(document, limit = BUILDER_HISTORY_LIMIT) {
  return { past: [], present: clone(document), future: [], limit: Math.max(1, Math.floor(finite(limit, BUILDER_HISTORY_LIMIT))) };
}

export function commitBuilderHistory(history, document) {
  if (JSON.stringify(history.present) === JSON.stringify(document)) return history;
  return { ...history, past: [...history.past, clone(history.present)].slice(-history.limit), present: clone(document), future: [] };
}

export function rollbackBuilderGesture(document) {
  return clone(document);
}

export function undoBuilderHistory(history) {
  if (!history.past.length) return history;
  return { ...history, past: history.past.slice(0, -1), present: clone(history.past.at(-1)), future: [clone(history.present), ...history.future].slice(0, history.limit) };
}

export function redoBuilderHistory(history) {
  if (!history.future.length) return history;
  return { ...history, past: [...history.past, clone(history.present)].slice(-history.limit), present: clone(history.future[0]), future: history.future.slice(1) };
}

export function serializeBuilderDocument(document) {
  return clone({
    builderSchemaVersion: document.builderSchemaVersion,
    paper: document.paper,
    blocks: document.blocks
  });
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, keys) {
  return isPlainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function validateCanonicalProps(block, errors) {
  const props = block.props;
  if (!isPlainObject(props)) {
    errors.push(`${block.id}.props không hợp lệ`);
    return;
  }
  const allowedKeys = PROP_KEYS_BY_TYPE[block.type] || [];
  if (!hasExactKeys(props, allowedKeys)) errors.push(`${block.id}.props không đúng cấu trúc cho loại khối`);
  if (TEXT_BLOCK_TYPES.has(block.type) && (typeof props.text !== "string" || props.text.length > 4000 || PLAIN_TEXT_PATTERN.test(props.text))) {
    errors.push(`${block.id}.props.text phải là văn bản thuần`);
  }
  ["sellerLabel", "sellerHint", "customerLabel", "customerHint"].forEach((key) => {
    const maxLength = key.endsWith("Hint") ? 240 : 120;
    if (key in props && (typeof props[key] !== "string" || props[key].length > maxLength || PLAIN_TEXT_PATTERN.test(props[key]))) {
      errors.push(`${block.id}.props.${key} phải là văn bản thuần`);
    }
  });
  const numericRanges = {
    fontSizePt: [6, 48],
    bodyFontSizePt: [6, 18],
    headerFontSizePt: [6, 18],
    lineHeight: [1, 2.5],
    cellPaddingMm: [0.5, 4],
    thicknessMm: [0.1, 5],
    writingSpaceMm: [5, 80]
  };
  Object.entries(numericRanges).forEach(([key, [min, max]]) => {
    if (key in props && (!Number.isFinite(props[key]) || props[key] < min || props[key] > max)) {
      errors.push(`${block.id}.props.${key} không hợp lệ`);
    }
  });
  if ("textAlign" in props && !ALIGNMENTS.has(props.textAlign)) errors.push(`${block.id}.props.textAlign không hợp lệ`);
  if ("lineStyle" in props && !["solid", "dashed"].includes(props.lineStyle)) errors.push(`${block.id}.props.lineStyle không hợp lệ`);
  Object.entries(props).forEach(([key, value]) => {
    if ((key.startsWith("show") || ["bold", "italic", "underline", "preserveAspectRatio"].includes(key)) && typeof value !== "boolean") {
      errors.push(`${block.id}.props.${key} phải là boolean`);
    }
  });
  if (block.type === "productTable") {
    const columnKeys = PRODUCT_TABLE_COLUMNS.map((column) => column.id);
    if (!hasExactKeys(props.columnVisibility, columnKeys) || Object.values(props.columnVisibility || {}).some((value) => typeof value !== "boolean")) {
      errors.push(`${block.id}.props.columnVisibility không hợp lệ`);
    }
    if (!hasExactKeys(props.columnWidthWeights, columnKeys) || Object.values(props.columnWidthWeights || {}).some((value) => !Number.isFinite(value) || value < 1 || value > 100)) {
      errors.push(`${block.id}.props.columnWidthWeights không hợp lệ`);
    }
  }
}

export function validateBuilderDocument(document) {
  const errors = [];
  if (!isPlainObject(document)) return { valid: false, errors: ["Tài liệu không hợp lệ."] };
  if (!hasExactKeys(document, [...DOCUMENT_KEYS])) errors.push("Tài liệu chứa thuộc tính không được phép hoặc thiếu thuộc tính bắt buộc.");
  if (document.builderSchemaVersion !== BUILDER_DOCUMENT_VERSION) errors.push("Phiên bản tài liệu không hợp lệ.");
  const paper = document.paper;
  if (!hasExactKeys(paper, [...PAPER_KEYS]) || paper.size !== "A4" || paper.orientation !== "portrait" || !Number.isFinite(paper.marginMm) || paper.marginMm < 0 || paper.marginMm > 30 || !Number.isFinite(paper.gridMm) || paper.gridMm < 1 || paper.gridMm > 10) {
    errors.push("Khổ giấy không hợp lệ.");
  }
  if (!Array.isArray(document.blocks) || document.blocks.length > MAX_BUILDER_BLOCKS) {
    return { valid: false, errors: [...errors, "Danh sách khối không hợp lệ."] };
  }
  try {
    if (new TextEncoder().encode(JSON.stringify(document)).length > BUILDER_MAX_CONFIG_BYTES) errors.push("Tài liệu vượt quá giới hạn dung lượng.");
  } catch {
    errors.push("Tài liệu không thể tuần tự hóa.");
  }
  const ids = new Set();
  const zIndexes = new Set();
  document.blocks.forEach((block) => {
    if (!hasExactKeys(block, [...BLOCK_KEYS])) errors.push(`${block?.id || "block"} chứa thuộc tính không được phép hoặc thiếu thuộc tính bắt buộc`);
    if (!isPlainObject(block) || typeof block.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(block.id) || ids.has(block.id)) errors.push("ID khối phải hợp lệ và duy nhất.");
    else ids.add(block.id);
    if (!BUILDER_BLOCK_TYPES.includes(block?.type)) errors.push(`${block?.id || "block"}.type không hợp lệ`);
    const min = getBlockMinimumSize(block?.type);
    if (![block?.xMm, block?.yMm, block?.widthMm, block?.heightMm].every(Number.isFinite)) errors.push(`${block?.id || "block"}.geometry không hữu hạn`);
    else if (block.xMm < 0 || block.yMm < 0 || block.widthMm < min.widthMm || block.heightMm < min.heightMm || block.xMm + block.widthMm > A4_WIDTH_MM + 0.001 || block.yMm + block.heightMm > A4_HEIGHT_MM + 0.001) errors.push(`${block.id}.geometry nằm ngoài trang`);
    if (!Number.isInteger(block?.zIndex) || block.zIndex < 1 || block.zIndex > MAX_BUILDER_BLOCKS || zIndexes.has(block.zIndex)) errors.push(`${block?.id || "block"}.zIndex không hợp lệ`);
    else zIndexes.add(block.zIndex);
    if (typeof block?.locked !== "boolean") errors.push(`${block?.id || "block"}.locked không hợp lệ`);
    validateCanonicalProps(block || {}, errors);
  });
  return { valid: errors.length === 0, errors };
}

function normalizeLegacyProps(type, props = {}) {
  const defaults = BLOCK_DEFAULTS[type]?.props;
  if (!defaults) return props;
  if (["text", "title", "notes"].includes(type)) {
    return Object.fromEntries(COMMON_TEXT_PROP_KEYS.map((key) => [key, props[key] ?? defaults[key]]));
  }
  if (type === "logo") return { preserveAspectRatio: props.preserveAspectRatio ?? true };
  if (type === "shopInfo") return {
    showLogo: props.showLogo ?? false,
    showName: props.showName ?? true,
    showAddress: props.showAddress ?? true,
    showPhone: props.showPhone ?? true,
    showEmail: props.showEmail ?? true,
    fontSizePt: props.fontSizePt ?? 9,
    textAlign: props.textAlign ?? "center"
  };
  if (type === "voucherMetadata") return {
    showVoucherCode: props.showVoucherCode ?? true,
    showDate: props.showDate ?? true,
    showTime: props.showTime ?? true,
    fontSizePt: props.fontSizePt ?? 9,
    textAlign: props.textAlign ?? "left"
  };
  if (type === "customerInfo") return {
    showName: props.showName ?? true,
    showPhone: props.showPhone ?? true,
    showAddress: props.showAddress ?? true,
    showNote: props.showNote ?? true,
    fontSizePt: props.fontSizePt ?? 9
  };
  if (type === "productTable") {
    const legacyVisible = Array.isArray(props.visibleColumns) ? new Set(props.visibleColumns) : null;
    return {
      columnVisibility: Object.fromEntries(PRODUCT_TABLE_COLUMNS.map(({ id }) => [id, legacyVisible ? legacyVisible.has(id) : (props.columnVisibility?.[id] ?? true)])),
      columnWidthWeights: Object.fromEntries(PRODUCT_TABLE_COLUMNS.map(({ id }) => [id, props.columnWidthWeights?.[id] ?? defaults.columnWidthWeights[id]])),
      bodyFontSizePt: props.bodyFontSizePt ?? props.fontSizePt ?? 9,
      headerFontSizePt: props.headerFontSizePt ?? 9,
      cellPaddingMm: props.cellPaddingMm ?? 2,
      showSaleNote: props.showSaleNote ?? true
    };
  }
  if (type === "totals") return {
    showSubtotal: props.showSubtotal ?? props.showGrossTotal ?? true,
    showDiscount: props.showDiscount ?? props.showDiscountTotal ?? true,
    showGrandTotal: props.showGrandTotal ?? true,
    fontSizePt: props.fontSizePt ?? 9,
    textAlign: props.textAlign ?? "right"
  };
  if (type === "signatures") return {
    sellerLabel: props.showSeller === false ? "" : (props.sellerLabel ?? "Người bán"),
    sellerHint: props.showSeller === false ? "" : (props.sellerHint ?? "(Ký và ghi rõ họ tên)"),
    customerLabel: props.showCustomer === false ? "" : (props.customerLabel ?? "Khách hàng"),
    customerHint: props.showCustomer === false ? "" : (props.customerHint ?? "(Kiểm tra và ký nhận)"),
    fontSizePt: props.fontSizePt ?? 9,
    writingSpaceMm: props.writingSpaceMm ?? 14
  };
  if (type === "horizontalRule") return {
    thicknessMm: props.thicknessMm ?? (Number.isFinite(props.thicknessPt) ? props.thicknessPt * 0.352778 : 0.3),
    lineStyle: props.lineStyle ?? "solid"
  };
  return clone(defaults);
}

export function normalizeBuilderLabDocumentToCanonical(source) {
  if (!isPlainObject(source)) return { ok: false, document: null, errors: ["Tài liệu không hợp lệ."] };
  if (source.builderSchemaVersion === BUILDER_DOCUMENT_VERSION) {
    const document = clone(source);
    const validation = validateBuilderDocument(document);
    return { ok: validation.valid, document: validation.valid ? document : null, errors: validation.errors };
  }
  if (source.version !== 1 || !isPlainObject(source.paper) || !Array.isArray(source.blocks)) {
    return { ok: false, document: null, errors: ["Phiên bản bản thử trên trình duyệt không được hỗ trợ."] };
  }
  const document = {
    builderSchemaVersion: BUILDER_DOCUMENT_VERSION,
    paper: {
      size: source.paper.size,
      orientation: source.paper.orientation,
      marginMm: source.paper.marginMm,
      gridMm: source.paper.gridMm
    },
    blocks: source.blocks.map((sourceBlock) => {
      const type = sourceBlock.type === "divider" ? "horizontalRule" : sourceBlock.type;
      return {
        id: sourceBlock.id,
        type,
        xMm: sourceBlock.xMm,
        yMm: sourceBlock.yMm,
        widthMm: sourceBlock.widthMm,
        heightMm: sourceBlock.heightMm,
        zIndex: sourceBlock.zIndex,
        locked: sourceBlock.locked,
        props: normalizeLegacyProps(type, sourceBlock.props)
      };
    })
  };
  const validation = validateBuilderDocument(document);
  return { ok: validation.valid, document: validation.valid ? document : null, errors: validation.errors };
}

export function saveBuilderDocumentToStorage(document, storage) {
  const validation = validateBuilderDocument(document);
  if (!validation.valid) return { ok: false, errors: validation.errors };
  try {
    const resolvedStorage = storage ?? window.localStorage;
    resolvedStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(serializeBuilderDocument(document)));
    return { ok: true, errors: [] };
  } catch {
    return { ok: false, errors: ["Không thể lưu bản thử trên trình duyệt này."] };
  }
}

export function readBuilderDocumentFromStorage(storage) {
  const result = inspectBuilderDocumentStorage(storage);
  return result.status === "valid" ? result.document : null;
}

export function inspectBuilderDocumentStorage(storage) {
  try {
    const resolvedStorage = storage ?? window.localStorage;
    const raw = resolvedStorage.getItem(BUILDER_STORAGE_KEY);
    if (!raw) return { status: "absent", document: null, errors: [] };
    const normalized = normalizeBuilderLabDocumentToCanonical(JSON.parse(raw));
    return normalized.ok
      ? { status: "valid", document: normalized.document, errors: [] }
      : { status: "invalid", document: null, errors: normalized.errors };
  } catch {
    return { status: "invalid", document: null, errors: ["Bản thử trên trình duyệt không hợp lệ."] };
  }
}

export function removeBuilderDocumentFromStorage(storage) {
  try {
    const resolvedStorage = storage ?? window.localStorage;
    resolvedStorage.removeItem(BUILDER_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
