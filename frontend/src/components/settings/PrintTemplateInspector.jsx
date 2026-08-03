import {
  PRINT_TEMPLATE_LAYOUT_LIMITS,
  PRINT_TEMPLATE_LIMITS,
  PRINT_TEMPLATE_SECTION_DEFINITIONS,
  getSectionNavigatorItems
} from "../../utils/printTemplateEditor";

const LAYOUT_NUMBER_FIELDS = Object.freeze({
  shopHeader: [
    { field: "fontSizePt", label: "Cỡ chữ", unit: "pt" },
    { field: "spacingAfterMm", label: "Khoảng cách phía dưới", unit: "mm" }
  ],
  receiptMetadata: [{ field: "fontSizePt", label: "Cỡ chữ", unit: "pt" }],
  documentTitle: [
    { field: "fontSizePt", label: "Cỡ chữ", unit: "pt" },
    { field: "spacingBeforeMm", label: "Khoảng cách phía trên", unit: "mm" },
    { field: "spacingAfterMm", label: "Khoảng cách phía dưới", unit: "mm" }
  ],
  customerInformation: [
    { field: "fontSizePt", label: "Cỡ chữ", unit: "pt" },
    { field: "spacingAfterMm", label: "Khoảng cách phía dưới", unit: "mm" }
  ],
  productTable: [
    { field: "fontSizePt", label: "Cỡ chữ nội dung", unit: "pt" },
    { field: "headerFontSizePt", label: "Cỡ chữ tiêu đề bảng", unit: "pt" },
    { field: "cellPaddingMm", label: "Khoảng đệm trong ô", unit: "mm", step: 0.5 },
    { field: "spacingAfterMm", label: "Khoảng cách phía dưới", unit: "mm" }
  ],
  totals: [
    { field: "fontSizePt", label: "Cỡ chữ", unit: "pt" },
    { field: "spacingAfterMm", label: "Khoảng cách phía dưới", unit: "mm" }
  ],
  signatures: [
    { field: "fontSizePt", label: "Cỡ chữ", unit: "pt" },
    { field: "writingSpaceMm", label: "Khoảng trống ký tên", unit: "mm" },
    { field: "spacingAfterMm", label: "Khoảng cách phía dưới", unit: "mm" }
  ],
  notes: [
    { field: "fontSizePt", label: "Cỡ chữ", unit: "pt" },
    { field: "spacingBeforeMm", label: "Khoảng cách phía trên", unit: "mm" }
  ]
});

function NumberField({ label, value, min, max, step = 0.5, unit, error, onChange }) {
  return (
    <label className="block min-w-0 text-sm font-semibold text-slate-700">
      {label}
      <span className="mt-1 flex min-w-0 items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className={`h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${error ? "border-red-400" : "border-slate-300"}`}
        />
        <span className="w-7 shrink-0 text-xs font-medium text-slate-500">{unit}</span>
      </span>
      {error && <span className="mt-1 block text-xs font-normal text-red-600">{error}</span>}
    </label>
  );
}

function AlignmentField({ label, value, options, onChange, error }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-slate-700">{label}</legend>
      <div className={`mt-1 grid min-w-0 gap-1 ${options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`} role="group">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`min-h-10 min-w-0 rounded-lg border px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${value === option.value ? "border-brand-400 bg-brand-50 text-brand-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </fieldset>
  );
}

function SectionLayoutControls({ sectionName, values, fieldErrors, onChange }) {
  const fields = LAYOUT_NUMBER_FIELDS[sectionName] || [];
  const alignment = sectionName === "documentTitle"
    ? { label: "Căn tiêu đề", options: [{ value: "left", label: "Trái" }, { value: "center", label: "Giữa" }, { value: "right", label: "Phải" }] }
    : sectionName === "totals"
      ? { label: "Căn khối tổng tiền", options: [{ value: "left", label: "Trái" }, { value: "right", label: "Phải" }] }
      : null;

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50/50 p-3" aria-label="Bố cục phần">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-700">Bố cục</p>
      <div className="grid min-w-0 grid-cols-1 gap-3">
        {alignment && (
          <AlignmentField
            label={alignment.label}
            value={values.textAlign}
            options={alignment.options}
            onChange={(value) => onChange(sectionName, "textAlign", value)}
            error={fieldErrors[`sections.${sectionName}.textAlign`]}
          />
        )}
        {fields.map(({ field, label, unit, step }) => {
          const [min, max] = PRINT_TEMPLATE_LAYOUT_LIMITS[sectionName][field];
          return (
            <NumberField
              key={field}
              label={label}
              value={values[field]}
              min={min}
              max={max}
              step={step}
              unit={unit}
              error={fieldErrors[`sections.${sectionName}.${field}`]}
              onChange={(value) => onChange(sectionName, field, value)}
            />
          );
        })}
      </div>
    </section>
  );
}

function TextField({ label, value, onChange, maxLength, error, multiline = false }) {
  const inputClass = `mt-1 min-h-11 w-full min-w-0 max-w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 ${
    error ? "border-red-400" : "border-slate-300"
  }`;
  const common = {
    value,
    onChange: (event) => onChange(event.target.value),
    maxLength,
    "aria-invalid": Boolean(error)
  };

  return (
    <label className="block min-w-0 text-sm font-semibold text-slate-700">
      {label}
      {multiline ? <textarea {...common} rows={2} className={`${inputClass} resize-y`} /> : <input {...common} type="text" className={inputClass} />}
      <span className="mt-1 flex min-w-0 justify-between gap-2 text-[11px] font-normal text-slate-500">
        <span className="break-words text-red-600">{error || ""}</span>
        <span className="shrink-0">{String(value ?? "").length}/{maxLength}</span>
      </span>
    </label>
  );
}

function ToggleList({ items, values, onChange }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      {items.map((item) => (
        <label key={item.key} className="flex min-h-10 min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(values[item.key])}
            onChange={(event) => onChange(item.key, event.target.checked)}
            className="h-4 w-4 shrink-0 accent-blue-600"
          />
          <span className="min-w-0 break-words">{item.label}</span>
        </label>
      ))}
    </div>
  );
}

function InspectorWarning({ children }) {
  if (!children) return null;
  return <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-800" role="note">{children}</div>;
}

function VisibilityToggle({ checked, onChange }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 text-sm font-semibold text-brand-800">
      <span>Hiển thị phần này</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-blue-600" />
    </label>
  );
}

export function PrintTemplateInspector({
  draft,
  selectedSection,
  onSelectSection,
  fieldErrors,
  onPaperChange,
  onVisibilityChange,
  onSectionFieldChange,
  onNoticeChange,
  onNoticeAdd,
  onNoticeRemove,
  onNoticeMove,
  onResetSectionLayout
}) {
  const selectedDefinition = PRINT_TEMPLATE_SECTION_DEFINITIONS.find((section) => section.id === selectedSection)
    || PRINT_TEMPLATE_SECTION_DEFINITIONS[0];
  const selectedConfig = draft.sections[selectedDefinition.id];
  const navigatorItems = getSectionNavigatorItems(draft, selectedDefinition.id);
  const productWarning = selectedDefinition.id === "productTable" && (
    !selectedConfig.visible || !selectedConfig.showProductName || !selectedConfig.showQuantity
  )
    ? "Ẩn bảng sản phẩm, tên sản phẩm hoặc số lượng có thể làm phiếu khó đối chiếu."
    : "";
  const totalsWarning = selectedDefinition.id === "totals" && (
    !selectedConfig.visible || !selectedConfig.showGrandTotal
  )
    ? "Tổng thanh toán đang bị ẩn; hãy kiểm tra kỹ trước khi lưu."
    : "";

  function renderControls() {
    if (selectedDefinition.id === "shopHeader") {
      return (
        <div className="space-y-3">
          <ToggleList items={[{ key: "showLogo", label: "Hiển thị logo" }]} values={selectedConfig} onChange={(field, value) => onSectionFieldChange("shopHeader", field, value)} />
          <TextField label="Tên cửa hàng" value={selectedConfig.name} maxLength={PRINT_TEMPLATE_LIMITS.shopName} error={fieldErrors["sections.shopHeader.name"]} onChange={(value) => onSectionFieldChange("shopHeader", "name", value)} />
          <TextField label="Địa chỉ" value={selectedConfig.address} maxLength={PRINT_TEMPLATE_LIMITS.shopAddress} error={fieldErrors["sections.shopHeader.address"]} multiline onChange={(value) => onSectionFieldChange("shopHeader", "address", value)} />
          <TextField label="Điện thoại" value={selectedConfig.phone} maxLength={PRINT_TEMPLATE_LIMITS.shopPhone} error={fieldErrors["sections.shopHeader.phone"]} onChange={(value) => onSectionFieldChange("shopHeader", "phone", value)} />
          <TextField label="Email" value={selectedConfig.email} maxLength={PRINT_TEMPLATE_LIMITS.shopEmail} error={fieldErrors["sections.shopHeader.email"]} onChange={(value) => onSectionFieldChange("shopHeader", "email", value)} />
        </div>
      );
    }

    if (selectedDefinition.id === "receiptMetadata") {
      return (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-slate-500">Mã phiếu, ngày và giờ trong bản xem trước là dữ liệu minh họa chỉ đọc.</p>
          <ToggleList
            items={[
              { key: "showVoucherCode", label: "Mã phiếu" },
              { key: "showDate", label: "Ngày" },
              { key: "showTime", label: "Giờ" }
            ]}
            values={selectedConfig}
            onChange={(field, value) => onSectionFieldChange("receiptMetadata", field, value)}
          />
        </div>
      );
    }

    if (selectedDefinition.id === "documentTitle") {
      return <TextField label="Nội dung tiêu đề" value={selectedConfig.text} maxLength={PRINT_TEMPLATE_LIMITS.documentTitle} error={fieldErrors["sections.documentTitle.text"]} onChange={(value) => onSectionFieldChange("documentTitle", "text", value)} />;
    }

    if (selectedDefinition.id === "customerInformation") {
      return (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-slate-500">Thông tin khách hàng trong bản xem trước là dữ liệu minh họa chỉ đọc.</p>
          <ToggleList
            items={[
              { key: "showName", label: "Tên khách hàng" },
              { key: "showPhone", label: "Số điện thoại" },
              { key: "showAddress", label: "Địa chỉ" },
              { key: "showNote", label: "Ghi chú" }
            ]}
            values={selectedConfig}
            onChange={(field, value) => onSectionFieldChange("customerInformation", field, value)}
          />
        </div>
      );
    }

    if (selectedDefinition.id === "productTable") {
      return (
        <div className="space-y-3">
          <InspectorWarning>{productWarning}</InspectorWarning>
          <ToggleList
            items={[
              { key: "showIndex", label: "STT" },
              { key: "showProductName", label: "Tên sản phẩm" },
              { key: "showSaleNote", label: "Ghi chú bán hàng" },
              { key: "showQuantity", label: "Số lượng" },
              { key: "showUnitPrice", label: "Đơn giá" },
              { key: "showDiscount", label: "Chiết khấu" },
              { key: "showLineTotal", label: "Thành tiền" }
            ]}
            values={selectedConfig}
            onChange={(field, value) => onSectionFieldChange("productTable", field, value)}
          />
        </div>
      );
    }

    if (selectedDefinition.id === "totals") {
      return (
        <div className="space-y-3">
          <InspectorWarning>{totalsWarning}</InspectorWarning>
          <ToggleList
            items={[
              { key: "showGrossTotal", label: "Tổng tiền hàng" },
              { key: "showDiscountTotal", label: "Tổng chiết khấu" },
              { key: "showGrandTotal", label: "Tổng cộng" }
            ]}
            values={selectedConfig}
            onChange={(field, value) => onSectionFieldChange("totals", field, value)}
          />
        </div>
      );
    }

    if (selectedDefinition.id === "signatures") {
      return (
        <div className="space-y-3">
          <TextField label="Nhãn Người bán" value={selectedConfig.sellerLabel} maxLength={PRINT_TEMPLATE_LIMITS.signatureText} error={fieldErrors["sections.signatures.sellerLabel"]} onChange={(value) => onSectionFieldChange("signatures", "sellerLabel", value)} />
          <TextField label="Chú thích Người bán" value={selectedConfig.sellerHint} maxLength={PRINT_TEMPLATE_LIMITS.signatureText} error={fieldErrors["sections.signatures.sellerHint"]} onChange={(value) => onSectionFieldChange("signatures", "sellerHint", value)} />
          <TextField label="Nhãn Khách hàng" value={selectedConfig.customerLabel} maxLength={PRINT_TEMPLATE_LIMITS.signatureText} error={fieldErrors["sections.signatures.customerLabel"]} onChange={(value) => onSectionFieldChange("signatures", "customerLabel", value)} />
          <TextField label="Chú thích Khách hàng" value={selectedConfig.customerHint} maxLength={PRINT_TEMPLATE_LIMITS.signatureText} error={fieldErrors["sections.signatures.customerHint"]} onChange={(value) => onSectionFieldChange("signatures", "customerHint", value)} />
        </div>
      );
    }

    const notes = selectedConfig;
    return (
      <div className="space-y-3">
        <TextField label="Tiêu đề" value={notes.title} maxLength={PRINT_TEMPLATE_LIMITS.notesTitle} error={fieldErrors["sections.notes.title"]} onChange={(value) => onSectionFieldChange("notes", "title", value)} />
        <div className="space-y-2">
          {notes.items.map((item, index) => (
            <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <label className="block min-w-0 text-xs font-semibold text-slate-600">
                Dòng {index + 1}
                <textarea
                  value={item.value}
                  maxLength={PRINT_TEMPLATE_LIMITS.noticeText}
                  rows={2}
                  onChange={(event) => onNoticeChange(item.key, event.target.value)}
                  aria-invalid={Boolean(fieldErrors[`sections.notes.items[${index}]`])}
                  className={`mt-1 min-h-16 w-full min-w-0 resize-y rounded-lg border bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${fieldErrors[`sections.notes.items[${index}]`] ? "border-red-400" : "border-slate-300"}`}
                />
                <span className="mt-1 flex min-w-0 justify-between gap-2 font-normal">
                  <span className="break-words text-red-600">{fieldErrors[`sections.notes.items[${index}]`] || ""}</span>
                  <span className="shrink-0 text-slate-500">{item.value.length}/{PRINT_TEMPLATE_LIMITS.noticeText}</span>
                </span>
              </label>
              <div className="mt-2 flex flex-wrap gap-1" aria-label={`Sắp xếp dòng ${index + 1}`}>
                <button type="button" onClick={() => onNoticeMove(index, -1)} disabled={index === 0} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-40" aria-label={`Đưa dòng ${index + 1} lên`}>↑</button>
                <button type="button" onClick={() => onNoticeMove(index, 1)} disabled={index === notes.items.length - 1} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-40" aria-label={`Đưa dòng ${index + 1} xuống`}>↓</button>
                <button type="button" onClick={() => onNoticeRemove(item.key)} disabled={notes.items.length <= 1} className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 disabled:opacity-40">Xóa</button>
              </div>
            </div>
          ))}
        </div>
        {fieldErrors["sections.notes.items"] && <p className="text-xs text-red-600">{fieldErrors["sections.notes.items"]}</p>}
        <button
          type="button"
          onClick={onNoticeAdd}
          disabled={notes.items.length >= PRINT_TEMPLATE_LIMITS.noticeCount}
          className="min-h-10 rounded-lg border border-brand-300 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        >
          Thêm dòng lưu ý
        </button>
      </div>
    );
  }

  return (
    <aside className="print-template-inspector min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Bảng điều khiển Mẫu tùy chỉnh">
      <section className="min-w-0 border-b border-slate-200 pb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Các phần</h2>
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-1.5">
          {navigatorItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-pressed={item.selected}
              className={`min-h-10 min-w-0 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                item.selected
                  ? "border-brand-300 bg-brand-50 text-brand-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="block min-w-0 break-words">{item.label}</span>
              <span className={`mt-0.5 block text-[10px] ${item.visible ? "text-emerald-700" : "text-slate-400"}`}>
                {item.visible ? "Đang hiển thị" : "Đang ẩn"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Khổ giấy</p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">A4 · Dọc</p>
          </div>
          <label className="shrink-0 text-xs font-semibold text-slate-600">
            Lề giấy
            <input
              type="number"
              min={PRINT_TEMPLATE_LIMITS.marginMin}
              max={PRINT_TEMPLATE_LIMITS.marginMax}
              step="0.5"
              value={draft.paper.marginMm}
              onChange={(event) => onPaperChange("marginMm", event.target.value)}
              aria-invalid={Boolean(fieldErrors["paper.marginMm"])}
              className={`ml-2 h-10 w-20 rounded-lg border bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${fieldErrors["paper.marginMm"] ? "border-red-400" : "border-slate-300"}`}
            />
            <span className="ml-1 font-medium text-slate-500">mm</span>
          </label>
        </div>
        {fieldErrors["paper.marginMm"] && <p className="mt-1 text-xs text-red-600">{fieldErrors["paper.marginMm"]}</p>}
      </section>

      <section className="mt-4 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Đang chỉnh sửa</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="min-w-0 break-words text-lg font-bold text-slate-900">{selectedDefinition.label}</h2>
          <button type="button" onClick={() => onResetSectionLayout(selectedDefinition.id)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            Khôi phục bố cục phần này
          </button>
        </div>
        <div className="mt-3">
          <VisibilityToggle checked={Boolean(selectedConfig.visible)} onChange={(visible) => onVisibilityChange(selectedDefinition.id, visible)} />
        </div>
        <fieldset disabled={!selectedConfig.visible} className="mt-4 min-w-0 space-y-3 disabled:opacity-60">
          {renderControls()}
          <SectionLayoutControls
            sectionName={selectedDefinition.id}
            values={selectedConfig}
            fieldErrors={fieldErrors}
            onChange={onSectionFieldChange}
          />
        </fieldset>
      </section>
    </aside>
  );
}
