import ptcLogoUrl from "../../../assets/ptc-logo.png";
import { PRODUCT_TABLE_COLUMNS } from "../../../utils/printTemplateBuilderLab";
import { SALE_DELIVERY_NOTE_PREVIEW_SAMPLE } from "../saleDeliveryNotePreviewSample";

const TYPE_LABELS = {
  text: "Văn bản", title: "Tiêu đề", logo: "Logo", shopInfo: "Thông tin cửa hàng",
  voucherMetadata: "Thông tin phiếu", customerInfo: "Thông tin khách hàng",
  productTable: "Bảng sản phẩm", totals: "Tổng tiền", signatures: "Chữ ký",
  notes: "Lưu ý", divider: "Đường kẻ"
};

const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} ₫`;
}

function TextContent({ block }) {
  return (
    <div
      className="print-builder-text-content"
      style={{
        fontSize: `${block.props.fontSizePt}pt`,
        fontWeight: block.props.bold ? 700 : 400,
        fontStyle: block.props.italic ? "italic" : "normal",
        textDecoration: block.props.underline ? "underline" : "none",
        textAlign: block.props.textAlign,
        lineHeight: block.props.lineHeight
      }}
    >
      {block.props.text}
    </div>
  );
}

function DynamicContent({ block }) {
  const props = block.props;
  const textStyle = { fontSize: `${props.fontSizePt || 9}pt`, textAlign: props.textAlign || "left" };
  if (block.type === "logo") return <img src={ptcLogoUrl} alt="Logo VI TÍNH PHƯỚC TÀI" className="h-full w-full object-contain" draggable={false} />;
  if (block.type === "shopInfo") return (
    <div className="print-builder-dynamic-copy" style={textStyle}>
      {props.showName && <strong>{props.name || "VI TÍNH PHƯỚC TÀI"}</strong>}
      {props.showAddress && <span>{props.address || "98/14 đường số 5, P.17, Q. Gò Vấp"}</span>}
      {props.showPhone && <span>{props.phone || "0933712571"}</span>}
      {props.showEmail && <span>{props.email || "vitinhphuoctai@gmail.com"}</span>}
    </div>
  );
  if (block.type === "voucherMetadata") return (
    <div className="print-builder-key-value" style={textStyle}>
      {props.showVoucherCode && <><span>Số phiếu</span><b>{SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.voucherCode}</b></>}
      {props.showDate && <><span>Ngày</span><b>{SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.date}</b></>}
      {props.showTime && <><span>Giờ</span><b>{SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.time}</b></>}
    </div>
  );
  if (block.type === "customerInfo") return (
    <div className="print-builder-customer" style={textStyle}>
      {props.showName && <p><b>Tên khách hàng:</b> {SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.customer.name}</p>}
      {props.showPhone && <p><b>Số điện thoại:</b> {SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.customer.phone}</p>}
      {props.showAddress && <p><b>Địa chỉ:</b> {SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.customer.address}</p>}
      {props.showNote && <p><b>Ghi chú:</b> {SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.customer.note}</p>}
    </div>
  );
  if (block.type === "productTable") {
    const columns = PRODUCT_TABLE_COLUMNS.filter((column) => props.visibleColumns.includes(column.id));
    const totalWeight = columns.reduce((sum, column) => sum + Number(props.columnWidthWeights[column.id] || 1), 0);
    return (
      <div className="h-full overflow-hidden">
        <table className="print-builder-product-table" style={{ fontSize: `${props.fontSizePt}pt`, "--builder-cell-padding": `${props.cellPaddingMm}mm` }}>
          <colgroup>{columns.map((column) => <col key={column.id} style={{ width: `${Number(props.columnWidthWeights[column.id] || 1) / totalWeight * 100}%` }} />)}</colgroup>
          <thead style={{ fontSize: `${props.headerFontSizePt}pt` }}><tr>{columns.map((column) => <th key={column.id}>{column.label}</th>)}</tr></thead>
          <tbody>{SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>{columns.map((column) => {
              if (column.id === "index") return <td key={column.id}>{index + 1}</td>;
              if (column.id === "productName") return <td key={column.id}><b>{item.name}</b>{props.showSaleNote && <small>{item.saleNote}</small>}</td>;
              if (column.id === "quantity") return <td key={column.id}>{item.quantity}</td>;
              if (column.id === "unitPrice") return <td key={column.id}>{formatMoney(item.unitPrice)}</td>;
              if (column.id === "discount") return <td key={column.id}>{item.discount ? formatMoney(item.discount) : ""}</td>;
              return <td key={column.id}>{formatMoney(item.lineTotal)}</td>;
            })}</tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  if (block.type === "totals") return (
    <div className="print-builder-totals" style={textStyle}>
      {props.showGrossTotal && <><span>Tổng tiền hàng</span><b>{formatMoney(SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.grossTotal)}</b></>}
      {props.showDiscountTotal && <><span>Tổng chiết khấu</span><b>{formatMoney(SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.discountTotal)}</b></>}
      {props.showGrandTotal && <><strong>Tổng cộng</strong><strong>{formatMoney(SALE_DELIVERY_NOTE_PREVIEW_SAMPLE.grandTotal)}</strong></>}
    </div>
  );
  if (block.type === "signatures") return (
    <div className="print-builder-signatures" style={textStyle}>
      {props.showSeller && <div><b>Người bán</b><span>(Ký và ghi rõ họ tên)</span></div>}
      {props.showCustomer && <div><b>Khách hàng</b><span>(Kiểm tra và ký nhận)</span></div>}
    </div>
  );
  if (block.type === "divider") return <div className="print-builder-divider" style={{ borderTopWidth: `${props.thicknessPt}pt` }} />;
  return null;
}

export function PrintBuilderBlock({
  block,
  selected,
  colliding,
  editingValue,
  onSelect,
  onPointerDown,
  onResizePointerDown,
  onStartTextEdit,
  onEditingValueChange,
  onFinishTextEdit
}) {
  const isText = ["text", "title", "notes"].includes(block.type);
  return (
    <div
      className={`print-builder-block ${selected ? "is-selected" : ""} ${colliding ? "is-colliding" : ""} ${block.locked ? "is-locked" : ""}`}
      style={{ left: `${block.xMm / 210 * 100}%`, top: `${block.yMm / 297 * 100}%`, width: `${block.widthMm / 210 * 100}%`, height: `${block.heightMm / 297 * 100}%`, zIndex: block.zIndex }}
      onClick={(event) => { event.stopPropagation(); onSelect(block.id); }}
      onPointerDown={(event) => onPointerDown(event, block)}
      onDoubleClick={(event) => { if (isText && !block.locked) { event.stopPropagation(); onStartTextEdit(block); } }}
      role="button"
      tabIndex={selected ? 0 : -1}
      aria-label={`${TYPE_LABELS[block.type]}${block.locked ? ", đã khóa" : ""}`}
    >
      <span className="print-builder-block-label">{TYPE_LABELS[block.type]}{block.locked ? " · Khóa" : ""}</span>
      <div className="print-builder-block-content">
        {editingValue !== null ? (
          <textarea
            rows={2}
            autoFocus
            value={editingValue}
            onChange={(event) => onEditingValueChange(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onBlur={(event) => { if (event.currentTarget.dataset.cancelled !== "true") onFinishTextEdit(true); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); event.currentTarget.dataset.cancelled = "true"; onFinishTextEdit(false); }
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); onFinishTextEdit(true); }
            }}
            className="print-builder-direct-editor"
            aria-label="Chỉnh sửa văn bản trực tiếp"
          />
        ) : isText ? <TextContent block={block} /> : <DynamicContent block={block} />}
      </div>
      {selected && !block.locked && editingValue === null && RESIZE_HANDLES.map((handle) => (
        <span
          key={handle}
          className={`print-builder-resize-handle is-${handle}`}
          onPointerDown={(event) => onResizePointerDown(event, block, handle)}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
