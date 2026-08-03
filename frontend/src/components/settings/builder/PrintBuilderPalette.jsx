import { BUILDER_PALETTE_ITEMS } from "../../../utils/printTemplateBuilderLab";

export function PrintBuilderPalette({ onAddBlock }) {
  function handleDragStart(event, type) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-print-builder-block", type);
    event.dataTransfer.setData("text/plain", type);
  }

  return (
    <aside className="print-builder-panel print-builder-palette" aria-label="Thư viện khối">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Thư viện khối</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Kéo vào trang A4 hoặc bấm để thêm gần giữa trang.</p>
      </div>
      <div className="print-builder-palette-list">
        {BUILDER_PALETTE_ITEMS.map((item) => (
          <button
            key={item.type}
            type="button"
            draggable
            onDragStart={(event) => handleDragStart(event, item.type)}
            onClick={() => onAddBlock(item.type)}
            className="print-builder-palette-item"
          >
            <span aria-hidden="true" className="print-builder-palette-grip">⋮⋮</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
        Trình chỉnh sửa chính xác hoạt động tốt nhất trên máy tính.
      </p>
    </aside>
  );
}
