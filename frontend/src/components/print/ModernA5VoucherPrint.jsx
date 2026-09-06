import { Link } from "react-router-dom";
import ptcLogoUrl from "../../assets/ptc-logo.png";
import {
  getModernA5VoucherRows,
  MODERN_A5_NOTICE_LINES,
  MODERN_A5_SHOP_INFO
} from "../../utils/voucherPrintPreview";
import "./ModernA5VoucherPrint.css";

const PAYMENT_QR_URL = "/print-assets/hkd-payment-qr.png";
const WEBSITE_QR_URL = "/print-assets/website-qr.png";
const WEBSITE_QR_PAYLOAD = "https://vitinhphuoctai.com";

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatTime(value) {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatText(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  return String(value).trim();
}

function getSnapshotProductName(item) {
  return formatText(item?.product_name || item?.product?.name) || "-";
}

function getSaleNote(item) {
  return formatText(item?.sale_note);
}

function getNumericMoney(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatPrintMoney(value) {
  const numberValue = getNumericMoney(value);
  if (numberValue === null) return "";
  return `${numberValue.toLocaleString("vi-VN")} ₫`;
}

function getNumericQuantity(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatPrintQuantity(value) {
  const numberValue = getNumericQuantity(value);
  if (numberValue === null) return "";
  return numberValue.toLocaleString("vi-VN");
}

function getPrintableUnitPrice(item) {
  if (item?.reference_unit_price !== null && item?.reference_unit_price !== undefined) {
    return item.reference_unit_price;
  }
  if (item?.unit_price !== null && item?.unit_price !== undefined) {
    return item.unit_price;
  }
  return null;
}

function getPrintableDiscount(item) {
  const discountAmount = getNumericMoney(item?.discount_amount);
  return discountAmount !== null && discountAmount > 0 ? discountAmount : null;
}

function calculateGrossGoodsTotal(items) {
  let total = 0;

  for (const item of items) {
    const unitPrice = getNumericMoney(getPrintableUnitPrice(item));
    const quantity = getNumericQuantity(item?.quantity);
    if (unitPrice === null || quantity === null) return null;
    total += unitPrice * quantity;
  }

  return total;
}

function calculateTotalDiscount(items) {
  return items.reduce((sum, item) => {
    const discountAmount = getPrintableDiscount(item);
    const quantity = getNumericQuantity(item?.quantity);
    if (discountAmount === null || quantity === null) return sum;
    return sum + discountAmount * quantity;
  }, 0);
}

function HeaderIcon({ type }) {
  const paths = {
    tax: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" /></>,
    address: <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    phone: <path d="M7 3 4.8 5.2c-.7.7-.8 1.8-.3 2.7 2.7 5 6.7 9 11.7 11.7.9.5 2 .4 2.7-.3L21 17l-4-3-2 2c-2.8-1.5-5.1-3.8-6.6-6.6l2-2L7 3Z" />,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {paths[type]}
    </svg>
  );
}

function HeaderLine({ icon, label, value }) {
  return (
    <p className="modern-a5-header-line">
      <HeaderIcon type={icon} />
      <span><strong>{label}:</strong> {value}</span>
    </p>
  );
}

function InfoLine({ label, value }) {
  if (!value) return null;
  return (
    <div className="voucher-print-info-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CustomerInfoLine({ label, value }) {
  return (
    <div className="voucher-print-customer-line modern-a5-customer-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ModernA5VoucherPrint({ voucher, voucherId }) {
  const partner = voucher?.partner || {};
  const items = getModernA5VoucherRows(voucher);
  const customerLines = [
    { label: "Khách hàng", value: formatText(partner.name) || "Khách lẻ" },
    { label: "Số điện thoại", value: formatText(partner.phone) },
    { label: "Địa chỉ", value: formatText(partner.address) },
    { label: "Ghi chú", value: formatText(voucher?.note) }
  ];
  const grossGoodsTotal = calculateGrossGoodsTotal(items);
  const totalDiscount = calculateTotalDiscount(items);

  return (
    <main className="voucher-print-screen min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-8">
      <div className="voucher-print-controls mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={`/admin/transaction-history/${voucherId}`} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
          ← Quay lại chi tiết phiếu
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          In phiếu
        </button>
      </div>

      <article className="voucher-print-page modern-a5-page mx-auto max-w-[210mm] bg-white p-[12mm] text-[12px] shadow-sm ring-1 ring-slate-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="voucher-print-header modern-a5-header">
          <div className="voucher-print-logo-box">
            <img src={ptcLogoUrl} alt="Phước Tài Computer" />
          </div>

          <div className="voucher-print-shop modern-a5-shop">
            <p className="modern-a5-business-type">{MODERN_A5_SHOP_INFO.businessType}</p>
            <p className="voucher-print-shop-name modern-a5-shop-name">{MODERN_A5_SHOP_INFO.name}</p>
            <div className="modern-a5-header-lines">
              <HeaderLine icon="tax" label="MST" value={MODERN_A5_SHOP_INFO.taxId} />
              <HeaderLine icon="address" label="Địa chỉ" value={MODERN_A5_SHOP_INFO.address} />
              <HeaderLine icon="phone" label="Số điện thoại" value={MODERN_A5_SHOP_INFO.phone} />
              <HeaderLine icon="email" label="Gmail" value={MODERN_A5_SHOP_INFO.email} />
            </div>
          </div>

          <div className="modern-a5-website-qr">
            <img
              src={WEBSITE_QR_URL}
              alt="QR tra cứu sản phẩm tại vitinhphuoctai.com"
              data-qr-payload={WEBSITE_QR_PAYLOAD}
            />
          </div>

          <div className="voucher-print-meta">
            <InfoLine label="Số phiếu" value={formatText(voucher?.voucher_code || `#${voucher?.id}`)} />
            <InfoLine label="Ngày" value={formatDate(voucher?.occurred_at)} />
            <InfoLine label="Giờ" value={formatTime(voucher?.occurred_at)} />
          </div>
        </header>

        <h1 className="voucher-print-title modern-a5-title">PHIẾU BÁN &amp; GIAO HÀNG</h1>

        <section className="voucher-print-customer modern-a5-customer">
          {customerLines.map((line) => (
            <CustomerInfoLine key={line.label} label={line.label} value={line.value} />
          ))}
        </section>

        <section className="voucher-print-table-wrap">
          <table className="voucher-print-table">
            <thead>
              <tr>
                <th className="voucher-print-index-col">STT</th>
                <th>Tên sản phẩm</th>
                <th className="voucher-print-qty-col">SL</th>
                <th className="voucher-print-money-col">Đơn giá</th>
                <th className="voucher-print-money-col">Chiết khấu</th>
                <th className="voucher-print-money-col">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const saleNote = getSaleNote(item);

                return (
                  <tr key={item.stock_voucher_item_id || item.transaction_id || index}>
                    <td className="voucher-print-index-col">{index + 1}</td>
                    <td className="voucher-print-product-cell">
                      <span className="voucher-print-product-name">{getSnapshotProductName(item)}</span>
                      {saleNote && <span className="voucher-print-sale-note">{saleNote}</span>}
                    </td>
                    <td className="voucher-print-qty-col">{formatPrintQuantity(item.quantity)}</td>
                    <td className="voucher-print-money-col">{formatPrintMoney(getPrintableUnitPrice(item))}</td>
                    <td className="voucher-print-money-col">{formatPrintMoney(getPrintableDiscount(item))}</td>
                    <td className="voucher-print-money-col">{formatPrintMoney(item.line_total)}</td>
                  </tr>
                );
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="voucher-print-empty-row">
                    Phiếu chưa có dòng sản phẩm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="voucher-print-summary-row">
            <div className="voucher-print-summary-box">
              <div className="voucher-print-summary-grid">
                <span>Tổng tiền hàng</span>
                <strong>{formatPrintMoney(grossGoodsTotal)}</strong>
                <span>Tổng chiết khấu</span>
                <strong>{totalDiscount > 0 ? formatPrintMoney(totalDiscount) : ""}</strong>
                <span>Tổng cộng</span>
                <strong>{formatPrintMoney(voucher?.total_amount)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="voucher-print-signatures">
          <div>
            <div className="modern-a5-signature-content">
              <p>Người bán</p>
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
          </div>
          <div>
            <div className="modern-a5-signature-content">
              <p>Khách hàng</p>
              <span>(Ký, ghi rõ họ tên)</span>
            </div>
          </div>
        </section>

        <footer className="modern-a5-footer">
          <div className="modern-a5-payment-card">
            <img src={PAYMENT_QR_URL} alt="QR thanh toán Hộ kinh doanh VI TÍNH PHƯỚC TÀI" />
          </div>
          <section className="voucher-print-notice modern-a5-notice">
            <p>Lưu ý:</p>
            <ul>
              {MODERN_A5_NOTICE_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </footer>
      </article>
    </main>
  );
}
