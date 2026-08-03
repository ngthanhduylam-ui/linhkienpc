import { PRODUCT_TABLE_COLUMNS } from "../../../utils/printTemplateBuilderLab";

const TYPE_LABELS = {
  text: "Văn bản", title: "Tiêu đề", logo: "Logo cửa hàng", shopInfo: "Thông tin cửa hàng",
  voucherMetadata: "Thông tin phiếu", customerInfo: "Thông tin khách hàng",
  productTable: "Bảng sản phẩm", totals: "Tổng tiền", signatures: "Chữ ký",
  notes: "Lưu ý", horizontalRule: "Đường kẻ ngang"
};

function NumberField({ label, value, min, max, step = 1, disabled, onChange }) {
  return (
    <label className="min-w-0 text-xs font-semibold text-slate-600">
      <span className="mb-1 block">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100" />
    </label>
  );
}

function Toggle({ label, checked, onChange, disabled = false }) {
  return (
    <label className="flex min-h-10 min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
      <span className="min-w-0 break-words">{label}</span>
      <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 shrink-0 accent-blue-600" />
    </label>
  );
}

function AlignmentButtons({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1" aria-label="Căn chữ">
      {[['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']].map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={`min-h-9 rounded-lg border px-2 text-xs font-semibold ${value === id ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600"}`}>{label}</button>
      ))}
    </div>
  );
}

export function PrintBuilderInspector({ block, onUpdate, onDuplicate, onDelete, onChangeZOrder }) {
  if (!block) {
    return (
      <aside className="print-builder-panel print-builder-inspector" aria-label="Thuộc tính khối">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Thuộc tính</h2>
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm leading-6 text-slate-500">Chọn một khối trên trang A4 để chỉnh sửa.</p>
      </aside>
    );
  }

  const updateProps = (patch) => onUpdate({ props: { ...block.props, ...patch } });
  const hasTextControls = ["text", "title", "notes"].includes(block.type);
  const hasTypography = "fontSizePt" in block.props;
  const geometryFields = [
    ["X", "xMm", 0, 210], ["Y", "yMm", 0, 297], ["Rộng", "widthMm", 1, 210], ["Cao", "heightMm", 1, 297]
  ];
  const visibilityControls = {
    shopInfo: [["Logo", "showLogo"], ["Tên cửa hàng", "showName"], ["Địa chỉ", "showAddress"], ["Điện thoại", "showPhone"], ["Email", "showEmail"]],
    voucherMetadata: [["Số phiếu", "showVoucherCode"], ["Ngày", "showDate"], ["Giờ", "showTime"]],
    customerInfo: [["Tên khách hàng", "showName"], ["Điện thoại", "showPhone"], ["Địa chỉ", "showAddress"], ["Ghi chú", "showNote"]],
    totals: [["Tổng tiền hàng", "showSubtotal"], ["Tổng chiết khấu", "showDiscount"], ["Tổng cộng", "showGrandTotal"]]
  }[block.type] || [];

  return (
    <aside className="print-builder-panel print-builder-inspector" aria-label="Thuộc tính khối">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Loại khối</p>
        <h2 className="mt-0.5 break-words text-base font-bold text-slate-900">{TYPE_LABELS[block.type]}</h2>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vị trí và kích thước (mm)</h3>
        <div className="grid grid-cols-2 gap-2">
          {geometryFields.map(([label, key, min, max]) => (
            <NumberField key={key} label={label} value={block[key]} min={min} max={max} step={1} disabled={block.locked} onChange={(value) => onUpdate({ [key]: Number(value) })} />
          ))}
        </div>
        <Toggle label="Khóa vị trí" checked={block.locked} onChange={(locked) => onUpdate({ locked })} />
      </section>

      {hasTextControls && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Văn bản</h3>
          <label className="text-xs font-semibold text-slate-600">Nội dung
            <textarea rows={4} value={block.props.text} onChange={(event) => updateProps({ text: event.target.value })} className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Cỡ chữ" value={block.props.fontSizePt} min={6} max={48} step={0.5} onChange={(value) => updateProps({ fontSizePt: Number(value) })} />
            <NumberField label="Dãn dòng" value={block.props.lineHeight} min={1} max={2.5} step={0.05} onChange={(value) => updateProps({ lineHeight: Number(value) })} />
          </div>
          <div className="grid grid-cols-3 gap-1">
            <Toggle label="Đậm" checked={block.props.bold} onChange={(value) => updateProps({ bold: value })} />
            <Toggle label="Nghiêng" checked={block.props.italic} onChange={(value) => updateProps({ italic: value })} />
            <Toggle label="Gạch chân" checked={block.props.underline} onChange={(value) => updateProps({ underline: value })} />
          </div>
          <AlignmentButtons value={block.props.textAlign} onChange={(textAlign) => updateProps({ textAlign })} />
        </section>
      )}

      {!hasTextControls && hasTypography && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Hiển thị</h3>
          <NumberField label="Cỡ chữ" value={block.props.fontSizePt} min={6} max={32} step={0.5} onChange={(value) => updateProps({ fontSizePt: Number(value) })} />
          {"textAlign" in block.props && <AlignmentButtons value={block.props.textAlign} onChange={(textAlign) => updateProps({ textAlign })} />}
          {visibilityControls.map(([label, key]) => <Toggle key={key} label={label} checked={block.props[key]} onChange={(value) => updateProps({ [key]: value })} />)}
        </section>
      )}

      {block.type === "logo" && <Toggle label="Giữ tỷ lệ logo" checked={block.props.preserveAspectRatio} onChange={(value) => updateProps({ preserveAspectRatio: value })} />}

      {block.type === "productTable" && (
        <section className="space-y-2">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Chiều cao bảng thực tế sẽ thay đổi theo số lượng sản phẩm. Nhiều bảng sản phẩm trên cùng trang chỉ dành cho thử nghiệm.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PRODUCT_TABLE_COLUMNS.map((column) => (
              <Toggle key={column.id} label={column.label} checked={block.props.columnVisibility[column.id]} onChange={(visible) => updateProps({ columnVisibility: { ...block.props.columnVisibility, [column.id]: visible } })} />
            ))}
          </div>
          <Toggle label="Hiện ghi chú bán hàng" checked={block.props.showSaleNote} onChange={(value) => updateProps({ showSaleNote: value })} />
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_TABLE_COLUMNS.map((column) => (
              <NumberField key={column.id} label={`Rộng ${column.label}`} value={block.props.columnWidthWeights[column.id]} min={1} max={100} onChange={(value) => updateProps({ columnWidthWeights: { ...block.props.columnWidthWeights, [column.id]: Number(value) } })} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Cỡ nội dung" value={block.props.bodyFontSizePt} min={6} max={18} step={0.5} onChange={(value) => updateProps({ bodyFontSizePt: Number(value) })} />
            <NumberField label="Cỡ tiêu đề" value={block.props.headerFontSizePt} min={6} max={18} step={0.5} onChange={(value) => updateProps({ headerFontSizePt: Number(value) })} />
            <NumberField label="Đệm ô (mm)" value={block.props.cellPaddingMm} min={0.5} max={4} step={0.5} onChange={(value) => updateProps({ cellPaddingMm: Number(value) })} />
          </div>
        </section>
      )}

      {block.type === "signatures" && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Chữ ký</h3>
          {[["Nhãn người bán", "sellerLabel"], ["Gợi ý người bán", "sellerHint"], ["Nhãn khách hàng", "customerLabel"], ["Gợi ý khách hàng", "customerHint"]].map(([label, key]) => (
            <label key={key} className="block text-xs font-semibold text-slate-600">{label}
              <input value={block.props[key]} onChange={(event) => updateProps({ [key]: event.target.value })} className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </label>
          ))}
          <NumberField label="Khoảng ký (mm)" value={block.props.writingSpaceMm} min={5} max={80} onChange={(value) => updateProps({ writingSpaceMm: Number(value) })} />
        </section>
      )}

      {block.type === "horizontalRule" && (
        <section className="space-y-2">
          <NumberField label="Độ dày (mm)" value={block.props.thicknessMm} min={0.1} max={5} step={0.1} onChange={(value) => updateProps({ thicknessMm: Number(value) })} />
          <label className="block text-xs font-semibold text-slate-600">Kiểu đường
            <select value={block.props.lineStyle} onChange={(event) => updateProps({ lineStyle: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm">
              <option value="solid">Liền</option>
              <option value="dashed">Nét đứt</option>
            </select>
          </label>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Lớp và thao tác</h3>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onChangeZOrder("up")} className="print-builder-inspector-button">Đưa lên một lớp</button>
          <button type="button" onClick={() => onChangeZOrder("down")} className="print-builder-inspector-button">Đưa xuống một lớp</button>
          <button type="button" onClick={() => onChangeZOrder("top")} className="print-builder-inspector-button">Lên trên cùng</button>
          <button type="button" onClick={() => onChangeZOrder("bottom")} className="print-builder-inspector-button">Xuống dưới cùng</button>
          <button type="button" onClick={onDuplicate} className="print-builder-inspector-button">Nhân đôi</button>
          <button type="button" onClick={onDelete} disabled={block.locked} className="print-builder-inspector-button text-red-700 disabled:text-slate-400">Xóa</button>
        </div>
      </section>
    </aside>
  );
}
