import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listStockVouchers } from "../services/inventoryOperations.service";

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
  if (!partner) return "Khách hàng / Nhà cung cấp";
  if (partner.type === "SUPPLIER") return "Nhà cung cấp";
  if (partner.type === "CUSTOMER") return "Khách hàng";
  return "Khách hàng / Nhà cung cấp";
}

function getPartnerName(voucher) {
  return voucher?.partner?.name || "-";
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

export function TransactionHistoryPage() {
  const [keywordInput, setKeywordInput] = useState("");
  const keywordInputRef = useRef(null);
  const [typeInput, setTypeInput] = useState("");
  const [filters, setFilters] = useState({ keyword: "", type: "" });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [vouchers, setVouchers] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setError("");
      try {
        const result = await listStockVouchers({
          keyword: filters.keyword,
          type: filters.type,
          page,
          limit
        });
        if (!active) return;
        setVouchers(result.items || []);
        setTotal(Number(result.meta?.total || 0));
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Không thể tải lịch sử giao dịch.");
        setVouchers([]);
        setTotal(0);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [filters, page, limit]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setFilters({ keyword: keywordInput.trim(), type: typeInput });
  }

  function handleTypeChange(event) {
    const nextType = event.target.value;
    setTypeInput(nextType);
    setPage(1);
    setFilters({ keyword: keywordInput.trim(), type: nextType });
  }

  function handleClearSearch() {
    setKeywordInput("");
    setPage(1);
    setFilters({ keyword: "", type: typeInput });
    window.setTimeout(() => keywordInputRef.current?.focus(), 0);
  }

  return (
    <section className="transaction-history-container min-w-0 max-w-full space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Lịch sử giao dịch</h2>
        <p className="mt-1 text-sm text-slate-600">Tra cứu phiếu nhập, phiếu bán và các dòng sản phẩm trong phiếu.</p>
      </div>

      <section className="min-w-0 max-w-full rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <form className="transaction-history-filter-form grid min-w-0 max-w-full grid-cols-1 gap-3" onSubmit={handleSearch}>
          <div className="relative min-w-0 max-w-full">
            <input
              ref={keywordInputRef}
              className="h-10 w-full min-w-0 max-w-full rounded-md border border-slate-300 px-3 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="Tìm theo mã phiếu, sản phẩm, khách hàng, nhà cung cấp"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
            />
            {keywordInput && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            )}
          </div>

          <select
            className="h-10 w-full min-w-0 max-w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            value={typeInput}
            onChange={handleTypeChange}
          >
            <option value="">Tất cả loại phiếu</option>
            <option value="IN">Nhập hàng</option>
            <option value="OUT">Bán hàng</option>
          </select>

          <button
            type="submit"
            className="h-10 w-full min-w-0 max-w-full rounded-md bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Tìm kiếm
          </button>
        </form>

        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>

      <section className="min-w-0 max-w-full rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="transaction-history-section-heading flex min-w-0 max-w-full flex-col gap-2">
          <h3 className="text-base font-semibold text-slate-900">Danh sách phiếu</h3>
          <p className="text-sm text-slate-600">
            Tổng: <span className="font-semibold text-slate-900">{total}</span> phiếu
          </p>
        </div>

        <div className="transaction-history-list mt-4 min-w-0 max-w-full">
          <div className="transaction-history-grid-header gap-3 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Mã phiếu</span>
            <span>Loại phiếu</span>
            <span>Ngày tạo</span>
            <span>Khách hàng / Nhà cung cấp</span>
            <span>Tổng số lượng</span>
            <span>Người tạo</span>
            <span className="text-right">Thao tác</span>
          </div>

          {isLoading && (
            <div className="transaction-history-state rounded-md border border-slate-200 px-4 py-8">
              <p className="text-sm text-slate-500">Đang tải lịch sử giao dịch...</p>
            </div>
          )}

          {!isLoading && vouchers.length === 0 && (
            <div className="transaction-history-state rounded-md border border-slate-200 px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">Không tìm thấy phiếu giao dịch phù hợp.</p>
              <p className="mt-1 text-xs text-slate-500">Thử đổi từ khóa, mã phiếu hoặc loại phiếu.</p>
            </div>
          )}

          {!isLoading && vouchers.map((voucher) => (
            <div
              key={voucher.id}
              className="transaction-history-row grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border border-slate-200 p-4 text-sm hover:bg-blue-50/50"
            >
              <div className="transaction-history-voucher col-span-2 row-start-2 min-w-0 max-w-full">
                <span className="transaction-history-card-label mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Mã phiếu
                </span>
                <Link
                  to={`/admin/transaction-history/${voucher.id}`}
                  className="transaction-history-wide-truncate break-words font-semibold text-brand-800 [overflow-wrap:anywhere] hover:text-brand-900 hover:underline"
                >
                  {voucher.voucher_code || `#${voucher.id}`}
                </Link>
              </div>
              <div className="transaction-history-type col-start-1 row-start-1 min-w-0 max-w-full">
                <span className="transaction-history-card-label mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Loại phiếu
                </span>
                <VoucherTypeBadge type={voucher.voucher_type} />
              </div>
              <div className="transaction-history-date col-start-2 row-start-1 min-w-0 max-w-full text-right text-slate-700">
                <span className="transaction-history-card-label mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Ngày tạo
                </span>
                <p>{formatDateTime(voucher.occurred_at)}</p>
              </div>
              <div className="transaction-history-partner col-span-2 row-start-3 min-w-0 max-w-full">
                <span className="transaction-history-card-label mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Khách hàng / Nhà cung cấp
                </span>
                <p className="transaction-history-wide-truncate break-words font-medium text-slate-900 [overflow-wrap:anywhere]">
                  {getPartnerName(voucher)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{getPartnerRole(voucher)}</p>
              </div>
              <div className="transaction-history-quantity col-start-1 row-start-4 min-w-0 max-w-full">
                <span className="transaction-history-card-label mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Tổng số lượng
                </span>
                <p className="font-semibold tabular-nums text-slate-900">{Number(voucher.total_quantity || 0)}</p>
              </div>
              <div className="transaction-history-admin col-start-2 row-start-4 min-w-0 max-w-full text-right text-slate-700">
                <span className="transaction-history-card-label mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Người tạo
                </span>
                <p className="break-words [overflow-wrap:anywhere]">{voucher.admin?.username || "-"}</p>
              </div>
              <div className="transaction-history-actions col-span-2 row-start-5 flex min-w-0 max-w-full flex-wrap justify-start gap-2">
                {voucher.voucher_type === "OUT" && (
                  <Link
                    to={`/admin/transaction-history/${voucher.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`In phiếu ${voucher.voucher_code || voucher.id}`}
                    className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    In phiếu
                  </Link>
                )}
                <Link
                  to={`/admin/transaction-history/${voucher.id}`}
                  aria-label={`Xem chi tiết phiếu ${voucher.voucher_code || voucher.id}`}
                  className="inline-flex h-11 items-center rounded-md border border-brand-600 bg-white px-4 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Chi tiết
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="transaction-history-pagination mt-4 flex min-w-0 max-w-full flex-col gap-2">
          <p className="text-sm text-slate-600">Trang {page} / {totalPages}</p>
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => (prev < totalPages ? prev + 1 : prev))}
              disabled={page >= totalPages || isLoading}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
