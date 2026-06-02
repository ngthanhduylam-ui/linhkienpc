import { useState } from "react";

export function SearchResultCard({ product }) {
  const [expanded, setExpanded] = useState(false);
  const hasNotes = (product.noteGroups || []).length > 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
          <p className="mt-1 text-sm text-slate-600">SKU: {product.sku}</p>
          <p className="mt-3 text-sm font-medium text-slate-800">Tổng tồn: {product.totalQuantity}</p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
          aria-label={expanded ? "Thu gọn chi tiết tồn kho" : "Mở rộng chi tiết tồn kho"}
        >
          {expanded ? "▾" : "▸"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="mb-2 text-sm font-medium text-slate-800">Thông tin bảo hành</p>
          {hasNotes ? (
            <ul className="space-y-2">
              {product.noteGroups.map((group) => (
                <li
                  key={`${product.sku}-${group.note}`}
                  className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <span>
                    {group.note} : <span className="font-medium">{group.quantity}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Chưa có ghi chú nhập kho.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
