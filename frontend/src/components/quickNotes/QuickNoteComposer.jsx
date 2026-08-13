import { useRef, useState } from "react";
import { QUICK_NOTE_MAX_LENGTH, normalizeQuickNoteDraft, resolveDraftAfterSubmit } from "../../utils/quickNotes";

export function QuickNoteComposer({ draft, onDraftChange, onCreate, compact = false }) {
  const inputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    const content = normalizeQuickNoteDraft(draft);
    if (!content || submitting) return;

    setSubmitting(true);
    setError("");
    try {
      await onCreate(content);
      onDraftChange(resolveDraftAfterSubmit(draft, true));
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } catch (submitError) {
      onDraftChange(resolveDraftAfterSubmit(draft, false));
      setError(submitError?.message || "Không thể lưu ghi chú. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <form className="flex min-w-0 gap-2" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={compact ? "quick-note-panel-input" : "quick-note-page-input"}>
          Ghi nhanh
        </label>
        <input
          ref={inputRef}
          id={compact ? "quick-note-panel-input" : "quick-note-page-input"}
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={QUICK_NOTE_MAX_LENGTH}
          placeholder="Ghi nhanh..."
          autoComplete="off"
          className={`${compact ? "h-10 px-3 text-sm" : "h-12 px-4 text-base"} min-w-0 flex-1 rounded-xl border border-slate-400 bg-white text-slate-900 shadow-inner outline-none transition placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100`}
          disabled={submitting}
          aria-describedby={error ? `${compact ? "panel" : "page"}-quick-note-error` : undefined}
        />
        <button
          type="submit"
          disabled={submitting || !normalizeQuickNoteDraft(draft)}
          className={`${compact ? "h-10 px-3 text-sm" : "h-12 px-5 text-sm"} shrink-0 rounded-xl bg-brand-700 font-semibold text-white shadow-sm transition hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none`}
          aria-busy={submitting}
        >
          {submitting ? "Đang gửi..." : "Gửi"}
        </button>
      </form>
      {error && (
        <p id={`${compact ? "panel" : "page"}-quick-note-error`} className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
