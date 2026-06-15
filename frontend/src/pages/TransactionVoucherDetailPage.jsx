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

function getVoucherLabel(type) {
  if (type === "IN") return "Phiếu nhập";
  if (type === "OUT") return "Phiếu bán";
  return type || "-";
}

function getPartnerRole(voucher) {
  const partner = voucher?.partner;
  if (!partner) return "Đối tác";
  if (partner.type === "SUPPLIER") return "Nhà cung cấp";
  if (partner.type === "CUSTOMER") return "Khách hàng";
  return "Đối tác";
}

function getPartnerName(voucher) {
  return voucher?.partner?.name || "-";
}

function formatNote(note) {
  if (!note || !String(note).trim()) return "-";
  return formatWarrantyNote(note);
}

function getSnapshotProductName(item) {
  return item?.product_name || item?.product?.name || "-";
}

function getSnapshotSku(item) {
  return item?.sku || item?.product?.sku || "-";
}

function formatMoney(value) {
  if (value === null || value === undefined) {
    return {
      label: "Chưa xác định",
      isMissing: true
    };
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return {
      label: "Chưa xác định",
      isMissing: true
    };
  }

  return {
    label: `${numberValue.toLocaleString("vi-VN")} ₫`,
    isMissing: false
  };
}

function VoucherTypeBadge({ type }) {
  const isIn = type === "IN";
  return (
    <span
      className={
        isIn
          ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
          : "inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700"
      }
    >
      {getVoucherLabel(type)}
    </span>
  );
}

function InfoCard({ title, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{children}</span>
    </div>
  );
}

export function TransactionVoucherDetailPage() {
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
        setError(err?.message || "Không thể tải chi tiết phiếu.");
        setVoucher(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadVoucher();
    return () => {
      active = false;
    };
  }, [voucherId]);

  const isSaleVoucher = voucher?.voucher_type === "OUT";
  const totalAmount = formatMoney(voucher?.total_amount);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/admin/transaction-history" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
            ← Quay lại danh sách phiếu
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-slate-900">{voucher?.voucher_code || "Chi tiết phiếu"}</h2>
            {voucher && <VoucherTypeBadge type={voucher.voucher_type} />}
          </div>
        </div>
      </div>

      {isLoading && (
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Đang tải chi tiết phiếu...</p>
        </section>
      )}

      {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {voucher && !isLoading && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <InfoCard title="Thông tin đối tác">
              <div className="rounded-md bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{getPartnerRole(voucher)}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{getPartnerName(voucher)}</p>
                {voucher.partner?.phone && <p className="mt-1 text-sm text-slate-600">{voucher.partner.phone}</p>}
                {voucher.partner?.address && <p className="mt-1 text-sm text-slate-500">{voucher.partner.address}</p>}
              </div>
            </InfoCard>

            <InfoCard title="Thông tin sản phẩm">
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className={`w-full table-fixed border-collapse text-sm ${isSaleVoucher ? "min-w-[920px]" : "min-w-[640px]"}`}>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-14 px-3 py-2.5 text-center">STT</th>
                      <th className="px-3 py-2.5 text-left">Sản phẩm</th>
                      <th className="w-44 px-3 py-2.5 text-left">SKU</th>
                      <th className="w-52 px-3 py-2.5 text-left">Nhóm bảo hành / Ghi chú</th>
                      <th className="w-24 px-3 py-2.5 text-right">Số lượng</th>
                      {isSaleVoucher && <th className="w-36 px-3 py-2.5 text-right">Đơn giá</th>}
                      {isSaleVoucher && <th className="w-36 px-3 py-2.5 text-right">Thành tiền</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(voucher.items || []).map((item, index) => {
                      const unitPrice = formatMoney(item.unit_price);
                      const lineTotal = formatMoney(item.line_total);

                      return (
                        <tr key={item.transaction_id || index} className="hover:bg-blue-50/40">
                          <td className="px-3 py-3 text-center text-slate-500">{index + 1}</td>
                          <td className="min-w-0 px-3 py-3 font-semibold text-slate-900">
                            <span className="line-clamp-2">{getSnapshotProductName(item)}</span>
                          </td>
                          <td className="min-w-0 break-words px-3 py-3 text-slate-600">{getSnapshotSku(item)}</td>
                          <td className="min-w-0 break-words px-3 py-3 text-brand-800">{formatNote(item.note || item.warranty_note)}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{Number(item.quantity || 0)}</td>
                          {isSaleVoucher && (
                            <td className={`px-3 py-3 text-right font-semibold tabular-nums ${unitPrice.isMissing ? "text-slate-400" : "text-slate-900"}`}>
                              {unitPrice.label}
                            </td>
                          )}
                          {isSaleVoucher && (
                            <td className={`px-3 py-3 text-right font-semibold tabular-nums ${lineTotal.isMissing ? "text-slate-400" : "text-slate-900"}`}>
                              {lineTotal.label}
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {(!voucher.items || voucher.items.length === 0) && (
                      <tr>
                        <td colSpan={isSaleVoucher ? 7 : 5} className="bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
                          Phiếu chưa có dòng sản phẩm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </InfoCard>
          </div>

          <aside className="space-y-4">
            <InfoCard title="Thông tin phiếu">
              <div className="divide-y divide-slate-100">
                <SummaryRow label="Mã phiếu">{voucher.voucher_code || `#${voucher.id}`}</SummaryRow>
                <SummaryRow label="Loại phiếu"><VoucherTypeBadge type={voucher.voucher_type} /></SummaryRow>
                <SummaryRow label="Ngày tạo">{formatDateTime(voucher.occurred_at)}</SummaryRow>
                <SummaryRow label="Người tạo">{voucher.admin?.username || "-"}</SummaryRow>
                <SummaryRow label="Tổng số lượng">{Number(voucher.total_quantity || 0)}</SummaryRow>
                <SummaryRow label="Số dòng">{Number(voucher.item_count || 0)}</SummaryRow>
                {isSaleVoucher && (
                  <SummaryRow label="Tổng tiền">
                    <span className={`text-base font-bold tabular-nums ${totalAmount.isMissing ? "text-amber-700" : "text-slate-950"}`}>
                      {totalAmount.label}
                    </span>
                  </SummaryRow>
                )}
                <SummaryRow label="Ghi chú">{formatNote(voucher.note)}</SummaryRow>
              </div>
            </InfoCard>
          </aside>
        </div>
      )}
    </section>
  );
}
