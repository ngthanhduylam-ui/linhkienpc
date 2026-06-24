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

function getSaleNote(item) {
  if (item?.sale_note === null || item?.sale_note === undefined) return "";
  return String(item.sale_note).trim();
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

function MoneyStackRow({ label, value, valueClassName = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={`min-w-0 text-right tabular-nums ${value.isMissing ? "text-slate-400" : "text-slate-900"} ${valueClassName}`}>
        {value.label}
      </span>
    </div>
  );
}

function ProductSnapshotInfo({ item, saleNote }) {
  return (
    <div className="min-w-0 text-slate-900">
      <span className="block whitespace-normal break-words font-semibold leading-5">{getSnapshotProductName(item)}</span>
      <span className="mt-1 block break-words text-[12px] font-medium leading-4 text-slate-500">
        <span className="font-semibold text-slate-600">SKU:</span> {getSnapshotSku(item)}
      </span>
      {saleNote && (
        <span className="mt-1 block text-[12px] font-medium leading-4 text-slate-500">
          <span className="font-semibold text-slate-600">Serial / Ghi chú:</span> {saleNote}
        </span>
      )}
    </div>
  );
}

function PriceSnapshotStack({ referenceUnitPrice, discountAmount, discountValue, unitPrice, lineTotal }) {
  return (
    <div className="space-y-1.5 text-xs">
      <MoneyStackRow label="Tham chiếu:" value={referenceUnitPrice} />
      {discountValue > 0 && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 text-slate-500">Chiết khấu:</span>
          <span className="min-w-0 text-right font-semibold tabular-nums text-red-600">−{discountAmount.label}</span>
        </div>
      )}
      <MoneyStackRow label="Giá bán:" value={unitPrice} valueClassName="font-semibold" />
      <MoneyStackRow label="Thành tiền:" value={lineTotal} valueClassName="text-sm font-bold text-slate-950" />
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
              <div className="overflow-x-auto rounded-md border border-slate-200 text-sm">
                <div
                  className={
                    isSaleVoucher
                      ? "hidden bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[minmax(40px,48px)_minmax(220px,1.6fr)_minmax(150px,1fr)_minmax(56px,72px)_minmax(190px,0.9fr)] md:items-center md:gap-3"
                      : "hidden bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[minmax(40px,48px)_minmax(220px,1.7fr)_minmax(150px,1fr)_minmax(56px,72px)] md:items-center md:gap-3"
                  }
                >
                  <div className="text-center">STT</div>
                  <div className="min-w-0 text-left">Sản phẩm</div>
                  <div className="min-w-0 text-left">Nhóm bảo hành / Ghi chú</div>
                  <div className="text-right">Số lượng</div>
                  {isSaleVoucher && <div className="min-w-0 text-right">Giá / Thành tiền</div>}
                </div>

                <div className="divide-y divide-slate-100">
                  {(voucher.items || []).map((item, index) => {
                      const unitPrice = formatMoney(item.unit_price);
                      const referenceUnitPrice = formatMoney(item.reference_unit_price);
                      const discountAmount = formatMoney(item.discount_amount || 0);
                      const discountValue = Number(item.discount_amount || 0);
                      const lineTotal = formatMoney(item.line_total);
                      const saleNote = isSaleVoucher ? getSaleNote(item) : "";

                      return (
                        <div key={item.transaction_id || index} className="hover:bg-blue-50/40">
                          <div
                            className={
                              isSaleVoucher
                                ? "hidden px-3 py-3 md:grid md:grid-cols-[minmax(40px,48px)_minmax(220px,1.6fr)_minmax(150px,1fr)_minmax(56px,72px)_minmax(190px,0.9fr)] md:items-start md:gap-3"
                                : "hidden px-3 py-3 md:grid md:grid-cols-[minmax(40px,48px)_minmax(220px,1.7fr)_minmax(150px,1fr)_minmax(56px,72px)] md:items-start md:gap-3"
                            }
                          >
                            <div className="text-center text-slate-500">{index + 1}</div>
                            <ProductSnapshotInfo item={item} saleNote={saleNote} />
                            <div className="min-w-0 break-words text-brand-800">{formatNote(item.note || item.warranty_note)}</div>
                            <div className="text-right font-semibold tabular-nums text-slate-900">{Number(item.quantity || 0)}</div>
                            {isSaleVoucher && (
                              <PriceSnapshotStack
                                referenceUnitPrice={referenceUnitPrice}
                                discountAmount={discountAmount}
                                discountValue={discountValue}
                                unitPrice={unitPrice}
                                lineTotal={lineTotal}
                              />
                            )}
                          </div>

                          <div className="space-y-3 p-3 md:hidden">
                            <div className="flex items-start justify-between gap-3">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">#{index + 1}</span>
                              <span className="text-right text-sm font-semibold tabular-nums text-slate-900">SL: {Number(item.quantity || 0)}</span>
                            </div>
                            <ProductSnapshotInfo item={item} saleNote={saleNote} />
                            <div className="rounded-md bg-slate-50 p-3 text-sm text-brand-800">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Nhóm bảo hành / Ghi chú</p>
                              <p className="break-words">{formatNote(item.note || item.warranty_note)}</p>
                            </div>
                            {isSaleVoucher && (
                              <div className="rounded-md border border-slate-100 p-3">
                                <PriceSnapshotStack
                                  referenceUnitPrice={referenceUnitPrice}
                                  discountAmount={discountAmount}
                                  discountValue={discountValue}
                                  unitPrice={unitPrice}
                                  lineTotal={lineTotal}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {(!voucher.items || voucher.items.length === 0) && (
                      <div className="bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
                        Phiếu chưa có dòng sản phẩm.
                      </div>
                    )}
                </div>
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
