import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createQuickNote, listQuickNotes, updateQuickNote } from "../../services/quickNotes.service";
import {
  formatQuickNoteTime,
  clampQuickNotesPosition,
  derivePanelPositionFromAnchor,
  didPointerMoveBeyondThreshold,
  getDefaultQuickNotesPosition,
  getQuickNotePresentation,
  prependQuickNote,
  replaceQuickNote,
  selectLatestQuickNotes
} from "../../utils/quickNotes";
import { QuickNoteComposer } from "./QuickNoteComposer";

const EMPTY_POSITION = { x: 0, y: 0 };

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function elementSize(element) {
  const rect = element?.getBoundingClientRect();
  return { width: rect?.width || 0, height: rect?.height || 0 };
}

function MessageIcon({ className = "" }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h7m-9.5 7.5 1.3-3.7A8 8 0 1 1 20 11a8 8 0 0 1-8 8H4.5Z" />
    </svg>
  );
}

export function QuickNoteWidget({ defaultBottomOffset = 0, context = "admin" }) {
  const surfaceRef = useRef(null);
  const buttonSizeRef = useRef({ width: 0, height: 0 });
  const gestureRef = useRef(null);
  const positionRef = useRef(EMPTY_POSITION);
  const initializedRef = useRef(false);
  const openingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef(null);
  const previousUserSelectRef = useRef("");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(EMPTY_POSITION);
  const [positionReady, setPositionReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notes, setNotes] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const updatePosition = useCallback((nextPosition) => {
    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, []);

  const restoreSelection = useCallback(() => {
    document.body.style.userSelect = previousUserSelectRef.current;
    setDragging(false);
  }, []);

  const stopGesture = useCallback((event, { cancelled = false } = {}) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const wasDragging = gesture.dragging;
    gestureRef.current = null;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasDragging) {
      restoreSelection();
      if (gesture.mode === "button") {
        suppressClickRef.current = true;
        window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    }
    if (cancelled) suppressClickRef.current = wasDragging;
  }, [restoreSelection]);

  const beginGesture = useCallback((event, mode) => {
    if (event.button !== 0 || !event.isPrimary) return;
    if (mode === "panel" && event.target.closest("button, a, input, textarea, select")) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      mode,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: positionRef.current,
      dragging: false
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const moveGesture = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const currentPointer = { x: event.clientX, y: event.clientY };
    if (!gesture.dragging) {
      if (!didPointerMoveBeyondThreshold(gesture.startPointer, currentPointer)) return;
      gesture.dragging = true;
      previousUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      setDragging(true);
    }
    event.preventDefault();
    const size = elementSize(surfaceRef.current);
    updatePosition(clampQuickNotesPosition({
      x: gesture.startPosition.x + currentPointer.x - gesture.startPointer.x,
      y: gesture.startPosition.y + currentPointer.y - gesture.startPointer.y
    }, viewportSize(), size));
  }, [updatePosition]);

  const closePanel = useCallback(() => {
    const panelSize = elementSize(surfaceRef.current);
    const nextButtonPosition = clampQuickNotesPosition({
      x: positionRef.current.x + panelSize.width - buttonSizeRef.current.width,
      y: positionRef.current.y + panelSize.height - buttonSizeRef.current.height
    }, viewportSize(), buttonSizeRef.current);
    updatePosition(nextButtonPosition);
    setOpen(false);
  }, [updatePosition]);

  const openPanel = useCallback(() => {
    openingRef.current = true;
    setOpen(true);
  }, []);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const size = elementSize(surface);
    if (!open) buttonSizeRef.current = size;

    if (!initializedRef.current) {
      initializedRef.current = true;
      updatePosition(getDefaultQuickNotesPosition(viewportSize(), size, { bottomOffset: defaultBottomOffset }));
      setPositionReady(true);
      return;
    }

    if (open && openingRef.current) {
      openingRef.current = false;
      updatePosition(derivePanelPositionFromAnchor(
        positionRef.current,
        buttonSizeRef.current,
        size,
        viewportSize()
      ));
      return;
    }

    updatePosition(clampQuickNotesPosition(positionRef.current, viewportSize(), size));
  }, [defaultBottomOffset, open, updatePosition]);

  useEffect(() => {
    const handleResize = () => {
      const size = elementSize(surfaceRef.current);
      updatePosition(clampQuickNotesPosition(positionRef.current, viewportSize(), size));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updatePosition]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver !== "function") return undefined;
    let previousSize = elementSize(surface);
    const observer = new ResizeObserver(() => {
      const nextSize = elementSize(surface);
      if (nextSize.width === previousSize.width && nextSize.height === previousSize.height) return;
      previousSize = nextSize;
      if (!open) buttonSizeRef.current = nextSize;
      updatePosition(clampQuickNotesPosition(positionRef.current, viewportSize(), nextSize));
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, [open, updatePosition]);

  useEffect(() => () => {
    gestureRef.current = null;
    window.clearTimeout(suppressClickTimerRef.current);
    document.body.style.userSelect = previousUserSelectRef.current;
  }, []);

  const loadNotes = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const result = await listQuickNotes({ status: "all", limit: 8 });
      setNotes(selectLatestQuickNotes(result.items, 8));
      setPendingCount(result.pendingCount);
    } catch (loadError) {
      setError(loadError?.message || "Không thể tải Sổ nhanh.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    const handleFocus = () => loadNotes({ quiet: true });
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadNotes]);

  useEffect(() => {
    if (open) loadNotes({ quiet: true });
  }, [loadNotes, open]);

  async function handleCreate(content) {
    const created = await createQuickNote(content);
    setNotes((current) => selectLatestQuickNotes(prependQuickNote(current, created), 8));
    setPendingCount((current) => current + 1);
  }

  async function toggleProcessed(note) {
    if (updatingId !== null) return;
    setUpdatingId(note.id);
    setError("");
    try {
      const updated = await updateQuickNote(note.id, { is_processed: !note.is_processed });
      setNotes((current) => replaceQuickNote(current, updated));
      setPendingCount((current) => Math.max(0, current + (updated.is_processed ? -1 : 1)));
    } catch (updateError) {
      setError(updateError?.message || "Không thể cập nhật ghi chú.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div
      className="fixed left-0 top-0 z-[45]"
      data-quick-note-context={context}
      style={{
        transform: `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)`,
        visibility: positionReady ? "visible" : "hidden"
      }}
    >
      {open && (
        <section
          ref={surfaceRef}
          id="quick-note-panel"
          className="flex max-h-[min(70vh,620px)] w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.24)] ring-1 ring-slate-900/5"
          role="dialog"
          aria-modal="false"
          aria-labelledby="quick-note-panel-title"
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              closePanel();
            }
          }}
        >
          <header
            className={`flex touch-manipulation items-center justify-between border-b border-brand-100 bg-brand-900 px-4 py-3 text-white ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
            onPointerDown={(event) => beginGesture(event, "panel")}
            onPointerMove={moveGesture}
            onPointerUp={(event) => stopGesture(event)}
            onPointerCancel={(event) => stopGesture(event, { cancelled: true })}
            title="Kéo để di chuyển Sổ nhanh"
          >
            <div className="min-w-0">
              <h2 id="quick-note-panel-title" className="font-bold tracking-wide">Sổ nhanh</h2>
              <p className="text-xs font-medium text-blue-100">{pendingCount} ghi chú chưa xử lý</p>
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={closePanel}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-xl text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Đóng Sổ nhanh"
            >
              ×
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {loading && <p className="py-6 text-center text-sm text-slate-500" role="status">Đang tải...</p>}
            {!loading && notes.length === 0 && !error && (
              <p className="py-6 text-center text-sm text-slate-500">Chưa có ghi chú nào.</p>
            )}
            <div className="space-y-1.5">
              {notes.map((note) => {
                const presentation = getQuickNotePresentation(note);
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => toggleProcessed(note)}
                    disabled={updatingId !== null}
                    className={`flex min-h-12 w-full min-w-0 items-start gap-2 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      note.is_processed ? "border-slate-200 bg-slate-50 text-slate-600" : "border-brand-100 bg-white text-slate-900 shadow-sm hover:border-brand-500 hover:bg-brand-50"
                    }`}
                    aria-label={`${presentation.statusLabel}: ${note.content}. Nhấn để ${note.is_processed ? "đánh dấu chưa xử lý" : "đánh dấu đã xử lý"}`}
                  >
                    <span className={`mt-0.5 font-bold ${note.is_processed ? "text-emerald-600" : "text-brand-700"}`} aria-hidden="true">
                      {presentation.indicator}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block whitespace-pre-wrap break-words text-sm leading-5">{note.content}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{formatQuickNoteTime(note.created_at)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          </div>

          <footer className="border-t border-slate-200 bg-slate-100 p-3">
            <QuickNoteComposer
              draft={draft}
              onDraftChange={setDraft}
              onCreate={handleCreate}
              compact
            />
            <Link
              to="/admin/quick-notes"
              onClick={() => setOpen(false)}
              className="mt-2 flex min-h-10 items-center justify-center rounded-lg border border-brand-100 bg-white text-sm font-semibold text-brand-700 hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Xem tất cả
            </Link>
          </footer>
        </section>
      )}

      {!open && (
        <button
          ref={surfaceRef}
          type="button"
          onPointerDown={(event) => beginGesture(event, "button")}
          onPointerMove={moveGesture}
          onPointerUp={(event) => stopGesture(event)}
          onPointerCancel={(event) => stopGesture(event, { cancelled: true })}
          onClick={(event) => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              event.preventDefault();
              return;
            }
            openPanel();
          }}
          className={`relative flex min-h-11 touch-manipulation items-center gap-2 rounded-full border-2 border-brand-500 bg-white px-4 py-2.5 text-sm font-semibold text-brand-900 shadow-[0_8px_24px_rgba(30,58,138,0.28)] transition hover:-translate-y-0.5 hover:border-brand-700 hover:bg-brand-50 hover:shadow-[0_12px_28px_rgba(30,58,138,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          aria-expanded={open}
          aria-controls="quick-note-panel"
          aria-label={`Sổ nhanh${pendingCount > 0 ? `, ${pendingCount} ghi chú chưa xử lý` : ""}. Có thể kéo để di chuyển.`}
        >
          <MessageIcon className="h-5 w-5 text-brand-700" />
          <span>Sổ nhanh</span>
          {pendingCount > 0 && (
            <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white shadow-sm" aria-hidden="true">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
