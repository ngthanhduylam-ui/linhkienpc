import { useEffect, useMemo, useRef, useState } from "react";
import {
  adjustInventoryQuantity,
  getInventoryCheckProduct,
  listActiveProducts,
  searchInventoryCheckProducts
} from "../services/inventoryOperations.service";
import { RECENT_PRODUCTS_KEY, filterRecentItemsByAvailable, readRecentItems, saveRecentItem } from "../utils/recentItems";
import { formatWarrantyNote } from "../utils/warrantyNote";

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

function getGroupLabel(group) {
  if (!group || group.is_no_note || !group.note) return "Không ghi chú";
  return formatWarrantyNote(group.label || group.note);
}

function getQuantityAdjustLabel(type) {
  return type === "DECREASE" ? "Giảm tồn" : "Tăng tồn";
}

function getQuantityAdjustBadgeClass(type) {
  return type === "DECREASE"
    ? "bg-red-50 text-red-700 ring-red-100"
    : "bg-emerald-50 text-emerald-700 ring-emerald-100";
}

export function InventoryCheckPage() {
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [activeProducts, setActiveProducts] = useState([]);
  const [hasFocusedProductSearch, setHasFocusedProductSearch] = useState(false);
  const [recentProducts, setRecentProducts] = useState(() => readRecentItems(RECENT_PRODUCTS_KEY));
  const [selectedSku, setSelectedSku] = useState("");
  const [detail, setDetail] = useState(null);

  const [adjustmentType, setAdjustmentType] = useState("INCREASE");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustNoteGroup, setAdjustNoteGroup] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

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

    async function loadActiveProducts() {
      try {
        const items = await listActiveProducts();
        if (!active) return;
        setActiveProducts(items);
      } catch {
        if (active) setActiveProducts([]);
      }
    }

    loadActiveProducts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeProducts.length) return;
    const activeRecentProducts = filterRecentItemsByAvailable(readRecentItems(RECENT_PRODUCTS_KEY), activeProducts).slice(0, 20);
    setRecentProducts(activeRecentProducts);
    try {
      window.localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(activeRecentProducts));
    } catch {
      // Recent products are optional; ignore storage failures.
    }
  }, [activeProducts]);

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

  function resetQuantityForm() {
    setAdjustQuantity("");
    setAdjustReason("");
  }

  async function loadProductDetail(sku, options = {}) {
    setIsLoadingDetail(true);
    setError("");
    try {
      const result = await getInventoryCheckProduct(sku);
      setDetail(result);
      setSelectedSku(result?.product?.sku || sku);
      if (!options.keepForms) resetQuantityForm();
      return result;
    } catch (err) {
      setDetail(null);
      setSelectedSku("");
      setError(err?.message || "Không thể tải thông tin kiểm hàng.");
      return null;
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function handleClearSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setProducts([]);
    setHasFocusedProductSearch(true);
    setSelectedSku("");
    setDetail(null);
    setSuccess("");
    setError("");
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function handleSelectProduct(product) {
    setRecentProducts(saveRecentItem(RECENT_PRODUCTS_KEY, product, 20));
    loadProductDetail(product.sku);
  }

  const displayProducts = useMemo(() => {
    if (debouncedSearch) return products;
    if (hasFocusedProductSearch) return filterRecentItemsByAvailable(recentProducts, activeProducts);
    return [];
  }, [activeProducts, debouncedSearch, hasFocusedProductSearch, products, recentProducts]);

  const noteGroups = detail?.note_groups || [];
  const selectedAdjustGroup = useMemo(
    () => noteGroups.find((group) => toGroupValue(group) === adjustNoteGroup) || null,
    [noteGroups, adjustNoteGroup]
  );

  async function handleQuantitySubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!detail?.product?.sku) {
      setError("Vui lòng chọn sản phẩm trước.");
      return;
    }

    const numericQuantity = Number(adjustQuantity);
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      setError("Số lượng điều chỉnh phải là số nguyên dương.");
      return;
    }

    if (adjustmentType === "DECREASE") {
      if (!selectedAdjustGroup) {
        setError("Vui lòng chọn nhóm bảo hành cần giảm.");
        return;
      }

      if (numericQuantity > Number(selectedAdjustGroup.quantity || 0)) {
        setError(`Số lượng giảm vượt quá tồn của nhóm ${getGroupLabel(selectedAdjustGroup)}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await adjustInventoryQuantity({
        sku: detail.product.sku,
        adjustment_type: adjustmentType,
        quantity: numericQuantity,
        note_group:
          adjustmentType === "DECREASE"
            ? selectedAdjustGroup?.is_no_note
              ? NO_NOTE_VALUE
              : selectedAdjustGroup?.note || ""
            : adjustNoteGroup.trim(),
        reason: adjustReason.trim() || undefined
      });

      const refreshed = await loadProductDetail(result?.product?.sku || detail.product.sku, { keepForms: true });
      setDetail(
        refreshed || {
          ...detail,
          product: result?.product || detail.product,
          note_groups: result?.note_groups || detail.note_groups,
          recent_quantity_adjustments:
            result?.recent_quantity_adjustments || detail.recent_quantity_adjustments
        }
      );
      setAdjustQuantity("");
      setAdjustReason("");
      setSuccess(
        `${getQuantityAdjustLabel(adjustmentType)} thành công. Tồn hiện tại: ${
          result?.adjustment?.current_total_quantity ?? result?.product?.total_quantity ?? "-"
        }.`
      );
    } catch (err) {
      setError(err?.message || "Điều chỉnh số lượng thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const recentQuantityAdjustments = detail?.recent_quantity_adjustments || [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Kiểm hàng</h2>
        <p className="mt-1 text-sm text-slate-600">Kiểm tra tồn kho và điều chỉnh số lượng thực tế.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Tìm sản phẩm</h3>
            <label className="mt-3 mb-1 block text-sm font-medium text-slate-700">
              Tìm sản phẩm theo tên hoặc SKU
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                className="h-10 w-full rounded-md border border-slate-300 px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Nhập tên sản phẩm hoặc SKU"
                value={searchInput}
                onFocus={() => setHasFocusedProductSearch(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setHasFocusedProductSearch(false);
                }}
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
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              )}
            </div>

            {isSearching && <p className="mt-3 text-sm text-slate-500">Đang tìm sản phẩm...</p>}

            {!isSearching && debouncedSearch && products.length === 0 && (
              <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                Không tìm thấy sản phẩm phù hợp.
              </p>
            )}

            {displayProducts.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
                {!debouncedSearch && (
                  <p className="bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500">Sản phẩm gần đây</p>
                )}
                {displayProducts.map((product) => {
                  const isSelected = String(product.sku) === String(selectedSku);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelectProduct(product)}
                      className={[
                        "w-full px-3 py-2 text-left transition",
                        isSelected
                          ? "bg-brand-50"
                          : "bg-white hover:bg-brand-50"
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                          <p className="mt-1 break-all text-xs text-slate-600">SKU: {product.sku}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-brand-800">
                          Tồn: {Number(product.total_quantity || 0)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="lg:col-span-7">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
            {!detail ? (
              <>
                <h3 className="text-base font-semibold text-slate-900">Điều chỉnh số lượng</h3>
                <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  Chọn sản phẩm bên trái để kiểm hàng.
                </p>
              </>
            ) : (
              <>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-slate-900">{detail.product.name}</p>
                      <p className="mt-1 break-all text-xs text-slate-600">SKU: {detail.product.sku}</p>
                    </div>
                    <div className="rounded-md bg-white px-4 py-2 text-center">
                      <p className="text-3xl font-extrabold leading-none text-brand-800">
                        {Number(detail.product.total_quantity || 0)}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Tồn hiện tại
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-900">Nhóm ghi chú hiện tại</h3>
                    {/* TODO: hiển thị cảnh báo lệch tổng nhóm/tồn kho khi backend expose inventory_warning sau. */}
                  </div>

                  {noteGroups.length > 0 ? (
                    <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
                      {noteGroups.map((group) => (
                        <div key={toGroupValue(group)} className="flex items-center justify-between gap-3 px-3 py-2">
                          <p className="break-all text-sm font-semibold text-slate-800">{getGroupLabel(group)}</p>
                          <p className="shrink-0 text-sm font-bold text-brand-800">còn {group.quantity}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                      Sản phẩm chưa có nhóm ghi chú tồn kho.
                    </p>
                  )}
                </div>

                <form className="mt-4 space-y-3 border-t border-slate-100 pt-4" onSubmit={handleQuantitySubmit}>
                  <h3 className="text-base font-semibold text-slate-900">Điều chỉnh số lượng</h3>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Loại điều chỉnh *</label>
                    <select
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={adjustmentType}
                      onChange={(event) => {
                        setAdjustmentType(event.target.value);
                        setAdjustNoteGroup("");
                        setAdjustQuantity("");
                        setAdjustReason("");
                      }}
                    >
                      <option value="INCREASE">Tăng tồn</option>
                      <option value="DECREASE">Giảm tồn</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng *</label>
                    <input
                      type="number"
                      min={1}
                      max={
                        adjustmentType === "DECREASE" && selectedAdjustGroup
                          ? selectedAdjustGroup.quantity
                          : undefined
                      }
                      step={1}
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={adjustQuantity}
                      onChange={(event) => setAdjustQuantity(event.target.value)}
                      placeholder="Nhập số lượng điều chỉnh"
                    />
                  </div>

                  {adjustmentType === "INCREASE" ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Nhóm bảo hành / ghi chú
                      </label>
                      <input
                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        value={adjustNoteGroup}
                        onChange={(event) => setAdjustNoteGroup(event.target.value)}
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Ví dụ: BH 12.28, để trống nếu không ghi chú"
                      />
                      <p className="mt-1 text-xs text-slate-500">Để trống nếu tăng vào nhóm Không ghi chú.</p>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Nhóm bảo hành / ghi chú *
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        value={adjustNoteGroup}
                        onChange={(event) => setAdjustNoteGroup(event.target.value)}
                      >
                        <option value="">-- Chọn nhóm cần giảm --</option>
                        {noteGroups.map((group) => (
                          <option key={toGroupValue(group)} value={toGroupValue(group)}>
                            {getGroupLabel(group)} - còn {group.quantity}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Lý do</label>
                    <input
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={adjustReason}
                      onChange={(event) => setAdjustReason(event.target.value)}
                      placeholder="Ví dụ: Tồn đầu kỳ, kiểm kho thiếu"
                    />
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}
                  {success && <p className="text-sm text-green-700">{success}</p>}

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isLoadingDetail ||
                      (adjustmentType === "DECREASE" && noteGroups.length === 0)
                    }
                    className="h-10 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Đang xử lý..." : "Lưu điều chỉnh"}
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </div>

      {recentQuantityAdjustments.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Lịch sử điều chỉnh số lượng gần đây</h3>
          <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Ngày giờ</th>
                  <th className="px-3 py-2 font-medium">Loại</th>
                  <th className="px-3 py-2 font-medium">Nhóm ghi chú</th>
                  <th className="px-3 py-2 font-medium">SL</th>
                  <th className="px-3 py-2 font-medium">Tồn</th>
                  <th className="px-3 py-2 font-medium">Lý do</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentQuantityAdjustments.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-700">{formatDateTime(item.occurred_at)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ${getQuantityAdjustBadgeClass(
                          item.adjustment_type
                        )}`}
                      >
                        {getQuantityAdjustLabel(item.adjustment_type)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatWarrantyNote(item.note_group || "")}</td>
                    <td className="px-3 py-2 text-slate-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {item.from_quantity} → {item.to_quantity}
                    </td>
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
