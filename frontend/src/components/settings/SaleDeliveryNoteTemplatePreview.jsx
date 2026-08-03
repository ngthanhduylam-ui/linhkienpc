import { useEffect, useRef, useState } from "react";
import ptcLogoUrl from "../../assets/ptc-logo.png";
import { getVisibleProductColumns } from "../../utils/printTemplateEditor";
import { SALE_DELIVERY_NOTE_PREVIEW_SAMPLE } from "./saleDeliveryNotePreviewSample";
import "./SaleDeliveryNoteTemplatePreview.css";

const LOGICAL_PAGE_WIDTH = 794;
const LOGICAL_PAGE_HEIGHT = 1123;

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} ₫`;
}

function SelectableSection({ sectionId, label, selectedSection, onSelectSection, className = "", children }) {
  const selected = sectionId === selectedSection;

  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectSection(sectionId);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Chỉnh sửa ${label}`}
      aria-pressed={selected}
      onClick={() => onSelectSection(sectionId)}
      onKeyDown={handleKeyDown}
      className={`template-preview-section ${selected ? "is-selected" : ""} ${className}`}
    >
      {selected && <span className="template-preview-section-label" aria-hidden="true">{label}</span>}
      {children}
    </div>
  );
}

function PreviewInfoLine({ label, value }) {
  return (
    <div className="template-preview-info-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PreviewCustomerLine({ label, value, wide = false }) {
  return (
    <div className={`template-preview-customer-line ${wide ? "is-wide" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function SaleDeliveryNoteTemplatePreview({
  config,
  sampleData = SALE_DELIVERY_NOTE_PREVIEW_SAMPLE,
  selectedSection,
  onSelectSection
}) {
  const stageRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const updateScale = (width) => {
      const nextScale = Math.min(1, Math.max(0.1, width / LOGICAL_PAGE_WIDTH));
      setScale((current) => Math.abs(current - nextScale) < 0.001 ? current : nextScale);
    };

    updateScale(stage.clientWidth);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width) updateScale(width);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const sections = config.sections;
  const shop = sections.shopHeader;
  const metadata = sections.receiptMetadata;
  const customer = sections.customerInformation;
  const table = sections.productTable;
  const totals = sections.totals;
  const signatures = sections.signatures;
  const notes = sections.notes;
  const columns = getVisibleProductColumns(table);
  const showHeader = shop.visible || metadata.visible;
  const headerClass = shop.visible && metadata.visible
    ? "has-shop-and-meta"
    : shop.visible
      ? "has-shop-only"
      : "has-meta-only";

  return (
    <div className="template-preview-workspace min-w-0">
      <div className="template-preview-workspace-toolbar">
        <span>Dữ liệu minh họa</span>
        <span>A4 · Dọc · Lề {config.paper.marginMm || 0} mm</span>
      </div>
      <div
        ref={stageRef}
        className="template-preview-stage"
        style={{ height: `${LOGICAL_PAGE_HEIGHT * scale}px` }}
      >
        <article
          className="template-preview-page"
          style={{
            width: `${LOGICAL_PAGE_WIDTH}px`,
            height: `${LOGICAL_PAGE_HEIGHT}px`,
            transform: `scale(${scale})`,
            "--template-preview-margin": `${Number(config.paper.marginMm) || 0}mm`
          }}
          aria-label="Bản xem trước Phiếu bán và giao hàng với dữ liệu minh họa"
        >
          {showHeader && (
            <header className={`template-preview-header ${headerClass}`}>
              {shop.visible && (
                <SelectableSection
                  sectionId="shopHeader"
                  label="Thông tin cửa hàng"
                  selectedSection={selectedSection}
                  onSelectSection={onSelectSection}
                  className={`template-preview-shop-section ${shop.showLogo ? "" : "without-logo"}`}
                >
                  {shop.showLogo && (
                    <div className="template-preview-logo-box">
                      <img src={ptcLogoUrl} alt="Logo Phước Tài Computer" />
                    </div>
                  )}
                  <div className="template-preview-shop-copy">
                    <p className="template-preview-shop-name">{shop.name}</p>
                    <p>{shop.address}</p>
                    <p>{shop.phone}</p>
                    <p>{shop.email}</p>
                  </div>
                </SelectableSection>
              )}

              {metadata.visible && (
                <SelectableSection
                  sectionId="receiptMetadata"
                  label="Thông tin phiếu"
                  selectedSection={selectedSection}
                  onSelectSection={onSelectSection}
                  className="template-preview-meta"
                >
                  {metadata.showVoucherCode && <PreviewInfoLine label="Số phiếu" value={sampleData.voucherCode} />}
                  {metadata.showDate && <PreviewInfoLine label="Ngày" value={sampleData.date} />}
                  {metadata.showTime && <PreviewInfoLine label="Giờ" value={sampleData.time} />}
                </SelectableSection>
              )}
            </header>
          )}

          {sections.documentTitle.visible && (
            <SelectableSection
              sectionId="documentTitle"
              label="Tiêu đề phiếu"
              selectedSection={selectedSection}
              onSelectSection={onSelectSection}
              className="template-preview-title"
            >
              <h1>{sections.documentTitle.text}</h1>
            </SelectableSection>
          )}

          {customer.visible && (
            <SelectableSection
              sectionId="customerInformation"
              label="Thông tin khách hàng"
              selectedSection={selectedSection}
              onSelectSection={onSelectSection}
              className="template-preview-customer"
            >
              {customer.showName && <PreviewCustomerLine label="Tên khách hàng" value={sampleData.customer.name} />}
              {customer.showPhone && <PreviewCustomerLine label="Số điện thoại" value={sampleData.customer.phone} />}
              {customer.showAddress && <PreviewCustomerLine label="Địa chỉ" value={sampleData.customer.address} wide />}
              {customer.showNote && <PreviewCustomerLine label="Ghi chú" value={sampleData.customer.note} wide />}
            </SelectableSection>
          )}

          {table.visible && (
            <SelectableSection
              sectionId="productTable"
              label="Bảng sản phẩm"
              selectedSection={selectedSection}
              onSelectSection={onSelectSection}
              className="template-preview-table-wrap"
            >
              {columns.length > 0 ? (
                <table className="template-preview-table">
                  <thead>
                    <tr>
                      {columns.map((column) => <th key={column.id} className={`is-${column.id}`}>{column.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleData.items.map((item, index) => (
                      <tr key={`${item.name}-${index}`}>
                        {columns.map((column) => {
                          if (column.id === "index") return <td key={column.id} className="is-index">{index + 1}</td>;
                          if (column.id === "productName") {
                            return (
                              <td key={column.id} className="is-productName">
                                <span className="template-preview-product-name">{item.name}</span>
                                {table.showSaleNote && <span className="template-preview-sale-note">{item.saleNote}</span>}
                              </td>
                            );
                          }
                          if (column.id === "quantity") return <td key={column.id} className="is-quantity">{item.quantity}</td>;
                          if (column.id === "unitPrice") return <td key={column.id} className="is-money">{formatMoney(item.unitPrice)}</td>;
                          if (column.id === "discount") return <td key={column.id} className="is-money">{item.discount ? formatMoney(item.discount) : ""}</td>;
                          return <td key={column.id} className="is-money">{formatMoney(item.lineTotal)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="template-preview-empty-table">Không có cột nào đang hiển thị.</div>
              )}
            </SelectableSection>
          )}

          {totals.visible && (
            <SelectableSection
              sectionId="totals"
              label="Tổng tiền"
              selectedSection={selectedSection}
              onSelectSection={onSelectSection}
              className="template-preview-summary-row"
            >
              <div className="template-preview-summary-box">
                <div className="template-preview-summary-grid">
                  {totals.showGrossTotal && <><span>Tổng tiền hàng</span><strong>{formatMoney(sampleData.grossTotal)}</strong></>}
                  {totals.showDiscountTotal && <><span>Tổng chiết khấu</span><strong>{formatMoney(sampleData.discountTotal)}</strong></>}
                  {totals.showGrandTotal && <><span className="is-grand">Tổng cộng</span><strong className="is-grand">{formatMoney(sampleData.grandTotal)}</strong></>}
                </div>
              </div>
            </SelectableSection>
          )}

          {signatures.visible && (
            <SelectableSection
              sectionId="signatures"
              label="Chữ ký"
              selectedSection={selectedSection}
              onSelectSection={onSelectSection}
              className="template-preview-signatures"
            >
              <div><p>{signatures.sellerLabel}</p><span>{signatures.sellerHint}</span></div>
              <div><p>{signatures.customerLabel}</p><span>{signatures.customerHint}</span></div>
            </SelectableSection>
          )}

          {notes.visible && (
            <SelectableSection
              sectionId="notes"
              label="Lưu ý"
              selectedSection={selectedSection}
              onSelectSection={onSelectSection}
              className="template-preview-notice"
            >
              <p>{notes.title}</p>
              <ul>{notes.items.map((item) => <li key={item.key}>{item.value}</li>)}</ul>
            </SelectableSection>
          )}
        </article>
      </div>
    </div>
  );
}
