import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getStockVoucherRequest } from "../services/inventoryOperations.service";
import { formatWarrantyNote } from "../utils/warrantyNote";

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
    <main className="min-h-screen bg-white px-4 py-6 text-slate-950 sm:px-8">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={`/admin/transaction-history/${voucherId}`} className="text-sm font-semibold text-brand-700 hover:text-brand-900">
          ← Quay lại chi tiết phiếu
        </Link>
        <button
          type="button"
          disabled
          className="rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
        >
          In phiếu
        </button>
      </div>

      <article className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-8 text-sm shadow-sm ring-1 ring-slate-200 print:min-h-0 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="border-b-2 border-slate-900 pb-5 text-center">
          <p className="text-lg font-bold tracking-wide">VI TÍNH PHƯỚC TÀI</p>
          <h1 className="mt-4 text-2xl font-bold tracking-wide">PHIẾU BÁN HÀNG KIÊM BẢO HÀNH</h1>
        </header>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
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

        <section className="mt-7 overflow-hidden border border-slate-900">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-10 border border-slate-900 px-2 py-2 text-center">STT</th>
                <th className="w-28 border border-slate-900 px-2 py-2">SKU</th>
                <th className="border border-slate-900 px-2 py-2">Tên sản phẩm</th>
                <th className="w-16 border border-slate-900 px-2 py-2 text-right">Số lượng</th>
                <th className="w-24 border border-slate-900 px-2 py-2 text-right">Đơn giá</th>
                <th className="w-28 border border-slate-900 px-2 py-2 text-right">Thành tiền</th>
                <th className="w-36 border border-slate-900 px-2 py-2">Bảo hành/Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.stock_voucher_item_id || item.transaction_id || index} className="align-top">
                  <td className="border border-slate-900 px-2 py-2 text-center">{index + 1}</td>
                  <td className="break-words border border-slate-900 px-2 py-2">{getSnapshotSku(item)}</td>
                  <td className="border border-slate-900 px-2 py-2 font-semibold">{getSnapshotProductName(item)}</td>
                  <td className="border border-slate-900 px-2 py-2 text-right tabular-nums">{Number(item.quantity || 0)}</td>
                  <td className="border border-slate-900 px-2 py-2 text-right tabular-nums">{formatMoney(item.unit_price)}</td>
                  <td className="border border-slate-900 px-2 py-2 text-right tabular-nums">{formatMoney(item.line_total)}</td>
                  <td className="border border-slate-900 px-2 py-2">
                    {formatNote(item.warranty_note === null || item.warranty_note === undefined ? item.note : item.warranty_note)}
                  </td>
                </tr>
              ))}

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

        <section className="mt-5 flex justify-end">
          <div className="grid min-w-[260px] grid-cols-[1fr_auto] gap-x-5 border-t-2 border-slate-900 pt-3 text-base">
            <span className="font-bold">Tổng tiền</span>
            <span className="text-right font-bold tabular-nums">{formatMoney(voucher.total_amount)}</span>
          </div>
        </section>
      </article>
    </main>
  );
}
