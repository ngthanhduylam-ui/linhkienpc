export const BUILDER_STORAGE_KEY = "print_template_builder_lab_v1";
export const BUILDER_DOCUMENT_VERSION = 1;
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
  "divider"
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
  { type: "divider", label: "Đường kẻ ngang" }
]);

const BLOCK_DEFAULTS = Object.freeze({
  text: { widthMm: 80, heightMm: 14, props: { text: "Văn bản mới", fontSizePt: 10, bold: false, italic: false, underline: false, textAlign: "left", lineHeight: 1.35 } },
  title: { widthMm: 150, heightMm: 16, props: { text: "TIÊU ĐỀ MỚI", fontSizePt: 17, bold: true, italic: false, underline: false, textAlign: "center", lineHeight: 1.2 } },
  logo: { widthMm: 28, heightMm: 22, props: { preserveAspectRatio: true } },
  shopInfo: { widthMm: 105, heightMm: 24, props: { fontSizePt: 9, textAlign: "center", showName: true, showAddress: true, showPhone: true, showEmail: true } },
  voucherMetadata: { widthMm: 47, heightMm: 24, props: { fontSizePt: 9, textAlign: "left", showVoucherCode: true, showDate: true, showTime: true } },
  customerInfo: { widthMm: 196, heightMm: 26, props: { fontSizePt: 9, textAlign: "left", showName: true, showPhone: true, showAddress: true, showNote: true } },
  productTable: {
    widthMm: 196,
    heightMm: 72,
    props: {
      fontSizePt: 9,
      headerFontSizePt: 9,
      cellPaddingMm: 2,
      showSaleNote: true,
      visibleColumns: PRODUCT_TABLE_COLUMNS.map((column) => column.id),
      columnWidthWeights: { index: 11, productName: 91, quantity: 13, unitPrice: 27, discount: 27, lineTotal: 27 }
    }
  },
  totals: { widthMm: 82, heightMm: 25, props: { fontSizePt: 9, textAlign: "right", showGrossTotal: true, showDiscountTotal: true, showGrandTotal: true } },
  signatures: { widthMm: 196, heightMm: 36, props: { fontSizePt: 9, textAlign: "center", showSeller: true, showCustomer: true } },
  notes: { widthMm: 196, heightMm: 48, props: { text: "Lưu ý:\n- Vui lòng kiểm tra hàng trước khi nhận.\n- Giữ phiếu để được hỗ trợ bảo hành.", fontSizePt: 8.25, bold: false, italic: false, underline: false, textAlign: "left", lineHeight: 1.35 } },
  divider: { widthMm: 100, heightMm: 2, props: { thicknessPt: 1 } }
});

const MIN_SIZES = Object.freeze({
  text: [20, 8], title: [35, 10], logo: [12, 10], shopInfo: [45, 18],
  voucherMetadata: [38, 18], customerInfo: [70, 20], productTable: [110, 45],
  totals: [45, 18], signatures: [70, 24], notes: [45, 20], divider: [20, 1]
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
  shopInfo: ["fontSizePt", "textAlign", "showName", "showAddress", "showPhone", "showEmail", "name", "address", "phone", "email"],
  voucherMetadata: ["fontSizePt", "textAlign", "showVoucherCode", "showDate", "showTime"],
  customerInfo: ["fontSizePt", "textAlign", "showName", "showPhone", "showAddress", "showNote"],
  productTable: ["fontSizePt", "headerFontSizePt", "cellPaddingMm", "showSaleNote", "visibleColumns", "columnWidthWeights"],
  totals: ["fontSizePt", "textAlign", "showGrossTotal", "showDiscountTotal", "showGrandTotal"],
  signatures: ["fontSizePt", "textAlign", "showSeller", "showCustomer"],
  divider: ["thicknessPt"]
});
const BLOCK_KEYS = new Set(["id", "type", "xMm", "yMm", "widthMm", "heightMm", "zIndex", "locked", "props"]);
const PAPER_KEYS = new Set(["size", "orientation", "widthMm", "heightMm", "marginMm", "gridMm"]);
const DOCUMENT_KEYS = new Set(["version", "paper", "blocks"]);

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

function systemShopProps(systemConfig) {
  const shop = systemConfig?.sections?.shopHeader;
  return shop ? {
    name: String(shop.name || "VI TÍNH PHƯỚC TÀI"),
    address: String(shop.address || "98/14 đường số 5, P.17, Q. Gò Vấp"),
    phone: String(shop.phone || "0933712571"),
    email: String(shop.email || "vitinhphuoctai@gmail.com")
  } : {
    name: "VI TÍNH PHƯỚC TÀI",
    address: "98/14 đường số 5, P.17, Q. Gò Vấp",
    phone: "0933712571",
    email: "vitinhphuoctai@gmail.com"
  };
}

export function createDefaultBuilderDocument(systemConfig = null, idFactory = createBuilderId) {
  const placements = [
    ["logo", 7, 7, 28, 22], ["shopInfo", 36, 7, 110, 22], ["voucherMetadata", 155, 7, 48, 22],
    ["title", 20, 35, 170, 14], ["customerInfo", 7, 53, 196, 24], ["productTable", 7, 82, 196, 72],
    ["totals", 121, 158, 82, 25], ["signatures", 7, 188, 196, 34], ["notes", 7, 228, 196, 48]
  ];
  const blocks = placements.map(([type, xMm, yMm, widthMm, heightMm], index) => ({
    ...createBlock(type, { xMm, yMm, widthMm, heightMm, zIndex: index + 1 }, idFactory),
    zIndex: index + 1
  }));
  const shopBlock = blocks.find((block) => block.type === "shopInfo");
  shopBlock.props = { ...shopBlock.props, ...systemShopProps(systemConfig) };
  const titleBlock = blocks.find((block) => block.type === "title");
  titleBlock.props.text = String(systemConfig?.sections?.documentTitle?.text || "PHIẾU BÁN & GIAO HÀNG");
  return {
    version: BUILDER_DOCUMENT_VERSION,
    paper: { size: "A4", orientation: "portrait", widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM, marginMm: 7, gridMm: 2 },
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
  return clone({ version: document.version, paper: document.paper, blocks: document.blocks });
}

function validateProps(block, errors) {
  const props = block.props;
  if (!props || typeof props !== "object" || Array.isArray(props)) { errors.push(`${block.id}.props không hợp lệ`); return; }
  const allowedKeys = PROP_KEYS_BY_TYPE[block.type] || [];
  const unknownKeys = Object.keys(props).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length) errors.push(`${block.id}.props chứa thuộc tính không được phép: ${unknownKeys.join(", ")}`);
  if (TEXT_BLOCK_TYPES.has(block.type)) {
    if (typeof props.text !== "string" || props.text.length > 4000 || PLAIN_TEXT_PATTERN.test(props.text)) errors.push(`${block.id}.props.text phải là văn bản thuần`);
  }
  ["name", "address", "phone", "email"].forEach((key) => {
    if (key in props && (typeof props[key] !== "string" || props[key].length > 500 || PLAIN_TEXT_PATTERN.test(props[key]))) errors.push(`${block.id}.props.${key} phải là văn bản thuần`);
  });
  if ("fontSizePt" in props && (!Number.isFinite(props.fontSizePt) || props.fontSizePt < 6 || props.fontSizePt > 48)) errors.push(`${block.id}.props.fontSizePt không hợp lệ`);
  if ("headerFontSizePt" in props && (!Number.isFinite(props.headerFontSizePt) || props.headerFontSizePt < 6 || props.headerFontSizePt > 18)) errors.push(`${block.id}.props.headerFontSizePt không hợp lệ`);
  if ("lineHeight" in props && (!Number.isFinite(props.lineHeight) || props.lineHeight < 1 || props.lineHeight > 2.5)) errors.push(`${block.id}.props.lineHeight không hợp lệ`);
  if ("cellPaddingMm" in props && (!Number.isFinite(props.cellPaddingMm) || props.cellPaddingMm < 0.5 || props.cellPaddingMm > 4)) errors.push(`${block.id}.props.cellPaddingMm không hợp lệ`);
  if ("thicknessPt" in props && (!Number.isFinite(props.thicknessPt) || props.thicknessPt < 0.5 || props.thicknessPt > 8)) errors.push(`${block.id}.props.thicknessPt không hợp lệ`);
  if ("textAlign" in props && !ALIGNMENTS.has(props.textAlign)) errors.push(`${block.id}.props.textAlign không hợp lệ`);
  Object.entries(props).forEach(([key, value]) => {
    if ((key.startsWith("show") || ["bold", "italic", "underline", "preserveAspectRatio"].includes(key)) && typeof value !== "boolean") errors.push(`${block.id}.props.${key} phải là boolean`);
  });
  if (block.type === "productTable") {
    const columns = props.visibleColumns;
    if (!Array.isArray(columns) || columns.some((id) => !PRODUCT_TABLE_COLUMNS.some((column) => column.id === id)) || new Set(columns).size !== columns.length) errors.push(`${block.id}.props.visibleColumns không hợp lệ`);
    const weights = props.columnWidthWeights;
    if (!weights || typeof weights !== "object" || Array.isArray(weights) || Object.keys(weights).sort().join("|") !== PRODUCT_TABLE_COLUMNS.map((column) => column.id).sort().join("|") || Object.values(weights).some((value) => !Number.isFinite(value) || value < 1 || value > 100)) errors.push(`${block.id}.props.columnWidthWeights không hợp lệ`);
  }
}

export function validateBuilderDocument(document) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { valid: false, errors: ["Tài liệu không hợp lệ."] };
  if (Object.keys(document).some((key) => !DOCUMENT_KEYS.has(key))) errors.push("Tài liệu chứa thuộc tính không được phép.");
  if (document.version !== BUILDER_DOCUMENT_VERSION) errors.push("Phiên bản tài liệu không hợp lệ.");
  const paper = document.paper;
  if (!paper || typeof paper !== "object" || Array.isArray(paper) || Object.keys(paper).some((key) => !PAPER_KEYS.has(key)) || paper.size !== "A4" || paper.orientation !== "portrait" || paper.widthMm !== A4_WIDTH_MM || paper.heightMm !== A4_HEIGHT_MM || !Number.isFinite(paper.marginMm) || paper.marginMm < 0 || paper.marginMm > 30 || !Number.isFinite(paper.gridMm) || paper.gridMm < 0.5 || paper.gridMm > 20) errors.push("Khổ giấy không hợp lệ.");
  if (!Array.isArray(document.blocks) || document.blocks.length > MAX_BUILDER_BLOCKS) return { valid: false, errors: [...errors, "Danh sách khối không hợp lệ."] };
  const ids = new Set();
  const zIndexes = new Set();
  document.blocks.forEach((block) => {
    if (block && typeof block === "object" && !Array.isArray(block) && Object.keys(block).some((key) => !BLOCK_KEYS.has(key))) errors.push(`${block.id || "block"} chứa thuộc tính không được phép`);
    if (!block || typeof block !== "object" || typeof block.id !== "string" || !block.id || ids.has(block.id)) errors.push("ID khối phải duy nhất.");
    else ids.add(block.id);
    if (!BUILDER_BLOCK_TYPES.includes(block?.type)) errors.push(`${block?.id || "block"}.type không hợp lệ`);
    const min = getBlockMinimumSize(block?.type);
    if (![block?.xMm, block?.yMm, block?.widthMm, block?.heightMm].every(Number.isFinite)) errors.push(`${block?.id || "block"}.geometry không hữu hạn`);
    else if (block.xMm < 0 || block.yMm < 0 || block.widthMm < min.widthMm || block.heightMm < min.heightMm || block.xMm + block.widthMm > A4_WIDTH_MM + 0.001 || block.yMm + block.heightMm > A4_HEIGHT_MM + 0.001) errors.push(`${block.id}.geometry nằm ngoài trang`);
    if (!Number.isInteger(block?.zIndex) || block.zIndex < 1 || block.zIndex > MAX_BUILDER_BLOCKS || zIndexes.has(block.zIndex)) errors.push(`${block?.id || "block"}.zIndex không hợp lệ`);
    else zIndexes.add(block.zIndex);
    if (typeof block?.locked !== "boolean") errors.push(`${block?.id || "block"}.locked không hợp lệ`);
    validateProps(block || {}, errors);
  });
  return { valid: errors.length === 0, errors };
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
  try {
    const resolvedStorage = storage ?? window.localStorage;
    const raw = resolvedStorage.getItem(BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const document = JSON.parse(raw);
    return validateBuilderDocument(document).valid ? document : null;
  } catch {
    return null;
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
