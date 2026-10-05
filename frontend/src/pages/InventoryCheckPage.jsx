import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  adjustInventoryQuantity,
  getInventoryCheckProduct,
  listActiveProducts,
  moveInventoryNoteGroup,
  searchInventoryCheckProducts
} from "../services/inventoryOperations.service";
import { RECENT_PRODUCTS_KEY, filterRecentItemsByAvailable, readRecentItems, saveRecentItem } from "../utils/recentItems";
import { formatWarrantyNote } from "../utils/warrantyNote";
import { getInventoryNoteSuggestions } from "../utils/inventoryNoteSuggestions";

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

function normalizeNoteValue(value) {
  if (value === NO_NOTE_VALUE) return "";
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function isSameProduct(left, right) {
  if (!left || !right) return false;
  if (left.id !== undefined && right.id !== undefined && String(left.id) === String(right.id)) return true;
  return Boolean(left.sku && right.sku && String(left.sku) === String(right.sku));
}

function syncProductInList(items, updatedProduct) {
  if (!updatedProduct) return items;
  let changed = false;
  const nextItems = items.map((item) => {
    if (!isSameProduct(item, updatedProduct)) return item;
    changed = true;
    return {
      ...item,
      ...updatedProduct,
      total_quantity: Number(updatedProduct.total_quantity || 0)
    };
  });
  return changed ? nextItems : items;
}

export function InventoryCheckPage() {
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [activeProducts, setActiveProducts] = useState([]);
  const [hasFocusedProductSearch, setHasFocusedProductSearch] = useState(false);
  const [isProductResultsOpen, setIsProductResultsOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState(() => readRecentItems(RECENT_PRODUCTS_KEY));
  const [selectedSku, setSelectedSku] = useState("");
  const [detail, setDetail] = useState(null);
  const detailRequestSequenceRef = useRef(0);

  const [adjustmentType, setAdjustmentType] = useState("INCREASE");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustNoteGroup, setAdjustNoteGroup] = useState("");
  const [isAdjustNoteOpen, setIsAdjustNoteOpen] = useState(false);
  const [activeAdjustNoteIndex, setActiveAdjustNoteIndex] = useState(-1);
  const adjustNoteWrapperRef = useRef(null);
  const adjustNoteListRef = useRef(null);
  const [adjustReason, setAdjustReason] = useState("");
  const [moveToNote, setMoveToNote] = useState("");
  const [moveFieldErrors, setMoveFieldErrors] = useState({});

  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => () => { detailRequestSequenceRef.current += 1; }, []);

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
    closeAdjustNoteSuggestions();
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustNoteGroup("");
    setMoveToNote("");
    setMoveFieldErrors({});
  }

  async function loadProductDetail(sku, options = {}) {
    const requestSequence = ++detailRequestSequenceRef.current;
    closeAdjustNoteSuggestions();
    setIsLoadingDetail(true);
    setError("");
    try {
      const result = await getInventoryCheckProduct(sku);
      if (requestSequence !== detailRequestSequenceRef.current) return null;
      setDetail(result);
      setSelectedSku(result?.product?.sku || sku);
      if (!options.keepForms) resetQuantityForm();
      return result;
    } catch (err) {
      if (requestSequence !== detailRequestSequenceRef.current) return null;
      setDetail(null);
      setSelectedSku("");
      setError(err?.message || "Không thể tải thông tin kiểm hàng.");
      return null;
    } finally {
      if (requestSequence === detailRequestSequenceRef.current) setIsLoadingDetail(false);
    }
  }

  function handleClearSearch() {
    detailRequestSequenceRef.current += 1;
    setIsLoadingDetail(false);
    closeAdjustNoteSuggestions();
    setSearchInput("");
    setDebouncedSearch("");
    setProducts([]);
    setHasFocusedProductSearch(true);
    setIsProductResultsOpen(true);
    setSelectedSku("");
    setDetail(null);
    setSuccess("");
    setError("");
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function handleSelectProduct(product) {
    setHasFocusedProductSearch(false);
    setIsProductResultsOpen(false);
    setRecentProducts(saveRecentItem(RECENT_PRODUCTS_KEY, product, 20));
    loadProductDetail(product.sku);
  }

  function syncAdjustedProduct(updatedProduct) {
    if (!updatedProduct) return;

    setProducts((current) => syncProductInList(current, updatedProduct));
    setActiveProducts((current) => syncProductInList(current, updatedProduct));
    setRecentProducts((current) => {
      const nextItems = syncProductInList(current, updatedProduct);
      if (nextItems !== current) {
        try {
          window.localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(nextItems));
        } catch {
          // Recent products are optional; keep the in-memory update.
        }
      }
      return nextItems;
    });
  }

  const displayProducts = useMemo(() => {
    if (debouncedSearch) return products;
    if (hasFocusedProductSearch) return filterRecentItemsByAvailable(recentProducts, activeProducts);
    return [];
  }, [activeProducts, debouncedSearch, hasFocusedProductSearch, products, recentProducts]);

  const noteGroups = detail?.note_groups || [];
  const adjustNoteSuggestions = getInventoryNoteSuggestions(noteGroups, adjustNoteGroup);
  const showAdjustNoteSuggestions = isAdjustNoteOpen && adjustmentType === "INCREASE"
    && !isLoadingDetail && !isSubmitting && adjustNoteSuggestions.length > 0;

  function closeAdjustNoteSuggestions() {
    setIsAdjustNoteOpen(false);
    setActiveAdjustNoteIndex(-1);
  }

  function openAdjustNoteSuggestions() {
    if (isLoadingDetail || isSubmitting) return;
    setIsAdjustNoteOpen(true);
    setActiveAdjustNoteIndex(-1);
  }

  function handleAdjustNoteChange(event) {
    setAdjustNoteGroup(event.target.value);
    openAdjustNoteSuggestions();
  }

  function selectAdjustNoteSuggestion(note) {
    setAdjustNoteGroup(note);
    closeAdjustNoteSuggestions();
  }

  function handleAdjustNoteKeyDown(event) {
    if (event.nativeEvent?.isComposing || isLoadingDetail || isSubmitting) return;
    if (event.key === "Escape" || event.key === "Tab") {
      closeAdjustNoteSuggestions();
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && adjustNoteSuggestions.length) {
      event.preventDefault();
      setIsAdjustNoteOpen(true);
      const last = adjustNoteSuggestions.length - 1;
      setActiveAdjustNoteIndex((index) => {
        if (!showAdjustNoteSuggestions || index < 0) return event.key === "ArrowDown" ? 0 : last;
        return Math.max(0, Math.min(last, index + (event.key === "ArrowDown" ? 1 : -1)));
      });
    } else if (event.key === "Enter" && showAdjustNoteSuggestions && adjustNoteSuggestions[activeAdjustNoteIndex]) {
      event.preventDefault();
      selectAdjustNoteSuggestion(adjustNoteSuggestions[activeAdjustNoteIndex]);
    }
  }

  function handleAdjustNotePointerDown(event) {
    // Keep mouse focus on the input; touch remains free to scroll the list and tap normally.
    if (event.pointerType === "mouse" && event.button === 0) event.preventDefault();
  }

  useEffect(() => {
    if (!showAdjustNoteSuggestions) return;
    function closeOutside(event) {
      if (!adjustNoteWrapperRef.current?.contains(event.target)) closeAdjustNoteSuggestions();
    }
    // Do not close on input blur: touch may focus an option before its click is dispatched.
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
    };
  }, [showAdjustNoteSuggestions]);

  useEffect(() => {
    const list = adjustNoteListRef.current;
    const option = list?.children[activeAdjustNoteIndex];
    if (!showAdjustNoteSuggestions || !option) return;
    // Scroll only the suggestion list, never the page.
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [activeAdjustNoteIndex, showAdjustNoteSuggestions]);

  const selectedAdjustGroup = useMemo(
    () => noteGroups.find((group) => toGroupValue(group) === adjustNoteGroup) || null,
    [noteGroups, adjustNoteGroup]
  );

  function clearMoveFieldError(field) {
    setMoveFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: "" };
    });
  }

  async function handleNoteMoveSubmit() {
    const fieldErrors = {};
    const numericQuantity = Number(adjustQuantity);

    if (!selectedAdjustGroup) {
      fieldErrors.source = "Vui lòng chọn nhóm hiện tại.";
    }
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      fieldErrors.quantity = "Số lượng chuyển phải là số nguyên dương.";
    } else if (selectedAdjustGroup && numericQuantity > Number(selectedAdjustGroup.quantity || 0)) {
      fieldErrors.quantity = `Số lượng chuyển không được vượt quá ${selectedAdjustGroup.quantity}.`;
    }

    const fromNote = selectedAdjustGroup?.is_no_note ? "" : selectedAdjustGroup?.note || "";
    const toNote = moveToNote.trim();
    if (selectedAdjustGroup && normalizeNoteValue(fromNote) === normalizeNoteValue(toNote)) {
      fieldErrors.destination = "Ghi chú mới phải khác nhóm hiện tại.";
    }

    if (Object.keys(fieldErrors).length) {
      setMoveFieldErrors(fieldErrors);
      return;
    }

    const sku = detail.product.sku;
    const previousTotal = Number(detail.product.total_quantity || 0);
    const requestSequence = detailRequestSequenceRef.current;
    setIsSubmitting(true);
    try {
      const result = await moveInventoryNoteGroup({
        sku,
        from_note: fromNote,
        to_note: toNote,
        quantity: numericQuantity,
        reason: adjustReason.trim() || undefined
      });
      if (requestSequence !== detailRequestSequenceRef.current) return;

      setAdjustNoteGroup("");
      setMoveToNote("");
      setAdjustQuantity("");
      setAdjustReason("");
      setMoveFieldErrors({});

      try {
        const refreshed = await getInventoryCheckProduct(result?.product?.sku || sku);
        if (requestSequence !== detailRequestSequenceRef.current) return;
        setDetail(refreshed);
        setSelectedSku(refreshed?.product?.sku || sku);
        const currentTotal = Number(refreshed?.product?.total_quantity || previousTotal);
        setSuccess(
          `Đã chuyển ${numericQuantity} sản phẩm từ ${getGroupLabel(selectedAdjustGroup)} sang ${
            toNote || "Không ghi chú"
          }. Tổng tồn: ${currentTotal}.`
        );
      } catch {
        if (requestSequence !== detailRequestSequenceRef.current) return;
        setDetail(result || detail);
        setSuccess(
          `Đã chuyển nhóm ghi chú thành công nhưng chưa thể làm mới dữ liệu. Tổng tồn trước thao tác: ${previousTotal}.`
        );
      }
    } catch (err) {
      if (requestSequence !== detailRequestSequenceRef.current) return;
      const code = err?.payload?.error?.code;
      if (code === "SAME_NOTE_GROUP") {
        setMoveFieldErrors((prev) => ({ ...prev, destination: "Ghi chú mới phải khác nhóm hiện tại." }));
      } else if (code === "INSUFFICIENT_NOTE_GROUP_STOCK") {
        setMoveFieldErrors((prev) => ({
          ...prev,
          quantity: "Số lượng chuyển vượt quá tồn của nhóm hiện tại."
        }));
      } else if (code === "SOURCE_NOTE_GROUP_NOT_FOUND") {
        setMoveFieldErrors((prev) => ({ ...prev, source: "Nhóm hiện tại không còn tồn hoặc không tồn tại." }));
      } else {
        setError(err?.message || "Chuyển nhóm ghi chú thất bại.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuantitySubmit(event) {
    event.preventDefault();
    closeAdjustNoteSuggestions();
    setError("");
    setSuccess("");

    if (!detail?.product?.sku) {
      setError("Vui lòng chọn sản phẩm trước.");
      return;
    }

    if (adjustmentType === "MOVE_NOTE") {
      await handleNoteMoveSubmit();
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

    let requestSequence = detailRequestSequenceRef.current;
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
      if (requestSequence !== detailRequestSequenceRef.current) return;

      const refreshPromise = loadProductDetail(result?.product?.sku || detail.product.sku, { keepForms: true });
      requestSequence = detailRequestSequenceRef.current;
      const refreshed = await refreshPromise;
      if (requestSequence !== detailRequestSequenceRef.current) return;
      const nextDetail =
        refreshed || {
          ...detail,
          product: result?.product || detail.product,
          note_groups: result?.note_groups || detail.note_groups,
          recent_quantity_adjustments:
            result?.recent_quantity_adjustments || detail.recent_quantity_adjustments
        };
      setDetail(nextDetail);
      syncAdjustedProduct(nextDetail?.product);
      setAdjustQuantity("");
      setAdjustReason("");
      setSuccess(
        `${getQuantityAdjustLabel(adjustmentType)} thành công. Tồn hiện tại: ${
          result?.adjustment?.current_total_quantity ?? result?.product?.total_quantity ?? "-"
        }.`
      );
    } catch (err) {
      if (requestSequence !== detailRequestSequenceRef.current) return;
      setError(err?.message || "Điều chỉnh số lượng thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const recentQuantityAdjustments = detail?.recent_quantity_adjustments || [];
  const recentNoteAdjustments = detail?.recent_adjustments || [];

  return (
    <section className="inventory-check-container min-w-0 max-w-full space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Kiểm hàng</h2>
        <p className="mt-1 text-sm text-slate-600">Kiểm tra tồn kho và điều chỉnh số lượng thực tế.</p>
      </div>

      <div className="inventory-check-primary-grid min-w-0 max-w-full gap-4">
        <section className="min-w-0 max-w-full">
          <div className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Tìm sản phẩm</h3>
            <label className="mt-3 mb-1 block text-sm font-medium text-slate-700">
              Tìm sản phẩm theo tên hoặc SKU
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                className="h-10 w-full min-w-0 max-w-full rounded-md border border-slate-300 px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Nhập tên sản phẩm hoặc SKU"
                value={searchInput}
                onFocus={() => {
                  setHasFocusedProductSearch(true);
                  setIsProductResultsOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setHasFocusedProductSearch(false);
                    setIsProductResultsOpen(false);
                  }
                }}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setHasFocusedProductSearch(true);
                  setIsProductResultsOpen(true);
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

            {isProductResultsOpen && isSearching && (
              <p className="mt-3 text-sm text-slate-500">Đang tìm sản phẩm...</p>
            )}

            {isProductResultsOpen && !isSearching && debouncedSearch && products.length === 0 && (
              <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">Không tìm thấy sản phẩm phù hợp.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Nếu đang kiểm hàng thực tế và sản phẩm chưa có trong hệ thống, hãy thêm sản phẩm trước rồi quay lại kiểm hàng.
                </p>
                <Link
                  to={`/admin/products/new?name=${encodeURIComponent(debouncedSearch)}`}
                  className="mt-3 inline-flex h-9 items-center rounded-md border border-brand-600 px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  + Thêm sản phẩm mới
                </Link>
              </div>
            )}

            {isProductResultsOpen && displayProducts.length > 0 && (
              <div className="mt-3 min-w-0 max-w-full divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
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
                      <div className="flex min-w-0 max-w-full items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-sm font-semibold text-slate-900">{product.name}</p>
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

        <aside className="inventory-check-detail min-w-0 max-w-full">
          <div className="inventory-check-detail-card min-w-0 max-w-full rounded-lg border border-slate-200 bg-white shadow-sm">
            {!detail ? (
              <div className="p-4">
                <h3 className="text-base font-semibold text-slate-900">Điều chỉnh số lượng</h3>
                <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  Chọn sản phẩm bên trái để kiểm hàng.
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inventory-check-product-summary min-w-0 max-w-full gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 break-words text-xl font-bold text-slate-900">{detail.product.name}</p>
                      <p className="inventory-check-sku mt-1 min-w-0 text-xs font-medium text-slate-500">SKU: {detail.product.sku}</p>
                    </div>
                    <div className="inventory-check-stock-summary rounded-md border border-blue-100 bg-white shadow-sm">
                      <p className="inventory-check-stock-label text-slate-500">Tồn hiện tại</p>
                      <p className="inventory-check-stock-value text-brand-800">
                        {Number(detail.product.total_quantity || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3">
                  <div className="flex min-w-0 max-w-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">Nhóm bảo hành / ghi chú</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Dùng để chọn đúng nhóm khi giảm tồn hoặc đổi ghi chú bảo hành.
                      </p>
                    </div>
                    {/* TODO: hiển thị cảnh báo lệch tổng nhóm/tồn kho khi backend expose inventory_warning sau. */}
                  </div>

                  {noteGroups.length > 0 ? (
                    <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
                      {noteGroups.map((group) => (
                        <div key={toGroupValue(group)} className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_72px] items-center gap-3 px-3 py-2 hover:bg-slate-50">
                          <p className="inventory-check-sku min-w-0 text-sm font-medium text-slate-800">{getGroupLabel(group)}</p>
                          <p className="rounded bg-blue-50 px-2 py-1 text-right text-sm font-bold tabular-nums text-brand-800">
                            {group.quantity}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                      Sản phẩm chưa có nhóm ghi chú tồn kho.
                    </p>
                  )}
                </div>

                <form
                  className="min-w-0 max-w-full space-y-3 border-t border-slate-200 px-4 py-4"
                  onSubmit={handleQuantitySubmit}
                  noValidate
                >
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Điều chỉnh số lượng</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Chọn loại điều chỉnh, nhập số lượng và nhóm bảo hành liên quan.</p>
                  </div>

                  <div className="inventory-check-form-grid min-w-0 max-w-full gap-3">
                    <div className="min-w-0 max-w-full">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Loại điều chỉnh *</label>
                      <select
                        className="h-10 w-full min-w-0 max-w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        value={adjustmentType}
                        onChange={(event) => {
                          closeAdjustNoteSuggestions();
                          setAdjustmentType(event.target.value);
                          setAdjustNoteGroup("");
                          setAdjustQuantity("");
                          setAdjustReason("");
                          setMoveToNote("");
                          setMoveFieldErrors({});
                        }}
                      >
                        <option value="INCREASE">Tăng tồn</option>
                        <option value="DECREASE">Giảm tồn</option>
                        <option value="MOVE_NOTE">Đổi ghi chú bảo hành</option>
                      </select>
                    </div>

                    <div className="min-w-0 max-w-full">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng *</label>
                      <input
                        type="number"
                        min={1}
                        max={
                          ["DECREASE", "MOVE_NOTE"].includes(adjustmentType) && selectedAdjustGroup
                            ? selectedAdjustGroup.quantity
                            : undefined
                        }
                        step={1}
                        className={[
                          "h-10 w-full min-w-0 max-w-full rounded-md border px-3 text-sm font-semibold tabular-nums outline-none focus:ring-2",
                          moveFieldErrors.quantity
                            ? "border-red-400 focus:ring-red-500"
                            : "border-slate-300 focus:ring-brand-500"
                        ].join(" ")}
                        value={adjustQuantity}
                        onChange={(event) => {
                          setAdjustQuantity(event.target.value);
                          clearMoveFieldError("quantity");
                        }}
                        placeholder="Nhập số lượng"
                      />
                      {moveFieldErrors.quantity && (
                        <p className="mt-1 text-xs font-medium text-red-600">{moveFieldErrors.quantity}</p>
                      )}
                    </div>
                  </div>

                  {adjustmentType === "INCREASE" ? (
                    <div className="min-w-0 max-w-full">
                      <label htmlFor="inventory-adjust-note" className="mb-1 block text-sm font-medium text-slate-700">
                        Nhóm bảo hành / ghi chú
                      </label>
                      <div ref={adjustNoteWrapperRef} className="relative min-w-0 max-w-full">
                        <input
                          id="inventory-adjust-note"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={showAdjustNoteSuggestions}
                          aria-controls={showAdjustNoteSuggestions ? "inventory-adjust-note-options" : undefined}
                          aria-activedescendant={showAdjustNoteSuggestions && activeAdjustNoteIndex >= 0
                            ? `inventory-adjust-note-option-${activeAdjustNoteIndex}` : undefined}
                          className="h-10 w-full min-w-0 max-w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                          value={adjustNoteGroup}
                          onFocus={openAdjustNoteSuggestions}
                          onClick={openAdjustNoteSuggestions}
                          onChange={handleAdjustNoteChange}
                          onKeyDown={handleAdjustNoteKeyDown}
                          autoCapitalize="off"
                          autoCorrect="off"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="Ví dụ: BH 12.28, để trống nếu không ghi chú"
                        />
                        {showAdjustNoteSuggestions && (
                          <div
                            id="inventory-adjust-note-options"
                            ref={adjustNoteListRef}
                            role="listbox"
                            aria-label="Nhóm bảo hành / ghi chú hiện có"
                            className="absolute inset-x-0 top-full z-30 mt-1 max-h-24 overflow-y-auto overscroll-contain rounded-md border border-slate-200 bg-white py-1 shadow-lg"
                          >
                            {adjustNoteSuggestions.map((note, index) => (
                              <button
                                key={note}
                                id={`inventory-adjust-note-option-${index}`}
                                type="button"
                                role="option"
                                aria-selected={activeAdjustNoteIndex === index}
                                tabIndex={-1}
                                onPointerDown={handleAdjustNotePointerDown}
                                onClick={() => selectAdjustNoteSuggestion(note)}
                                className={`block min-h-11 w-full whitespace-normal px-3 py-2 text-left text-sm text-slate-800 [overflow-wrap:anywhere] hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${activeAdjustNoteIndex === index ? "bg-blue-50" : "bg-white"}`}
                              >
                                {note}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Để trống nếu tăng vào nhóm Không ghi chú.</p>
                    </div>
                  ) : adjustmentType === "DECREASE" ? (
                    <div className="min-w-0 max-w-full">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Nhóm bảo hành / ghi chú *
                      </label>
                      <select
                        className="h-10 w-full min-w-0 max-w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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
                  ) : (
                    <div className="inventory-check-form-grid min-w-0 max-w-full gap-3">
                      <div className="min-w-0 max-w-full">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Nhóm hiện tại *</label>
                        <select
                          className={[
                            "h-10 w-full min-w-0 max-w-full rounded-md border px-3 text-sm outline-none focus:ring-2",
                            moveFieldErrors.source
                              ? "border-red-400 focus:ring-red-500"
                              : "border-slate-300 focus:ring-brand-500"
                          ].join(" ")}
                          value={adjustNoteGroup}
                          onChange={(event) => {
                            setAdjustNoteGroup(event.target.value);
                            clearMoveFieldError("source");
                            clearMoveFieldError("destination");
                          }}
                        >
                          <option value="">-- Chọn nhóm nguồn --</option>
                          {noteGroups.map((group) => (
                            <option key={toGroupValue(group)} value={toGroupValue(group)}>
                              {getGroupLabel(group)} - còn {group.quantity}
                            </option>
                          ))}
                        </select>
                        {moveFieldErrors.source && (
                          <p className="mt-1 text-xs font-medium text-red-600">{moveFieldErrors.source}</p>
                        )}
                      </div>

                      <div className="min-w-0 max-w-full">
                        <label className="mb-1 block text-sm font-medium text-slate-700">Ghi chú mới</label>
                        <input
                          list="inventory-note-group-options"
                          className={[
                            "h-10 w-full min-w-0 max-w-full rounded-md border px-3 text-sm outline-none focus:ring-2",
                            moveFieldErrors.destination
                              ? "border-red-400 focus:ring-red-500"
                              : "border-slate-300 focus:ring-brand-500"
                          ].join(" ")}
                          value={moveToNote}
                          onChange={(event) => {
                            setMoveToNote(event.target.value);
                            clearMoveFieldError("destination");
                          }}
                          autoCapitalize="off"
                          autoCorrect="off"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={500}
                          placeholder="Ví dụ: BH 06/2027"
                        />
                        <datalist id="inventory-note-group-options">
                          {noteGroups
                            .filter((group) => !group.is_no_note && group.note)
                            .map((group) => (
                              <option key={toGroupValue(group)} value={group.note} />
                            ))}
                        </datalist>
                        {moveFieldErrors.destination ? (
                          <p className="mt-1 text-xs font-medium text-red-600">{moveFieldErrors.destination}</p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">
                            Có thể chọn nhóm hiện có, nhập ghi chú mới hoặc để trống để chuyển sang Không ghi chú.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="min-w-0 max-w-full">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Lý do</label>
                    <input
                      className="h-10 w-full min-w-0 max-w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={adjustReason}
                      onChange={(event) => setAdjustReason(event.target.value)}
                      maxLength={500}
                      placeholder="Ví dụ: Tồn đầu kỳ, kiểm kho thiếu"
                    />
                  </div>

                  {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                  {success && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isLoadingDetail ||
                      (["DECREASE", "MOVE_NOTE"].includes(adjustmentType) && noteGroups.length === 0)
                    }
                    className="h-10 w-full min-w-0 max-w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? "Đang xử lý..."
                      : adjustmentType === "MOVE_NOTE"
                        ? "Xác nhận chuyển nhóm"
                        : "Lưu điều chỉnh"}
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </div>

      {recentNoteAdjustments.length > 0 && (
        <section className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Lịch sử chuyển nhóm ghi chú gần đây</h3>
          <div className="inventory-check-table-scroll mt-3 min-w-0 max-w-full overflow-x-auto rounded-md border border-slate-200">
            <table className="w-max min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Ngày giờ</th>
                  <th className="px-3 py-2 font-medium">Từ nhóm</th>
                  <th className="px-3 py-2 font-medium">Sang nhóm</th>
                  <th className="px-3 py-2 font-medium">Số lượng</th>
                  <th className="px-3 py-2 font-medium">Lý do</th>
                  <th className="px-3 py-2 font-medium">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentNoteAdjustments.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-700">{formatDateTime(item.occurred_at)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatWarrantyNote(item.from_note || "")}</td>
                    <td className="px-3 py-2 text-slate-700">{formatWarrantyNote(item.to_note || "")}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{item.quantity}</td>
                    <td className="px-3 py-2 text-slate-700">{item.reason || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{item.created_by_admin?.username || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {recentQuantityAdjustments.length > 0 && (
        <section className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Lịch sử điều chỉnh số lượng gần đây</h3>
          <div className="inventory-check-table-scroll mt-3 min-w-0 max-w-full overflow-x-auto rounded-md border border-slate-200">
            <table className="w-max min-w-full divide-y divide-slate-200 text-sm">
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
