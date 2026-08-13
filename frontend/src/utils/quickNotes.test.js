import test from "node:test";
import assert from "node:assert/strict";
import {
  countPreviousDayPendingNotes,
  clampQuickNotesPosition,
  derivePanelPositionFromAnchor,
  didPointerMoveBeyondThreshold,
  filterQuickNotes,
  getQuickNoteDateLabel,
  getDefaultQuickNotesPosition,
  getQuickNotePresentation,
  groupQuickNotesByDate,
  normalizeQuickNoteDraft,
  prependQuickNote,
  removeQuickNote,
  replaceQuickNote,
  resolveDraftAfterSubmit,
  selectLatestQuickNotes
} from "./quickNotes.js";

const now = new Date(2026, 7, 13, 12, 0, 0);
const notes = [
  { id: 3, content: "ga 3070ti", is_processed: false, created_at: "2026-08-13 10:42:00" },
  { id: 2, content: "bán 2400 1c", is_processed: true, created_at: "2026-08-12 09:15:00" },
  { id: 1, content: "mai gọi khách", is_processed: false, created_at: "2026-08-10 08:00:00" }
];

test("groups notes into Today, Yesterday, and older local dates", () => {
  assert.deepEqual(groupQuickNotesByDate(notes, now).map(({ label }) => label), [
    "Hôm nay",
    "Hôm qua",
    "10/08/2026"
  ]);
  assert.equal(getQuickNoteDateLabel("2026-08-13 01:00:00", now), "Hôm nay");
  assert.equal(getQuickNoteDateLabel("2026-08-12 23:00:00", now), "Hôm qua");
});

test("counts only pending notes from previous days", () => {
  assert.equal(countPreviousDayPendingNotes(notes, now), 1);
});

test("filters all, pending, and processed states", () => {
  assert.equal(filterQuickNotes(notes, "all").length, 3);
  assert.deepEqual(filterQuickNotes(notes, "pending").map(({ id }) => id), [3, 1]);
  assert.deepEqual(filterQuickNotes(notes, "processed").map(({ id }) => id), [2]);
});

test("processed presentation has a non-color status indicator", () => {
  assert.deepEqual(getQuickNotePresentation(notes[1]), {
    indicator: "✓",
    statusLabel: "Đã xử lý",
    muted: true
  });
});

test("submission trims boundaries, ignores empty input, clears on success and retains on failure", () => {
  assert.equal(normalizeQuickNoteDraft("  ga   3070ti  "), "ga   3070ti");
  assert.equal(normalizeQuickNoteDraft("   "), "");
  assert.equal(resolveDraftAfterSubmit("ga 3070ti", true), "");
  assert.equal(resolveDraftAfterSubmit("ga 3070ti", false), "ga 3070ti");
});

test("only targeted notes are updated, edited, or deleted", () => {
  const updated = replaceQuickNote(notes, { ...notes[0], is_processed: true });
  assert.equal(updated[0].is_processed, true);
  assert.strictEqual(updated[1], notes[1]);
  assert.equal(removeQuickNote(updated, 2).some(({ id }) => id === 2), false);
  assert.deepEqual(prependQuickNote(notes, { id: 4, content: "nguồn 750 1c" }).map(({ id }) => id), [4, 3, 2, 1]);
});

test("panel selects only the latest requested notes without changing raw content", () => {
  const selected = selectLatestQuickNotes([...notes].reverse(), 2);
  assert.deepEqual(selected.map(({ id }) => id), [3, 2]);
  assert.equal(selected[0].content, "ga 3070ti");
});

test("default position resolves to bottom-right with its safe margin and optional POS offset", () => {
  assert.deepEqual(
    getDefaultQuickNotesPosition({ width: 390, height: 844 }, { width: 130, height: 44 }),
    { x: 244, y: 784 }
  );
  assert.deepEqual(
    getDefaultQuickNotesPosition(
      { width: 390, height: 844 },
      { width: 130, height: 44 },
      { bottomOffset: 96 }
    ),
    { x: 244, y: 688 }
  );
});

test("clamp keeps an element inside every viewport edge and reclamps after resize", () => {
  const viewport = { width: 390, height: 844 };
  const element = { width: 160, height: 60 };
  assert.deepEqual(clampQuickNotesPosition({ x: -50, y: 100 }, viewport, element), { x: 16, y: 100 });
  assert.deepEqual(clampQuickNotesPosition({ x: 500, y: 100 }, viewport, element), { x: 214, y: 100 });
  assert.deepEqual(clampQuickNotesPosition({ x: 100, y: -40 }, viewport, element), { x: 100, y: 16 });
  assert.deepEqual(clampQuickNotesPosition({ x: 100, y: 900 }, viewport, element), { x: 100, y: 768 });
  assert.deepEqual(
    clampQuickNotesPosition({ x: 800, y: 600 }, { width: 430, height: 500 }, element),
    { x: 254, y: 424 }
  );
});

test("drag threshold distinguishes a click from a drag", () => {
  assert.equal(didPointerMoveBeyondThreshold({ x: 20, y: 20 }, { x: 23, y: 24 }), false);
  assert.equal(didPointerMoveBeyondThreshold({ x: 20, y: 20 }, { x: 27, y: 20 }), true);
});

test("panel position follows the in-memory anchor and clamps near right and bottom edges", () => {
  const viewport = { width: 390, height: 844 };
  const button = { width: 130, height: 44 };
  const panel = { width: 358, height: 600 };
  assert.deepEqual(
    derivePanelPositionFromAnchor({ x: 244, y: 784 }, button, panel, viewport),
    { x: 16, y: 228 }
  );
  assert.deepEqual(
    derivePanelPositionFromAnchor({ x: 16, y: 16 }, button, panel, viewport),
    { x: 16, y: 16 }
  );
});

test("positions are pure in-memory values and default initialization ignores prior coordinates", () => {
  const viewport = { width: 1366, height: 768 };
  const button = { width: 130, height: 44 };
  const dragged = clampQuickNotesPosition({ x: 40, y: 50 }, viewport, button);
  const reopened = derivePanelPositionFromAnchor(dragged, button, { width: 380, height: 560 }, viewport);
  assert.deepEqual(dragged, { x: 40, y: 50 });
  assert.deepEqual(reopened, { x: 16, y: 16 });
  assert.deepEqual(getDefaultQuickNotesPosition(viewport, button), { x: 1220, y: 708 });
});
