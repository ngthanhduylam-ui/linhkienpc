export function PrintBuilderToolbar({
  canUndo,
  canRedo,
  gridVisible,
  zoom,
  onUndo,
  onRedo,
  onSaveServer,
  onSaveLocal,
  onDeleteServer,
  onDeleteLocal,
  savingServer,
  serverDraftExists,
  onReset,
  onToggleGrid,
  onZoomChange,
  onFitPage
}) {
  const buttonClass = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="print-builder-toolbar" aria-label="Thanh công cụ trình thiết kế">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">Bản thử nghiệm</span>
        <button type="button" className={buttonClass} disabled={!canUndo} onClick={onUndo}>Hoàn tác</button>
        <button type="button" className={buttonClass} disabled={!canRedo} onClick={onRedo}>Làm lại</button>
        <button type="button" className="min-h-10 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50" disabled={savingServer} onClick={onSaveServer}>{savingServer ? "Đang lưu..." : "Lưu bản nháp"}</button>
        <button type="button" className={buttonClass} onClick={onSaveLocal}>Lưu trên trình duyệt</button>
        <button type="button" className={buttonClass} disabled={!serverDraftExists || savingServer} onClick={onDeleteServer}>Xóa bản nháp hệ thống</button>
        <button type="button" className={buttonClass} onClick={onDeleteLocal}>Xóa bản lưu trình duyệt</button>
        <button type="button" className={buttonClass} onClick={onReset}>Đặt lại mẫu thử</button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} aria-pressed={gridVisible} onClick={onToggleGrid}>{gridVisible ? "Tắt lưới" : "Bật lưới"}</button>
        <button type="button" className={buttonClass} aria-label="Thu nhỏ" onClick={() => onZoomChange(Math.max(0.35, zoom - 0.1))}>−</button>
        <output className="min-w-16 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</output>
        <button type="button" className={buttonClass} aria-label="Phóng to" onClick={() => onZoomChange(Math.min(1.5, zoom + 0.1))}>+</button>
        <button type="button" className={buttonClass} onClick={onFitPage}>Vừa trang</button>
      </div>
    </div>
  );
}
