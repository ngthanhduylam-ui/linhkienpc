import { useEffect, useMemo, useRef, useState } from "react";
import { getStockVoucherRequest, listStockVouchers } from "../services/inventoryOperations.service";
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
  if (type === "IN") return "Nhập hàng";
  if (type === "OUT") return "Xuất & Giao hàng";
  return type || "-";
}

function getPartnerRole(voucher) {
  const partner = voucher?.partner;
  if (!partner) return "Đối tác";
  if (partner.type === "SUPPLIER") return "Nhà cung cấp";
  if (partner.type === "CUSTOMER") return "Khách hàng";
  return "Đối tác";
}

function getPartnerText(voucher) {
  const partner = voucher?.partner;
  if (!partner) return "-";
  return `${getPartnerRole(voucher)}: ${partner.name || "-"}`;
}

function formatNote(note) {
  if (!note || !String(note).trim()) return "Không ghi chú";
  return formatWarrantyNote(note);
}

function getPreviewItems(voucher) {
  return Array.isArray(voucher?.preview_items) ? voucher.preview_items : [];
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
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

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

  async function handleOpenDetail(voucherId) {
    setSelectedVoucher(null);
    setDetailError("");
    setIsDetailLoading(true);
    try {
      const detail = await getStockVoucherRequest(voucherId);
      setSelectedVoucher(detail);
    } catch (err) {
      setDetailError(err?.message || "Không thể tải chi tiết phiếu.");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function handleCloseDetail() {
    setSelectedVoucher(null);
    setDetailError("");
    setIsDetailLoading(false);
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Lịch sử giao dịch</h2>
        <p className="mt-0.5 text-xs text-slate-500">Xem lại các phiếu nhập hàng và xuất & giao hàng.</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <form className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_120px]" onSubmit={handleSearch}>
          <div className="relative">
            <input
              ref={keywordInputRef}
              className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
              placeholder="Tìm sản phẩm, SKU, khách hàng, nhà cung cấp, mã phiếu"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
            />
            {keywordInput && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            )}
          </div>

          <select
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
            value={typeInput}
            onChange={handleTypeChange}
          >
            <option value="">Tất cả</option>
            <option value="IN">Nhập hàng</option>
            <option value="OUT">Xuất & Giao hàng</option>
          </select>

          <button
            type="submit"
            className="h-10 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900"
          >
            Tìm kiếm
          </button>
        </form>

        <p className="mt-2 text-[11px] text-slate-400">Giao dịch cũ trước khi có phiếu sẽ được hỗ trợ sau.</p>
      </section>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Danh sách phiếu</h3>
          <p className="text-xs text-slate-500">
            Tổng: <span className="font-semibold text-slate-700">{total}</span> phiếu
          </p>
        </div>

        {isLoading && <p className="mt-3 text-sm text-slate-500">Đang tải dữ liệu...</p>}

        {!isLoading && vouchers.length === 0 && (
          <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center">
            <p className="text-sm font-medium text-slate-700">Không tìm thấy phiếu giao dịch phù hợp.</p>
            <p className="mt-1 text-xs text-slate-500">Thử đổi từ khóa, khách hàng, nhà cung cấp, mã phiếu hoặc loại phiếu.</p>
          </div>
        )}

        {!isLoading && vouchers.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
            {vouchers.map((voucher) => {
              const previewItems = getPreviewItems(voucher);
              const hiddenItemCount = Math.max(0, Number(voucher.item_count || 0) - previewItems.length);

              return (
                <article key={voucher.id} className="grid gap-3 bg-white p-3 hover:bg-slate-50 md:grid-cols-[160px_minmax(0,1fr)_170px_110px] md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{formatDateTime(voucher.occurred_at)}</p>
                    <p className="mt-0.5 text-xs font-medium text-brand-700">
                      {voucher.voucher_label || getVoucherLabel(voucher.voucher_type)}
                      {voucher.voucher_code ? ` · ${voucher.voucher_code}` : ""}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{getPartnerText(voucher)}</p>
                    {previewItems.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {previewItems.map((item, index) => (
                          <p key={`${voucher.id}-${item.sku}-${index}`} className="truncate text-xs text-slate-600">
                            {item.product_name || item.sku || "-"}
                          </p>
                        ))}
                        {hiddenItemCount > 0 && <p className="text-xs font-medium text-slate-500">+{hiddenItemCount} sản phẩm khác</p>}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Chưa có dòng sản phẩm để xem nhanh.</p>
                    )}
                  </div>

                  <div className="text-sm text-slate-700 md:text-right">
                    <p>
                      <span className="font-semibold">{Number(voucher.item_count || 0)}</span> sản phẩm
                    </p>
                    <p className="mt-0.5">
                      Tổng SL: <span className="font-semibold">{Number(voucher.total_quantity || 0)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Admin: {voucher.admin?.username || "-"}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenDetail(voucher.id)}
                    className="h-9 rounded border border-brand-600 px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Xem chi tiết
                  </button>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Trang {page} / {totalPages}
          </p>
          <div className="flex items-center gap-2">
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

      {(isDetailLoading || selectedVoucher || detailError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Chi tiết phiếu</h3>
                <p className="mt-0.5 text-xs text-slate-500">Xem các dòng sản phẩm trong phiếu giao dịch.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng chi tiết"
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(90vh-64px)] overflow-y-auto p-4">
              {isDetailLoading && <p className="text-sm text-slate-500">Đang tải chi tiết phiếu...</p>}
              {detailError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{detailError}</p>}

              {selectedVoucher && !isDetailLoading && (
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-500">Loại phiếu</p>
                        <p className="font-semibold text-brand-800">
                          {selectedVoucher.voucher_label || getVoucherLabel(selectedVoucher.voucher_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Mã phiếu</p>
                        <p className="font-semibold text-slate-900">{selectedVoucher.voucher_code || `#${selectedVoucher.id}`}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Ngày giờ</p>
                        <p className="font-semibold text-slate-900">{formatDateTime(selectedVoucher.occurred_at)}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500">{getPartnerRole(selectedVoucher)}</p>
                        <p className="font-semibold text-slate-900">{selectedVoucher.partner?.name || "-"}</p>
                        {selectedVoucher.partner?.phone && <p className="mt-0.5 text-xs text-slate-500">{selectedVoucher.partner.phone}</p>}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Admin</p>
                        <p className="font-semibold text-slate-900">{selectedVoucher.admin?.username || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Số sản phẩm</p>
                        <p className="font-semibold text-slate-900">{Number(selectedVoucher.item_count || 0)} sản phẩm</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Tổng số lượng</p>
                        <p className="font-semibold text-slate-900">{Number(selectedVoucher.total_quantity || 0)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
                    {(selectedVoucher.items || []).map((item) => (
                      <div key={item.transaction_id} className="grid gap-2 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_150px_80px] sm:items-center">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{item.product?.name || "-"}</p>
                          {item.product?.sku && <p className="mt-0.5 break-all text-xs text-slate-500">SKU: {item.product.sku}</p>}
                        </div>
                        <p className="text-sm font-medium text-brand-800">{formatNote(item.note || item.warranty_note)}</p>
                        <p className="text-sm text-slate-700 sm:text-right">
                          SL: <span className="font-semibold">{Number(item.quantity || 0)}</span>
                        </p>
                      </div>
                    ))}

                    {(!selectedVoucher.items || selectedVoucher.items.length === 0) && (
                      <p className="bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">Phiếu chưa có dòng sản phẩm.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
