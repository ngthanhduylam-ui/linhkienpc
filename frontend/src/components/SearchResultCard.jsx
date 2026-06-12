import { useEffect, useMemo, useState } from "react";
import { formatWarrantyNote } from "../utils/warrantyNote";

export function SearchResultCard({ product, autoExpand = false }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [copyFeedback, setCopyFeedback] = useState("");
  const sortedNoteGroups = useMemo(
    () => [...(product.noteGroups || [])].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0)),
    [product.noteGroups]
  );
  const hasNotes = sortedNoteGroups.length > 0;
  const totalQuantity = Number(product.totalQuantity || 0);
  const isInStock = totalQuantity > 0;

  useEffect(() => {
    setExpanded(autoExpand);
  }, [autoExpand, product.sku]);

  async function handleCopyName(event) {
    event.stopPropagation();
    const text = product.name || "";
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyFeedback("Đã copy tên sản phẩm");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    } catch {
      setCopyFeedback("Không thể copy");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-md">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="min-w-0 flex-1 text-left"
            aria-expanded={expanded}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold leading-snug text-slate-950">{product.name}</h3>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  isInStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {isInStock ? "Còn hàng" : "Hết hàng"}
              </span>
            </div>
            <p className="mt-2 break-all text-sm font-medium text-slate-500">{product.sku}</p>
            {product.categoryName && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{product.categoryName}</p>
            )}
          </button>

          <div className="shrink-0 rounded-2xl bg-sky-50 px-4 py-3 text-center">
            <p className="text-3xl font-extrabold leading-none text-sky-700">{totalQuantity}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Tổng tồn</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyName}
            className="min-h-10 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Copy tên
          </button>
          {copyFeedback && <span className="text-sm font-medium text-emerald-700">{copyFeedback}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex min-h-11 w-full items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:px-5"
        aria-label={expanded ? "Thu gọn nhóm bảo hành / ghi chú" : "Mở nhóm bảo hành / ghi chú"}
      >
        <span>Nhóm bảo hành / ghi chú</span>
        <span className="text-lg leading-none text-slate-500">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
          {hasNotes ? (
            <ul className="space-y-2">
              {sortedNoteGroups.map((group) => (
                <li
                  key={`${product.sku}-${group.note ?? "empty"}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                >
                  <span className="break-words font-semibold text-slate-800">
                    {formatWarrantyNote(group.label || group.note)}
                  </span>
                  <span className="shrink-0 font-bold text-sky-700">còn {Number(group.quantity || 0)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Chưa có tồn kho theo nhóm bảo hành / ghi chú.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
