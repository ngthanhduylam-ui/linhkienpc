import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getStockVoucherRequest } from "../services/inventoryOperations.service";
import { formatWarrantyNote } from "../utils/warrantyNote";
import "./TransactionVoucherPrintPage.css";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(value) {
  if (value === null || value === undefined) return "Chưa xác định";

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "Chưa xác định";

  return `${numberValue.toLocaleString("vi-VN")} ₫`;
}

function formatText(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "-";
  return String(value);
}

function formatNote(note) {
  if (note === null || note === undefined || String(note).trim() === "") return "-";
  return formatWarrantyNote(note);
}

function getSaleNote(item) {
  if (item?.sale_note === null || item?.sale_note === undefined) return "";
  return String(item.sale_note).trim();
}

function getSnapshotSku(item) {
  return item?.sku || item?.product?.sku || "-";
}

function getSnapshotProductName(item) {
  return item?.product_name || item?.product?.name || "-";
}

function InfoLine({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="min-w-0 text-slate-900">{value}</span>
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

  return (
    <main className="voucher-print-screen min-h-screen bg-white px-4 py-6 text-slate-950 sm:px-8">
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

      <article className="voucher-print-page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-8 text-sm shadow-sm ring-1 ring-slate-200 print:min-h-0 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="voucher-print-header border-b-2 border-slate-900 pb-5 text-center">
          <p className="text-lg font-bold tracking-wide">VI TÍNH PHƯỚC TÀI</p>
          <h1 className="mt-4 text-2xl font-bold tracking-wide">PHIẾU BÁN HÀNG KIÊM BẢO HÀNH</h1>
        </header>

        <section className="voucher-print-info mt-6 grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <InfoLine label="Mã phiếu" value={formatText(voucher.voucher_code || `#${voucher.id}`)} />
            <InfoLine label="Ngày bán" value={formatDateTime(voucher.occurred_at)} />
            <InfoLine label="Người bán" value={formatText(voucher.admin?.username)} />
          </div>
          <div className="space-y-2">
            <InfoLine label="Khách hàng" value={formatText(partner.name)} />
            <InfoLine label="Số điện thoại" value={formatText(partner.phone)} />
            <InfoLine label="Địa chỉ" value={formatText(partner.address)} />
          </div>
        </section>

        <section className="voucher-print-table-wrap mt-7 overflow-visible border border-slate-900">
          <table className="voucher-print-table w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-10 border border-slate-900 px-2 py-2 text-center">STT</th>
                <th className="w-28 border border-slate-900 px-2 py-2">SKU</th>
                <th className="border border-slate-900 px-2 py-2">Tên sản phẩm</th>
                <th className="w-36 border border-slate-900 px-2 py-2">Bảo hành/Ghi chú</th>
                <th className="w-16 border border-slate-900 px-2 py-2 text-right">Số lượng</th>
                <th className="w-32 border border-slate-900 px-2 py-2 text-right">Thông tin giá</th>
                <th className="w-28 border border-slate-900 px-2 py-2 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const saleNote = getSaleNote(item);
                const hasReferencePrice = item.reference_unit_price !== null && item.reference_unit_price !== undefined;
                const discountAmount = Number(item.discount_amount || 0);

                return (
                  <tr key={item.stock_voucher_item_id || item.transaction_id || index} className="voucher-print-row align-top">
                    <td className="border border-slate-900 px-2 py-2 text-center">{index + 1}</td>
                    <td className="break-words border border-slate-900 px-2 py-2">{getSnapshotSku(item)}</td>
                    <td className="border border-slate-900 px-2 py-2 font-semibold">
                      <span className="voucher-print-product-name">{getSnapshotProductName(item)}</span>
                      {saleNote && (
                        <span className="voucher-print-sale-note mt-1 block text-[11px] font-normal leading-4 text-slate-700">
                          <span className="font-semibold">Serial / Ghi chú:</span> {saleNote}
                        </span>
                      )}
                    </td>
                    <td className="border border-slate-900 px-2 py-2">
                      {formatNote(item.warranty_note === null || item.warranty_note === undefined ? item.note : item.warranty_note)}
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-right tabular-nums">{Number(item.quantity || 0)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right tabular-nums">
                      {hasReferencePrice && discountAmount > 0 && (
                        <span className="block text-[10px] font-normal text-slate-600">
                          Tham chiếu: {formatMoney(item.reference_unit_price)}
                        </span>
                      )}
                      {discountAmount > 0 && (
                        <span className="block text-[10px] font-normal text-slate-600">
                          Giảm: −{formatMoney(item.discount_amount)}
                        </span>
                      )}
                      <span className="block font-semibold">Bán: {formatMoney(item.unit_price)}</span>
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-right tabular-nums">{formatMoney(item.line_total)}</td>
                  </tr>
                );
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-slate-900 px-2 py-8 text-center text-slate-500">
                    Phiếu chưa có dòng sản phẩm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="voucher-print-total mt-5 flex justify-end">
          <div className="grid min-w-[260px] grid-cols-[1fr_auto] gap-x-5 border-t-2 border-slate-900 pt-3 text-base">
            <span className="font-bold">Tổng tiền</span>
            <span className="text-right font-bold tabular-nums">{formatMoney(voucher.total_amount)}</span>
          </div>
        </section>

        <section className="voucher-print-notes mt-7 rounded-sm border border-slate-300 p-4 text-sm">
          <p className="font-semibold text-slate-900">Lưu ý bảo hành</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            <li>Vui lòng giữ phiếu để được hỗ trợ bảo hành.</li>
            <li>Bảo hành theo điều kiện của từng sản phẩm và nội dung ghi trên phiếu.</li>
          </ul>
        </section>

        <section className="voucher-print-signatures mt-10 grid grid-cols-2 gap-10 text-center">
          <div className="min-h-28">
            <p className="font-bold">Khách hàng</p>
            <p className="mt-1 text-xs italic text-slate-500">(Ký và ghi rõ họ tên)</p>
          </div>
          <div className="min-h-28">
            <p className="font-bold">Người bán</p>
            <p className="mt-1 text-xs italic text-slate-500">(Ký và ghi rõ họ tên)</p>
          </div>
        </section>
      </article>
    </main>
  );
}
