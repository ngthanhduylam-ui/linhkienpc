import { useCallback, useEffect, useMemo, useState } from "react";
import { createQuickNote, deleteQuickNote, listQuickNotes, updateQuickNote } from "../services/quickNotes.service";
import {
  countPreviousDayPendingNotes,
  filterQuickNotes,
  formatQuickNoteTime,
  getQuickNotePresentation,
  groupQuickNotesByDate,
  prependQuickNote,
  removeQuickNote,
  replaceQuickNote
} from "../utils/quickNotes";
import { QuickNoteComposer } from "../components/quickNotes/QuickNoteComposer";

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chưa xử lý" },
  { id: "processed", label: "Đã xử lý" }
];

function QuickNoteCard({ note, busy, onToggle, onEdit, onDelete }) {
  const presentation = getQuickNotePresentation(note);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(note.content);
  const [editError, setEditError] = useState("");

  useEffect(() => setEditValue(note.content), [note.content]);

  async function submitEdit(event) {
    event.preventDefault();
    const content = editValue.trim();
    if (!content) {
      setEditError("Vui lòng nhập nội dung ghi chú.");
      return;
    }
    setEditError("");
    try {
      await onEdit(note, content);
      setEditing(false);
    } catch (error) {
      setEditError(error?.message || "Không thể sửa ghi chú.");
    }
  }

  return (
    <article className={`relative ml-auto w-full max-w-2xl rounded-2xl border px-4 py-3 shadow-sm ${
      note.is_processed ? "border-slate-200 bg-slate-50 text-slate-700" : "border-brand-100 bg-white text-slate-900"
    }`}>
      {editing ? (
        <form onSubmit={submitEdit}>
          <label htmlFor={`quick-note-edit-${note.id}`} className="sr-only">Sửa nội dung ghi chú</label>
          <input
            id={`quick-note-edit-${note.id}`}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            maxLength={500}
            autoFocus
            className="h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          {editError && <p className="mt-1 text-sm text-red-700" role="alert">{editError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setEditValue(note.content); setEditError(""); }} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Hủy
            </button>
            <button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              Lưu
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex min-w-0 items-start gap-2 pr-10">
            <span className={`mt-0.5 text-lg font-bold ${note.is_processed ? "text-emerald-600" : "text-brand-600"}`} aria-hidden="true">
              {presentation.indicator}
            </span>
            <p className="min-w-0 whitespace-pre-wrap break-words text-[15px] leading-6">{note.content}</p>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-slate-500">
            <span>{presentation.statusLabel}</span>
            <span aria-hidden="true">•</span>
            <time dateTime={note.created_at}>{formatQuickNoteTime(note.created_at)}</time>
          </div>

          <details className="absolute right-2 top-2">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`Thao tác với ghi chú ${note.content}`}>
              ⋯
            </summary>
            <div className="absolute right-0 top-10 z-10 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              <button type="button" onClick={() => onToggle(note)} disabled={busy} className="min-h-10 w-full px-3 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {note.is_processed ? "Đánh dấu chưa xử lý" : "Đánh dấu đã xử lý"}
              </button>
              <button type="button" onClick={() => setEditing(true)} disabled={busy} className="min-h-10 w-full px-3 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                Sửa
              </button>
              <button type="button" onClick={() => onDelete(note)} disabled={busy} className="min-h-10 w-full px-3 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60">
                Xóa
              </button>
            </div>
          </details>
        </>
      )}
    </article>
  );
}

export function QuickNotesPage() {
  const [notes, setNotes] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listQuickNotes({ status: "all", limit: 200 });
      setNotes(result.items);
      setPendingCount(result.pendingCount);
    } catch (loadError) {
      setError(loadError?.message || "Không thể tải Sổ nhanh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const visibleNotes = useMemo(() => filterQuickNotes(notes, filter), [filter, notes]);
  const groups = useMemo(() => groupQuickNotesByDate(visibleNotes), [visibleNotes]);
  const oldPendingCount = useMemo(() => countPreviousDayPendingNotes(notes), [notes]);

  async function handleCreate(content) {
    const created = await createQuickNote(content);
    setNotes((current) => prependQuickNote(current, created));
    setPendingCount((current) => current + 1);
  }

  async function handleToggle(note) {
    if (busyId !== null) return;
    setBusyId(note.id);
    setError("");
    try {
      const updated = await updateQuickNote(note.id, { is_processed: !note.is_processed });
      setNotes((current) => replaceQuickNote(current, updated));
      setPendingCount((current) => Math.max(0, current + (updated.is_processed ? -1 : 1)));
    } catch (updateError) {
      setError(updateError?.message || "Không thể cập nhật ghi chú.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEdit(note, content) {
    if (busyId !== null) return;
    setBusyId(note.id);
    setError("");
    try {
      const updated = await updateQuickNote(note.id, { content });
      setNotes((current) => replaceQuickNote(current, updated));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(note) {
    if (busyId !== null || !window.confirm("Xóa ghi chú này?")) return;
    setBusyId(note.id);
    setError("");
    try {
      await deleteQuickNote(note.id);
      setNotes((current) => removeQuickNote(current, note.id));
      if (!note.is_processed) setPendingCount((current) => Math.max(0, current - 1));
    } catch (deleteError) {
      setError(deleteError?.message || "Không thể xóa ghi chú.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl pb-3">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Sổ nhanh</h1>
        <p className="mt-1 text-sm text-slate-500">Ghi lại việc cần nhớ, xử lý sau khi cửa hàng bớt bận.</p>
      </div>

      <div className="mb-4 flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Lọc ghi chú">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          const count = item.id === "pending" ? pendingCount : null;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item.id)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                active
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-900"
              }`}
            >
              {item.label}{count !== null ? ` ${count}` : ""}
            </button>
          );
        })}
      </div>

      {oldPendingCount > 0 && (
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className="mb-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Còn {oldPendingCount} ghi chú từ ngày trước chưa xử lý
        </button>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadNotes} className="shrink-0 font-semibold underline">Thử lại</button>
        </div>
      )}

      <div className="min-h-[240px] space-y-6">
        {loading && <p className="py-12 text-center text-sm text-slate-500" role="status">Đang tải ghi chú...</p>}
        {!loading && groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
            {filter === "all" ? "Chưa có ghi chú nào. Hãy ghi nhanh việc bạn cần nhớ." : "Không có ghi chú trong trạng thái này."}
          </div>
        )}
        {!loading && groups.map((group) => (
          <section key={group.key} aria-labelledby={`quick-note-date-${group.key}`}>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <h2 id={`quick-note-date-${group.key}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h2>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="space-y-3">
              {group.items.map((note) => (
                <QuickNoteCard
                  key={note.id}
                  note={note}
                  busy={busyId !== null}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-3 z-10 mt-6 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <QuickNoteComposer draft={draft} onDraftChange={setDraft} onCreate={handleCreate} />
      </div>
    </div>
  );
}
