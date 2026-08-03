import test from "node:test";
import assert from "node:assert/strict";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  BUILDER_HISTORY_LIMIT,
  LOGICAL_PAGE_WIDTH_PX,
  PRODUCT_TABLE_COLUMNS,
  addBlockAtDropPosition,
  addBlockFromPaletteClick,
  blocksOverlap,
  changeBlockZOrder,
  clampBlockGeometry,
  commitBuilderHistory,
  createBlock,
  createBuilderHistory,
  createDefaultBuilderDocument,
  deleteBuilderBlock,
  duplicateBuilderBlock,
  getOverlappingBlockIds,
  mmToRenderedPixels,
  moveBlockByRenderedDelta,
  nudgeBuilderBlock,
  normalizeZOrder,
  redoBuilderHistory,
  renderedPixelsToMm,
  resizeBlockByRenderedDelta,
  rollbackBuilderGesture,
  readBuilderDocumentFromStorage,
  removeBuilderDocumentFromStorage,
  saveBuilderDocumentToStorage,
  serializeBuilderDocument,
  snapBlockPosition,
  snapMm,
  undoBuilderHistory,
  updateBuilderBlock,
  validateBuilderDocument
} from "./printTemplateBuilderLab.js";

function idFactory() {
  let id = 0;
  return (prefix) => `${prefix}-${++id}`;
}

function defaultDocument() {
  return createDefaultBuilderDocument(null, idFactory());
}

test("default prototype document is valid and independent", () => {
  const first = defaultDocument();
  const second = defaultDocument();
  assert.equal(validateBuilderDocument(first).valid, true);
  first.blocks[0].xMm = 99;
  assert.notEqual(first.blocks[0].xMm, second.blocks[0].xMm);
});

test("default document has unique IDs and no production state", () => {
  const document = defaultDocument();
  assert.equal(new Set(document.blocks.map((block) => block.id)).size, document.blocks.length);
  assert.equal(JSON.stringify(document).includes("active_template"), false);
  assert.equal(JSON.stringify(document).includes("customerId"), false);
});

test("millimetres and rendered pixels convert reversibly", () => {
  assert.equal(mmToRenderedPixels(210, LOGICAL_PAGE_WIDTH_PX), LOGICAL_PAGE_WIDTH_PX);
  assert.equal(Number(renderedPixelsToMm(LOGICAL_PAGE_WIDTH_PX / 2, LOGICAL_PAGE_WIDTH_PX).toFixed(3)), 105);
});

test("grid snapping and Alt bypass are deterministic", () => {
  assert.equal(snapMm(11.2, 2), 12);
  assert.equal(snapMm(11.2, 2, true), 11.2);
});

test("page clamping enforces bounds and block minimum size", () => {
  const block = clampBlockGeometry({ ...createBlock("text", {}, idFactory()), xMm: -5, yMm: 999, widthMm: 1, heightMm: 1 });
  assert.equal(block.xMm, 0);
  assert.equal(block.widthMm, 20);
  assert.equal(block.heightMm, 8);
  assert.equal(block.yMm, A4_HEIGHT_MM - 8);
});

test("moving under a scaled canvas converts pixels to millimetres", () => {
  const source = defaultDocument();
  const block = source.blocks.find((item) => item.type === "title");
  const result = moveBlockByRenderedDelta(source, block.id, 20, 10, 420, { bypassSnap: true });
  const moved = result.document.blocks.find((item) => item.id === block.id);
  assert.equal(Number((moved.xMm - block.xMm).toFixed(2)), 10);
  assert.equal(Number((moved.yMm - block.yMm).toFixed(2)), 5);
});

test("resizing under scale enforces practical minimums", () => {
  const source = defaultDocument();
  const table = source.blocks.find((item) => item.type === "productTable");
  const grown = resizeBlockByRenderedDelta(source, table.id, "se", 20, 20, 420, { bypassSnap: true });
  const resized = grown.blocks.find((item) => item.id === table.id);
  assert.equal(resized.widthMm, 203);
  assert.equal(resized.heightMm, 82);
  const tiny = resizeBlockByRenderedDelta(source, table.id, "se", -1000, -1000, 420, { bypassSnap: true });
  assert.equal(tiny.blocks.find((item) => item.id === table.id).widthMm, 110);
});

test("duplicate creates an independent ID and props object", () => {
  const source = defaultDocument();
  const title = source.blocks.find((block) => block.type === "title");
  const result = duplicateBuilderBlock(source, title.id, idFactory());
  assert.notEqual(result.block.id, title.id);
  result.block.props.text = "Changed";
  assert.notEqual(title.props.text, result.block.props.text);
});

test("delete does not mutate source and locked blocks are protected", () => {
  const source = defaultDocument();
  const id = source.blocks[0].id;
  const deleted = deleteBuilderBlock(source, id);
  assert.equal(source.blocks.length, 9);
  assert.equal(deleted.blocks.length, 8);
  const locked = updateBuilderBlock(source, id, { locked: true });
  assert.equal(deleteBuilderBlock(locked, id), locked);
});

test("locked blocks reject pointer and keyboard geometry changes", () => {
  const source = defaultDocument();
  const id = source.blocks[0].id;
  const locked = updateBuilderBlock(source, id, { locked: true });
  assert.equal(moveBlockByRenderedDelta(locked, id, 50, 50, 420).document, locked);
  assert.equal(resizeBlockByRenderedDelta(locked, id, "se", 50, 50, 420), locked);
  assert.equal(nudgeBuilderBlock(locked, id, 5, 5), locked);
});

test("z-order normalization and bounded layer actions are deterministic", () => {
  const source = defaultDocument();
  source.blocks[0].zIndex = 999;
  const normalized = normalizeZOrder(source);
  assert.deepEqual([...normalized.blocks].map((block) => block.zIndex).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const top = changeBlockZOrder(normalized, normalized.blocks[1].id, "top");
  assert.equal(top.blocks.find((block) => block.id === normalized.blocks[1].id).zIndex, 9);
  const duplicateZ = defaultDocument();
  duplicateZ.blocks[1].zIndex = duplicateZ.blocks[0].zIndex;
  assert.equal(validateBuilderDocument(duplicateZ).valid, false);
});

test("overlap detection reports only colliding blocks", () => {
  const first = { id: "a", xMm: 0, yMm: 0, widthMm: 20, heightMm: 20 };
  const second = { id: "b", xMm: 10, yMm: 10, widthMm: 20, heightMm: 20 };
  const third = { id: "c", xMm: 50, yMm: 50, widthMm: 10, heightMm: 10 };
  assert.equal(blocksOverlap(first, second), true);
  assert.equal(blocksOverlap(first, third), false);
  assert.deepEqual(getOverlappingBlockIds({ blocks: [first, second, third] }, "a"), ["b"]);
});

test("drop placement converts rendered coordinates and remains on page", () => {
  const source = defaultDocument();
  const result = addBlockAtDropPosition(source, "text", 420, 594, 840, idFactory());
  assert.equal(result.block.xMm, 65);
  assert.equal(result.block.yMm, 141.5);
  assert.equal(result.block.xMm + result.block.widthMm <= A4_WIDTH_MM, true);
});

test("palette click fallback offsets repeated additions", () => {
  const source = defaultDocument();
  const first = addBlockFromPaletteClick(source, "text", 0, idFactory());
  const second = addBlockFromPaletteClick(first.document, "text", 1, idFactory());
  assert.notEqual(first.block.xMm, second.block.xMm);
  assert.notEqual(first.block.yMm, second.block.yMm);
});

test("smart snapping reports margin and center guides", () => {
  const source = defaultDocument();
  const block = createBlock("text", { xMm: 6.4, yMm: 140 }, idFactory());
  const result = snapBlockPosition(block, source.paper);
  assert.equal(result.block.xMm, 7);
  assert.deepEqual(result.guides.vertical, [7]);
});

test("ordinary text remains plain and markup is rejected", () => {
  const source = defaultDocument();
  const title = source.blocks.find((block) => block.type === "title");
  title.props.text = "<strong>Unsafe</strong>";
  assert.equal(validateBuilderDocument(source).valid, false);
});

test("sample values are not stored as editable production data", () => {
  const serialized = JSON.stringify(serializeBuilderDocument(defaultDocument()));
  assert.equal(serialized.includes("OUT-000114"), false);
  assert.equal(serialized.includes("0901 234 567"), false);
});

test("product table columns remain allowlisted", () => {
  const source = defaultDocument();
  const table = source.blocks.find((block) => block.type === "productTable");
  assert.deepEqual(table.props.visibleColumns, PRODUCT_TABLE_COLUMNS.map((column) => column.id));
  table.props.visibleColumns.push("sku");
  assert.equal(validateBuilderDocument(source).valid, false);
});

test("block properties use a strict per-type allowlist", () => {
  const source = defaultDocument();
  source.blocks[0].props.style = { color: "red" };
  assert.equal(validateBuilderDocument(source).valid, false);
  const root = { ...defaultDocument(), active_template: "custom" };
  assert.equal(validateBuilderDocument(root).valid, false);
});

test("undo and redo restore a committed move", () => {
  const source = defaultDocument();
  const id = source.blocks[0].id;
  const moved = nudgeBuilderBlock(source, id, 5, 0);
  const committed = commitBuilderHistory(createBuilderHistory(source), moved);
  assert.equal(undoBuilderHistory(committed).present.blocks[0].xMm, source.blocks[0].xMm);
  assert.equal(redoBuilderHistory(undoBuilderHistory(committed)).present.blocks[0].xMm, moved.blocks[0].xMm);
});

test("one pointer gesture can be committed as one history entry", () => {
  const source = defaultDocument();
  const id = source.blocks[0].id;
  let preview = moveBlockByRenderedDelta(source, id, 10, 0, 420).document;
  preview = moveBlockByRenderedDelta(source, id, 20, 0, 420).document;
  const history = commitBuilderHistory(createBuilderHistory(source), preview);
  assert.equal(history.past.length, 1);
});

test("pointer cancellation restores the pre-gesture document without a history entry", () => {
  const source = defaultDocument();
  const id = source.blocks[0].id;
  const history = createBuilderHistory(source);
  const partialMove = moveBlockByRenderedDelta(source, id, 80, 40, 420).document;
  const rolledBack = rollbackBuilderGesture(source);
  assert.notDeepEqual(partialMove, source);
  assert.deepEqual(rolledBack, source);
  assert.notEqual(rolledBack, source);
  assert.equal(history.past.length, 0);
  assert.deepEqual(history.present, source);
});

test("new edits clear redo and history remains bounded", () => {
  const source = defaultDocument();
  const id = source.blocks[0].id;
  let history = createBuilderHistory(source, 3);
  for (let index = 0; index < BUILDER_HISTORY_LIMIT; index += 1) history = commitBuilderHistory(history, nudgeBuilderBlock(history.present, id, 1, 0));
  assert.equal(history.past.length, 3);
  history = undoBuilderHistory(history);
  assert.equal(history.future.length, 1);
  history = commitBuilderHistory(history, nudgeBuilderBlock(history.present, id, 0, 1));
  assert.equal(history.future.length, 0);
});

test("local serialization excludes selection, zoom, and active template", () => {
  const source = { ...defaultDocument(), selectedBlockId: "x", zoom: 0.5, active_template: "custom" };
  const serialized = serializeBuilderDocument(source);
  assert.deepEqual(Object.keys(serialized), ["version", "paper", "blocks"]);
  assert.equal(JSON.stringify(serialized).includes("active_template"), false);
});

test("malformed and out-of-page blocks are rejected", () => {
  const malformed = defaultDocument();
  malformed.blocks[0].xMm = Infinity;
  assert.equal(validateBuilderDocument(malformed).valid, false);
  const outside = defaultDocument();
  outside.blocks[0].xMm = A4_WIDTH_MM;
  assert.equal(validateBuilderDocument(outside).valid, false);
});

test("no API save payload is created by the document serializer", () => {
  const serialized = serializeBuilderDocument(defaultDocument());
  assert.equal("custom_template_config" in serialized, false);
  assert.equal("active_template" in serialized, false);
});

test("keyboard nudge respects page bounds", () => {
  const source = defaultDocument();
  const id = source.blocks[0].id;
  const nudged = nudgeBuilderBlock(source, id, -999, -999);
  const block = nudged.blocks.find((item) => item.id === id);
  assert.equal(block.xMm, 0);
  assert.equal(block.yMm, 0);
});

test("local storage save, read, and removal stay local and validated", () => {
  const values = new Map();
  const storage = {
    setItem: (key, value) => values.set(key, value),
    getItem: (key) => values.get(key) || null,
    removeItem: (key) => values.delete(key)
  };
  const source = defaultDocument();
  assert.equal(saveBuilderDocumentToStorage(source, storage).ok, true);
  assert.deepEqual(readBuilderDocumentFromStorage(storage), serializeBuilderDocument(source));
  assert.equal(removeBuilderDocumentFromStorage(storage), true);
  assert.equal(readBuilderDocumentFromStorage(storage), null);
});

test("unavailable storage is handled without throwing", () => {
  const throwingStorage = {
    setItem() { throw new Error("blocked"); },
    getItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); }
  };
  assert.equal(saveBuilderDocumentToStorage(defaultDocument(), throwingStorage).ok, false);
  assert.equal(readBuilderDocumentFromStorage(throwingStorage), null);
  assert.equal(removeBuilderDocumentFromStorage(throwingStorage), false);
});
