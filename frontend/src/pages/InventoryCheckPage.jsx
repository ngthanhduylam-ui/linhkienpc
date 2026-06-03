import { useEffect, useMemo, useRef, useState } from "react";
import {
  getInventoryCheckProduct,
  moveInventoryNoteGroup,
  searchInventoryCheckProducts
} from "../services/inventoryOperations.service";

const NO_NOTE_VALUE = "__NO_NOTE__";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function toGroupValue(group) {
  return group?.is_no_note || !group?.note ? NO_NOTE_VALUE : group.note;
}

export function InventoryCheckPage() {
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [selectedSku, setSelectedSku] = useState("");
  const [detail, setDetail] = useState(null);
  const [fromGroupValue, setFromGroupValue] = useState("");
  const [toNote, setToNote] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    async function searchProducts() {
      if (!debouncedSearch) {
        setProducts([]);
        return;
      }

      setIsSearching(true);
      setError("");
      try {
        const items = await searchInventoryCheckProducts(debouncedSearch);
        if (active) setProducts(items);
      } catch (err) {
        if (active) {
          setProducts([]);
          setError(err?.message || "Không thể tìm sản phẩm.");
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }

    searchProducts();
    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  async function loadProductDetail(sku) {
    setIsLoadingDetail(true);
    setError("");
    try {
      const result = await getInventoryCheckProduct(sku);
      setDetail(result);
      setSelectedSku(result?.product?.sku || sku);
      setFromGroupValue("");
      setToNote("");
      setQuantity("");
      setReason("");
    } catch (err) {
      setDetail(null);
      setSelectedSku("");
      setError(err?.message || "Không thể tải thông tin kiểm hàng.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function handleClearSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setProducts([]);
    setSelectedSku("");
    setDetail(null);
    setSuccess("");
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  const noteGroups = detail?.note_groups || [];
  const selectedFromGroup = useMemo(
    () => noteGroups.find((group) => toGroupValue(group) === fromGroupValue) || null,
    [noteGroups, fromGroupValue]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!detail?.product?.sku) {
      setError("Vui lòng chọn sản phẩm trước.");
      return;
    }

    if (!selectedFromGroup) {
      setError("Vui lòng chọn nhóm cần chuyển.");
      return;
    }

    const numericQuantity = Number(quantity);
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      setError("Số lượng chuyển phải là số nguyên dương.");
      return;
    }

    if (numericQuantity > Number(selectedFromGroup.quantity || 0)) {
      setError(`Số lượng chuyển vượt quá tồn của nhóm ${selectedFromGroup.label}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await moveInventoryNoteGroup({
        sku: detail.product.sku,
        from_note: selectedFromGroup.is_no_note ? "" : selectedFromGroup.note,
        to_note: toNote.trim(),
        quantity: numericQuantity,
        reason: reason.trim() || undefined
      });

      setDetail(result);
      setSelectedSku(result?.product?.sku || detail.product.sku);
      setFromGroupValue("");
      setQuantity("");
      setReason("");
      setSuccess("Chuyển ghi chú tồn kho thành công.");
    } catch (err) {
      setError(err?.message || "Chuyển ghi chú thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Kiểm hàng</h2>
        <p className="mt-1 text-sm text-slate-600">
          Kiểm tra và chuyển số lượng giữa các nhóm ghi chú bảo hành hiện tại.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="space-y-5 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Tìm sản phẩm</h3>
            <label className="mt-4 mb-1 block text-sm font-medium text-slate-700">
              Tìm sản phẩm theo tên hoặc SKU
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                className="h-11 w-full rounded-md border border-slate-300 px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Nhập tên sản phẩm hoặc SKU"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSuccess("");
                }}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm sản phẩm"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              )}
            </div>

            {isSearching && <p className="mt-3 text-sm text-slate-500">Đang tìm sản phẩm...</p>}

            {!isSearching && debouncedSearch && products.length === 0 && (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                Không tìm thấy sản phẩm phù hợp.
              </p>
            )}

            {products.length > 0 && (
              <div className="mt-4 space-y-2">
                {products.map((product) => {
                  const isSelected = String(product.sku) === String(selectedSku);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => loadProductDetail(product.sku)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-brand-600 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-lg font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-2 text-base font-bold text-brand-800">
                        {Number(product.total_quantity || 0)}{" "}
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          tồn hiện tại
                        </span>
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-600">SKU: {product.sku}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {detail && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Nhóm ghi chú hiện tại</h3>
              {noteGroups.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {noteGroups.map((group) => (
                    <div
                      key={toGroupValue(group)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <p className="break-all text-sm font-semibold text-slate-800">{group.label}</p>
                      <p className="shrink-0 text-base font-bold text-brand-800">Còn {group.quantity}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Sản phẩm chưa có nhóm ghi chú tồn kho.
                </p>
              )}
            </div>
          )}
        </section>

        <aside className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h3 className="text-base font-semibold text-slate-900">Chuyển ghi chú</h3>

            {!detail ? (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Chọn sản phẩm bên trái để kiểm hàng.
              </p>
            ) : (
              <>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-bold text-slate-900">{detail.product.name}</p>
                  <p className="mt-2 break-all text-xs text-slate-600">SKU: {detail.product.sku}</p>
                  <div className="mt-4 rounded-md bg-white px-4 py-4 text-center">
                    <p className="text-5xl font-extrabold leading-none text-brand-800">
                      {Number(detail.product.total_quantity || 0)}
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">TỒN HIỆN TẠI</p>
                  </div>
                </div>

                <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Từ nhóm *</label>
                    <select
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={fromGroupValue}
                      onChange={(event) => setFromGroupValue(event.target.value)}
                    >
                      <option value="">-- Chọn nhóm cần chuyển --</option>
                      {noteGroups.map((group) => (
                        <option key={toGroupValue(group)} value={toGroupValue(group)}>
                          {group.label} - còn {group.quantity}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Sang ghi chú</label>
                    <input
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={toNote}
                      onChange={(event) => setToNote(event.target.value)}
                      placeholder="Ví dụ: BH 12.28, để trống nếu không ghi chú"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng *</label>
                    <input
                      type="number"
                      min={1}
                      max={selectedFromGroup ? selectedFromGroup.quantity : undefined}
                      step={1}
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder="Nhập số lượng cần chuyển"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Lý do</label>
                    <input
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Ví dụ: Bổ sung bảo hành"
                    />
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {success && <p className="text-sm text-green-700">{success}</p>}

                  <button
                    type="submit"
                    disabled={isSubmitting || isLoadingDetail || noteGroups.length === 0}
                    className="h-11 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Đang xử lý..." : "Chuyển ghi chú"}
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </div>

      {detail?.recent_adjustments?.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Lịch sử điều chỉnh gần đây</h3>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Ngày giờ</th>
                  <th className="px-3 py-2 font-medium">Từ</th>
                  <th className="px-3 py-2 font-medium">Sang</th>
                  <th className="px-3 py-2 font-medium">SL</th>
                  <th className="px-3 py-2 font-medium">Lý do</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.recent_adjustments.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-700">{formatDateTime(item.occurred_at)}</td>
                    <td className="px-3 py-2 text-slate-700">{item.from_label}</td>
                    <td className="px-3 py-2 text-slate-700">{item.to_label}</td>
                    <td className="px-3 py-2 text-slate-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-slate-700">{item.reason || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{item.created_by_admin?.username || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
