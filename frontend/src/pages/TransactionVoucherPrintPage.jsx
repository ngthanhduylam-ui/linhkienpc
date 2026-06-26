import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ptcLogoUrl from "../assets/ptc-logo.png";
import { getStockVoucherRequest } from "../services/inventoryOperations.service";
import "./TransactionVoucherPrintPage.css";

const SHOP_INFO = {
  name: "Vi Tính Phước Tài",
  address: "98/14 đường số 5, P.17, Q. Gò Vấp",
  phone: "0933712571",
  email: "vitinhphuoctai@gmail.com"
};

const FOOTER_NOTICE = [
  "Quý khách vui lòng kiểm tra hàng hóa và thông tin trên phiếu trước khi ký nhận.",
  "Hàng đã mua không trả lại, trừ trường hợp được cửa hàng chấp thuận.",
  "Sản phẩm bảo hành theo điều kiện của nhà sản xuất hoặc nhà phân phối.",
  "Không bảo hành các trường hợp rách tem, cháy nổ, vào nước, móp méo, lỗi vật lý hoặc sử dụng sai quy định.",
  "Sản phẩm bán ra có thể kèm tem và số serial để phục vụ đối chiếu."
];

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
    <div className="voucher-print-customer-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StateMessage({ children, tone = "default" }) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-white text-slate-700";

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-slate-900">
      <section className={`mx-auto max-w-3xl rounded-md border p-6 text-sm shadow-sm ${toneClass}`}>
        {children}
      </section>
    </main>
  );
}

export function TransactionVoucherPrintPage() {
  const { voucherId } = useParams();
  const [voucher, setVoucher] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadVoucher() {
      setIsLoading(true);
      setError("");

      try {
        const detail = await getStockVoucherRequest(voucherId);
        if (!active) return;
        setVoucher(detail);
      } catch (err) {
        if (!active) return;
        setVoucher(null);
        setError(err?.status === 404 ? "Không tìm thấy phiếu." : err?.message || "Không thể tải phiếu.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadVoucher();
    return () => {
      active = false;
    };
  }, [voucherId]);

  if (isLoading) {
    return <StateMessage>Đang tải bản xem trước phiếu...</StateMessage>;
  }

  if (error) {
    return <StateMessage tone="error">{error}</StateMessage>;
  }

  if (!voucher) {
    return <StateMessage tone="error">Không tìm thấy phiếu.</StateMessage>;
  }

  if (voucher.voucher_type !== "OUT") {
    return (
      <main className="min-h-screen bg-white px-6 py-8 text-slate-900">
        <section className="mx-auto max-w-3xl rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <Link to={`/admin/transaction-history/${voucherId}`} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
            ← Quay lại chi tiết phiếu
          </Link>
          <p className="mt-5 text-sm text-slate-700">Mẫu in phiếu nhập chưa được hỗ trợ.</p>
        </section>
      </main>
    );
  }

  const partner = voucher.partner || {};
  const items = voucher.items || [];
  const customerName = formatText(partner.name) || "Khách lẻ";
  const customerLines = [
    { label: "Tên khách hàng", value: customerName },
    { label: "Số điện thoại", value: formatText(partner.phone) },
    { label: "Địa chỉ", value: formatText(partner.address) },
    { label: "Ghi chú", value: formatText(voucher.note) }
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

      <article className="voucher-print-page mx-auto max-w-[210mm] bg-white p-[12mm] text-[12px] shadow-sm ring-1 ring-slate-200 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="voucher-print-header">
          <div className="voucher-print-logo-box">
            <img src={ptcLogoUrl} alt="Phước Tài Computer" />
          </div>

          <div className="voucher-print-shop">
            <p className="voucher-print-shop-name">{SHOP_INFO.name}</p>
            <p>{SHOP_INFO.address}</p>
            <p>{SHOP_INFO.phone}</p>
            <p>{SHOP_INFO.email}</p>
          </div>

          <div className="voucher-print-meta">
            <InfoLine label="Số phiếu" value={formatText(voucher.voucher_code || `#${voucher.id}`)} />
            <InfoLine label="Ngày" value={formatDate(voucher.occurred_at)} />
            <InfoLine label="Giờ" value={formatTime(voucher.occurred_at)} />
          </div>
        </header>

        <h1 className="voucher-print-title">PHIẾU BÁN &amp; GIAO HÀNG</h1>

        <section className="voucher-print-customer">
          {customerLines.map((line) => (
            <CustomerInfoLine key={line.label} label={line.label} value={line.value} />
          ))}
        </section>

        <section className="voucher-print-table-wrap">
          <table className="voucher-print-table">
            <thead>
              <tr>
                <th className="voucher-print-index-col">STT</th>
                <th>Tên sản phẩm / Serial / Ghi chú</th>
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
        </section>

        <section className="voucher-print-summary">
          <div className="voucher-print-summary-grid">
            <span>Tổng tiền hàng</span>
            <strong>{formatPrintMoney(grossGoodsTotal)}</strong>
            <span>Tổng chiết khấu</span>
            <strong>{totalDiscount > 0 ? formatPrintMoney(totalDiscount) : ""}</strong>
            <span>Tổng cộng</span>
            <strong>{formatPrintMoney(voucher.total_amount)}</strong>
          </div>
        </section>

        <section className="voucher-print-signatures">
          <div>
            <p>Người bán</p>
            <span>(Ký và ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Khách hàng</p>
            <span>(Kiểm tra và ký nhận)</span>
          </div>
        </section>

        <section className="voucher-print-notice">
          <p>Lưu ý:</p>
          <ul>
            {FOOTER_NOTICE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
