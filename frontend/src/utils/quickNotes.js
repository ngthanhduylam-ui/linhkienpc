export const QUICK_NOTE_MAX_LENGTH = 500;
export const QUICK_NOTE_SAFE_MARGIN = 16;
export const QUICK_NOTE_DRAG_THRESHOLD = 6;

function finiteOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function clampQuickNotesPosition(
  position,
  viewport,
  element,
  margin = QUICK_NOTE_SAFE_MARGIN
) {
  const safeMargin = Math.max(0, finiteOrZero(margin));
  const viewportWidth = Math.max(0, finiteOrZero(viewport?.width));
  const viewportHeight = Math.max(0, finiteOrZero(viewport?.height));
  const elementWidth = Math.max(0, finiteOrZero(element?.width));
  const elementHeight = Math.max(0, finiteOrZero(element?.height));
  const minX = Math.min(safeMargin, Math.max(0, viewportWidth - elementWidth));
  const minY = Math.min(safeMargin, Math.max(0, viewportHeight - elementHeight));
  const maxX = Math.max(minX, viewportWidth - elementWidth - safeMargin);
  const maxY = Math.max(minY, viewportHeight - elementHeight - safeMargin);

  return {
    x: Math.min(maxX, Math.max(minX, finiteOrZero(position?.x))),
    y: Math.min(maxY, Math.max(minY, finiteOrZero(position?.y)))
  };
}

export function getDefaultQuickNotesPosition(
  viewport,
  element,
  { margin = QUICK_NOTE_SAFE_MARGIN, bottomOffset = 0 } = {}
) {
  return clampQuickNotesPosition(
    {
      x: finiteOrZero(viewport?.width) - finiteOrZero(element?.width) - finiteOrZero(margin),
      y:
        finiteOrZero(viewport?.height) -
        finiteOrZero(element?.height) -
        finiteOrZero(margin) -
        Math.max(0, finiteOrZero(bottomOffset))
    },
    viewport,
    element,
    margin
  );
}

export function didPointerMoveBeyondThreshold(start, current, threshold = QUICK_NOTE_DRAG_THRESHOLD) {
  const deltaX = finiteOrZero(current?.x) - finiteOrZero(start?.x);
  const deltaY = finiteOrZero(current?.y) - finiteOrZero(start?.y);
  return Math.hypot(deltaX, deltaY) >= Math.max(0, finiteOrZero(threshold));
}

export function derivePanelPositionFromAnchor(anchor, button, panel, viewport, margin = QUICK_NOTE_SAFE_MARGIN) {
  const buttonWidth = Math.max(0, finiteOrZero(button?.width));
  const buttonHeight = Math.max(0, finiteOrZero(button?.height));
  const panelWidth = Math.max(0, finiteOrZero(panel?.width));
  const panelHeight = Math.max(0, finiteOrZero(panel?.height));
  return clampQuickNotesPosition(
    {
      x: finiteOrZero(anchor?.x) + buttonWidth - panelWidth,
      y: finiteOrZero(anchor?.y) + buttonHeight - panelHeight
    },
    viewport,
    panel,
    margin
  );
}

export function normalizeQuickNoteDraft(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveDraftAfterSubmit(draft, succeeded) {
  return succeeded ? "" : draft;
}

export function toQuickNoteDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)
    ? value.replace(" ", "T")
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDayKey(value) {
  const date = toQuickNoteDate(value);
  if (!date) return "invalid";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(value) {
  const date = toQuickNoteDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getQuickNoteDateLabel(value, now = new Date()) {
  const date = startOfLocalDay(value);
  const today = startOfLocalDay(now);
  if (!date || !today) return "Không rõ ngày";

  const dayDifference = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (dayDifference === 0) return "Hôm nay";
  if (dayDifference === 1) return "Hôm qua";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function formatQuickNoteTime(value) {
  const date = toQuickNoteDate(value);
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function groupQuickNotesByDate(notes, now = new Date()) {
  const groups = [];
  const byKey = new Map();
  for (const note of notes || []) {
    const key = localDayKey(note.created_at);
    if (!byKey.has(key)) {
      const group = {
        key,
        label: getQuickNoteDateLabel(note.created_at, now),
        items: []
      };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).items.push(note);
  }
  return groups;
}

export function countPreviousDayPendingNotes(notes, now = new Date()) {
  const todayKey = localDayKey(now);
  return (notes || []).filter((note) => !note.is_processed && localDayKey(note.created_at) !== todayKey).length;
}

export function filterQuickNotes(notes, status) {
  if (status === "pending") return (notes || []).filter((note) => !note.is_processed);
  if (status === "processed") return (notes || []).filter((note) => note.is_processed);
  return [...(notes || [])];
}

export function selectLatestQuickNotes(notes, limit = 8) {
  return [...(notes || [])]
    .sort((a, b) => {
      const timeDifference = (toQuickNoteDate(b.created_at)?.getTime() || 0) - (toQuickNoteDate(a.created_at)?.getTime() || 0);
      return timeDifference || Number(b.id) - Number(a.id);
    })
    .slice(0, Math.max(0, limit));
}

export function replaceQuickNote(notes, updatedNote) {
  return (notes || []).map((note) => (Number(note.id) === Number(updatedNote.id) ? updatedNote : note));
}

export function prependQuickNote(notes, createdNote) {
  return [createdNote, ...(notes || []).filter((note) => Number(note.id) !== Number(createdNote.id))];
}

export function removeQuickNote(notes, id) {
  return (notes || []).filter((note) => Number(note.id) !== Number(id));
}

export function getQuickNotePresentation(note) {
  return note?.is_processed
    ? { indicator: "✓", statusLabel: "Đã xử lý", muted: true }
    : { indicator: "○", statusLabel: "Chưa xử lý", muted: false };
}
