import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AuthenticatedImage } from "../components/AuthenticatedImage";
import { CustomerSelector } from "../components/CustomerSelector";
import {
  bulkStockOutRequest,
  getProductInventoryRequest,
  listActiveProducts,
  searchActiveProducts
} from "../services/inventoryOperations.service";
import {
  formatMoneyInput,
  handleMoneyInputChange,
  parseMoneyInput
} from "../utils/moneyInput";
import { RECENT_PRODUCTS_KEY, readRecentItems, saveRecentItem } from "../utils/recentItems";
import { formatWarrantyNote } from "../utils/warrantyNote";

const NO_NOTE_WARRANTY_VALUE = "__NO_NOTE__";
const MAX_MONEY_AMOUNT = 999999999999999;
const POS_KEYBOARD_FOCUS_MIN_WIDTH = 960;

function normalizeWarrantyValue(value) {
  if (value === NO_NOTE_WARRANTY_VALUE) return NO_NOTE_WARRANTY_VALUE;
  return (value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function sortAvailableProductsFirst(items) {
  return [...items].sort((left, right) => {
    const leftQuantity = Number(left.total_quantity || 0);
    const rightQuantity = Number(right.total_quantity || 0);
    if (leftQuantity > 0 && rightQuantity <= 0) return -1;
    if (leftQuantity <= 0 && rightQuantity > 0) return 1;
    return 0;
  });
}

function formatSalePrice(value, emptyLabel = "Chưa thiết lập giá") {
  if (value === null || value === undefined) {
    return emptyLabel;
  }

  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

function getReferencePrice(item) {
  const value = item?.product?.sale_price;
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue >= 0 && numberValue <= MAX_MONEY_AMOUNT
    ? numberValue
    : null;
}

function getFinalUnitPrice(item) {
  const referencePrice = getReferencePrice(item);
  if (referencePrice !== null) {
    const discountAmount = Number(item?.discountAmount || 0);
    if (
      !Number.isSafeInteger(discountAmount)
      || discountAmount < 0
      || discountAmount > MAX_MONEY_AMOUNT
      || discountAmount > referencePrice
    ) return null;
    return referencePrice - discountAmount;
  }

  const manualUnitPrice = item?.manualUnitPrice;
  if (manualUnitPrice === null || manualUnitPrice === undefined) return null;
  const numberValue = Number(manualUnitPrice);
  return Number.isSafeInteger(numberValue) && numberValue >= 0 && numberValue <= MAX_MONEY_AMOUNT
    ? numberValue
    : null;
}

function getSafeLineTotal(item) {
  const finalUnitPrice = getFinalUnitPrice(item);
  if (finalUnitPrice === null) {
    return {
      value: null,
      missingPrice: true,
      overflow: false
    };
  }

  const price = Number(finalUnitPrice);
  const quantityValue = Number(item?.quantity);
  if (
    !Number.isSafeInteger(price)
    || price < 0
    || price > MAX_MONEY_AMOUNT
    || !Number.isSafeInteger(quantityValue)
    || quantityValue < 0
  ) {
    return {
      value: null,
      missingPrice: false,
      overflow: true
    };
  }

  if (price !== 0 && quantityValue > Math.floor(MAX_MONEY_AMOUNT / price)) {
    return {
      value: null,
      missingPrice: false,
      overflow: true
    };
  }

  return {
    value: price * quantityValue,
    missingPrice: false,
    overflow: false
  };
}

function getCartLineTotalDisplay(item) {
  const lineTotal = getSafeLineTotal(item);

  if (lineTotal.missingPrice) {
    return {
      label: "Chưa xác định",
      isMuted: true
    };
  }

  if (lineTotal.overflow) {
    return {
      label: "Vượt giới hạn",
      isMuted: true
    };
  }

  return {
    label: formatSalePrice(lineTotal.value),
    isMuted: false
  };
}

function getCartTotalState(items) {
  let total = 0;

  for (const item of items) {
    const lineTotal = getSafeLineTotal(item);
    if (lineTotal.missingPrice) {
      return {
        value: null,
        missingPrice: true,
        overflow: false
      };
    }

    if (lineTotal.overflow || total > MAX_MONEY_AMOUNT - lineTotal.value) {
      return {
        value: null,
        missingPrice: false,
        overflow: true
      };
    }

    total += lineTotal.value;
  }

  return {
    value: total,
    missingPrice: false,
    overflow: false
  };
}

function getCartTotalDisplay(totalState) {
  if (totalState.missingPrice) {
    return {
      label: "Chưa xác định",
      isWarning: true
    };
  }

  if (totalState.overflow) {
    return {
      label: "Vượt giới hạn",
      isWarning: true
    };
  }

  return {
    label: formatSalePrice(totalState.value),
    isWarning: false
  };
}

function hasMoneyInputDigits(value) {
  return /\d/.test(String(value ?? ""));
}

function moneyInputToNumber(value, { emptyValue = 0 } = {}) {
  return parseMoneyInput(value, { emptyValue, max: MAX_MONEY_AMOUNT });
}

function PriceEditor({ item, isOpen, disabled, onOpen, onClose, onApply }) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const referencePrice = getReferencePrice(item);
  const hasReferencePrice = referencePrice !== null;
  const currentValue = hasReferencePrice ? Number(item.discountAmount || 0) : item.manualUnitPrice;
  const [draftValue, setDraftValue] = useState("");
  const [draftError, setDraftError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setDraftValue(currentValue === null || currentValue === undefined ? "" : formatMoneyInput(currentValue));
    setDraftError("");
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [currentValue, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleOutside(event) {
      if (!containerRef.current?.contains(event.target)) onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, onClose]);

  const parsedDraft = moneyInputToNumber(draftValue, { emptyValue: hasReferencePrice ? 0 : null });
  const hasDraftDigits = hasMoneyInputDigits(draftValue);
  const previewPrice = hasReferencePrice && parsedDraft !== null
    ? referencePrice - parsedDraft
    : parsedDraft;

  function applyDraft() {
    if (parsedDraft === null) {
      if (!hasReferencePrice && !hasDraftDigits) {
        onApply({ discountAmount: 0, manualUnitPrice: null });
        return;
      }
      setDraftError("Giá trị tiền vượt giới hạn hỗ trợ.");
      return;
    }
    if (hasReferencePrice && parsedDraft > referencePrice) {
      setDraftError("Chiết khấu không được lớn hơn giá tham chiếu.");
      return;
    }
    onApply(hasReferencePrice
      ? { discountAmount: parsedDraft, manualUnitPrice: null }
      : { discountAmount: 0, manualUnitPrice: parsedDraft });
  }

  return (
    <div ref={containerRef} className="relative text-right">
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="w-full rounded px-1 py-1 text-right hover:bg-blue-50 disabled:cursor-not-allowed"
      >
        {getFinalUnitPrice(item) === null ? (
          <span className="text-[12px] font-semibold text-amber-700">Chưa thiết lập</span>
        ) : (
          <>
            <span className="block text-[12px] font-semibold tabular-nums text-slate-900">
              {formatSalePrice(hasReferencePrice ? referencePrice : getFinalUnitPrice(item))}
            </span>
            {hasReferencePrice && Number(item.discountAmount || 0) > 0 && (
              <span className="block text-[10px] font-medium tabular-nums text-red-600">
                −{formatSalePrice(item.discountAmount)}
              </span>
            )}
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-40 mt-1 w-80 rounded-md border border-slate-200 bg-white p-4 text-left shadow-xl">
          <p className="text-sm font-semibold text-slate-900">Thông tin giá</p>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Giá tham chiếu</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {formatSalePrice(referencePrice, "Chưa thiết lập")}
              </span>
            </div>
            <label className="block">
              <span className="mb-1 block text-slate-600">
                {hasReferencePrice ? "Chiết khấu" : "Giá bán thực tế"}
              </span>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                value={draftValue}
                onChange={(event) => {
                  handleMoneyInputChange(event, setDraftValue);
                  setDraftError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyDraft();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    onClose();
                  }
                }}
                className="h-10 w-full rounded border border-slate-300 px-3 text-right font-semibold tabular-nums outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <div className="flex justify-between gap-4 border-t border-slate-100 pt-3">
              <span className="text-slate-500">Đơn giá sau giảm</span>
              <span className={`font-bold tabular-nums ${previewPrice !== null && previewPrice >= 0 ? "text-slate-950" : "text-red-600"}`}>
                {previewPrice !== null && previewPrice >= 0
                  ? formatSalePrice(previewPrice)
                  : hasReferencePrice || hasDraftDigits ? "Không hợp lệ" : "Chưa thiết lập"}
              </span>
            </div>
            {draftError && <p className="text-xs font-medium text-red-600">{draftError}</p>}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Thoát
            </button>
            <button type="button" onClick={applyDraft} className="rounded bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-900">
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildGroupFromApi(item) {
  const isNoNote = Boolean(item?.is_no_note || !item?.note);
  return {
    note: item?.note || "",
    label: item?.label || item?.note || "Không ghi chú",
    value: isNoNote ? NO_NOTE_WARRANTY_VALUE : item.note,
    normalizedValue: isNoNote ? NO_NOTE_WARRANTY_VALUE : normalizeWarrantyValue(item.note),
    isNoNote,
    quantity: Number(item?.quantity || 0)
  };
}

function buildFallbackNoNoteGroup(product) {
  return {
    note: "",
    label: "Không ghi chú",
    value: NO_NOTE_WARRANTY_VALUE,
    normalizedValue: NO_NOTE_WARRANTY_VALUE,
    isNoNote: true,
    quantity: Number(product?.total_quantity || 0)
  };
}

function getCartKey(sku, group) {
  return `${sku}::${group.normalizedValue}`;
}

function createEmptyOrder(orderNumber) {
  return {
    id: orderNumber,
    label: `Đơn ${orderNumber}`,
    cartItems: [],
    selectedCustomer: null,
    orderNote: ""
  };
}

function hasOrderDraft(order) {
  return Boolean(order?.cartItems?.length || order?.selectedCustomer || order?.orderNote?.trim());
}

export function StockOutBulkPage() {
  const posShellRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orders, setOrders] = useState(() => [createEmptyOrder(1)]);
  const [activeOrderId, setActiveOrderId] = useState(1);
  const [nextOrderNumber, setNextOrderNumber] = useState(2);
  const [searchInput, setSearchInput] = useState("");
  const dropdownContainerRef = useRef(null);
  const orderTabRefs = useRef({});
  const searchInputRef = useRef(null);
  const canAutoFocusProductSearchRef = useRef(false);
  const suppressDropdownOnFocusRef = useRef(false);
  const productSearchRequestRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchProducts, setSearchProducts] = useState([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [productSearchError, setProductSearchError] = useState("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState(() => readRecentItems(RECENT_PRODUCTS_KEY));
  const [inventoryBySku, setInventoryBySku] = useState({});
  const [loadingInventorySku, setLoadingInventorySku] = useState("");
  const [activeProductSku, setActiveProductSku] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activePriceEditorKey, setActivePriceEditorKey] = useState("");

  const activeOrder = useMemo(
    () => orders.find((order) => order.id === activeOrderId) || orders[0],
    [activeOrderId, orders]
  );
  const cartItems = activeOrder?.cartItems || [];
  const selectedCustomer = activeOrder?.selectedCustomer || null;
  const orderNote = activeOrder?.orderNote || "";

  useEffect(() => {
    const shell = posShellRef.current;
    if (!shell) return undefined;

    const finePointerQuery = window.matchMedia?.("(pointer: fine)");
    const updateFocusEligibility = () => {
      canAutoFocusProductSearchRef.current = Boolean(
        finePointerQuery?.matches
        && shell.getBoundingClientRect().width >= POS_KEYBOARD_FOCUS_MIN_WIDTH
      );
    };

    updateFocusEligibility();

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateFocusEligibility)
      : null;
    resizeObserver?.observe(shell);

    if (!resizeObserver) {
      window.addEventListener("resize", updateFocusEligibility);
    }

    if (typeof finePointerQuery?.addEventListener === "function") {
      finePointerQuery.addEventListener("change", updateFocusEligibility);
    } else {
      finePointerQuery?.addListener?.(updateFocusEligibility);
    }

    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) {
        window.removeEventListener("resize", updateFocusEligibility);
      }
      if (typeof finePointerQuery?.removeEventListener === "function") {
        finePointerQuery.removeEventListener("change", updateFocusEligibility);
      } else {
        finePointerQuery?.removeListener?.(updateFocusEligibility);
      }
      canAutoFocusProductSearchRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setError("");
      try {
        const productItems = await listActiveProducts();
        if (!active) return;
        setProducts(productItems);
      } catch (err) {
        if (active) setError(err?.message || "Không thể tải dữ liệu sản phẩm.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!products.length) return;
    const availableById = new Map(products.map((item) => [String(item.id), item]));
    const activeRecentProducts = readRecentItems(RECENT_PRODUCTS_KEY)
      .map((item) => availableById.get(String(item.id)) || item)
      .filter((item) => item?.is_active !== false)
      .slice(0, 20);
    setRecentProducts(activeRecentProducts);
    try {
      window.localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(activeRecentProducts));
    } catch {
      // Recent products chỉ là tăng tốc thao tác, lỗi lưu localStorage không ảnh hưởng nghiệp vụ.
    }
  }, [products]);

  useEffect(() => {
    function handleClickOutside(event) {
      const target = event.target;
      const container = dropdownContainerRef.current;
      const isInsideDropdownContainer = Boolean(container?.contains(target));

      if (!isInsideDropdownContainer) {
        setIsProductDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const keyword = debouncedSearch.trim();
    if (!keyword) {
      productSearchRequestRef.current += 1;
      setSearchProducts([]);
      setIsSearchingProducts(false);
      setProductSearchError("");
      return;
    }

    const requestId = productSearchRequestRef.current + 1;
    productSearchRequestRef.current = requestId;
    setIsSearchingProducts(true);
    setProductSearchError("");
    setSearchProducts([]);

    searchActiveProducts(keyword, 12)
      .then((items) => {
        if (productSearchRequestRef.current !== requestId) return;
        setSearchProducts(sortAvailableProductsFirst(items));
      })
      .catch((err) => {
        if (productSearchRequestRef.current !== requestId) return;
        setSearchProducts([]);
        setProductSearchError(err?.message || "Không thể tải kết quả tìm kiếm sản phẩm.");
      })
      .finally(() => {
        if (productSearchRequestRef.current === requestId) {
          setIsSearchingProducts(false);
        }
      });
  }, [debouncedSearch]);

  const isWaitingForProductSearch = searchInput.trim() !== debouncedSearch;

  const displayProducts = useMemo(() => {
    if (!isProductDropdownOpen) return [];
    if (searchInput.trim()) {
      if (isWaitingForProductSearch) return [];
      return searchProducts;
    }
    return sortAvailableProductsFirst(recentProducts.filter((item) => item?.is_active !== false)).slice(0, 20);
  }, [isProductDropdownOpen, isWaitingForProductSearch, recentProducts, searchInput, searchProducts]);

  useEffect(() => {
    if (!displayProducts.length) {
      setActiveProductSku("");
      return;
    }

    const hasActiveProduct = displayProducts.some((product) => product.sku === activeProductSku);
    if (!hasActiveProduct) setActiveProductSku(displayProducts[0].sku);
  }, [activeProductSku, displayProducts]);

  useEffect(() => {
    orderTabRefs.current[activeOrderId]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeOrderId, orders.length]);

  useEffect(() => {
    setActivePriceEditorKey("");
  }, [activeOrderId]);

  useEffect(() => {
    let active = true;

    async function loadVisibleInventories() {
      for (const product of displayProducts) {
        if (!active) return;
        if (inventoryBySku[product.sku]) continue;

        setLoadingInventorySku(product.sku);
        try {
          const inventory = await getProductInventoryRequest(product.sku);
          if (!active) return;
          const apiGroups = (inventory?.note_groups || []).map(buildGroupFromApi).filter((group) => group.quantity > 0);
          const groups = apiGroups.length > 0
            ? apiGroups
            : [buildFallbackNoNoteGroup(product)].filter((group) => group.quantity > 0);
          setInventoryBySku((prev) => ({ ...prev, [product.sku]: groups }));
        } catch {
          if (!active) return;
          setInventoryBySku((prev) => ({ ...prev, [product.sku]: [] }));
        } finally {
          if (active) setLoadingInventorySku("");
        }
      }
    }

    loadVisibleInventories();
    return () => {
      active = false;
    };
  }, [displayProducts, inventoryBySku]);

  const showSearchLoadingState = Boolean(
    isProductDropdownOpen
    && searchInput.trim()
    && (isWaitingForProductSearch || isSearchingProducts)
  );
  const showSearchErrorState = Boolean(
    isProductDropdownOpen
    && searchInput.trim()
    && !isWaitingForProductSearch
    && !isSearchingProducts
    && productSearchError
  );
  const showNoResultState = Boolean(
    !isLoading
    && debouncedSearch.length > 0
    && !isWaitingForProductSearch
    && !isSearchingProducts
    && !productSearchError
    && searchProducts.length === 0
  );
  const showEmptyState = !isLoading && !searchInput.trim() && products.length === 0;
  const totalCartQuantity = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const cartTotalDisplay = getCartTotalDisplay(getCartTotalState(cartItems));

  function resetSharedSearchState() {
    productSearchRequestRef.current += 1;
    setSearchInput("");
    setDebouncedSearch("");
    setSearchProducts([]);
    setIsSearchingProducts(false);
    setProductSearchError("");
    setIsProductDropdownOpen(false);
    suppressDropdownOnFocusRef.current = false;
  }

  function updateActiveOrder(updater) {
    setOrders((prev) => prev.map((order) => (
      order.id === activeOrderId ? { ...order, ...updater(order) } : order
    )));
  }

  function setActiveOrderCartItems(updater) {
    updateActiveOrder((order) => ({
      cartItems: typeof updater === "function" ? updater(order.cartItems) : updater
    }));
  }

  function setActiveOrderSelectedCustomer(customer) {
    if (isSubmitting) return;
    updateActiveOrder(() => ({ selectedCustomer: customer }));
    setSuccess("");
  }

  function updateActiveOrderNote(note) {
    if (isSubmitting) return;
    updateActiveOrder(() => ({ orderNote: note }));
    setError("");
    setSuccess("");
  }

  function clearOrder(orderId) {
    setOrders((prev) => prev.map((order) => (
      order.id === orderId
        ? { ...order, cartItems: [], selectedCustomer: null, orderNote: "" }
        : order
    )));
  }

  function handleCreateOrder() {
    if (isSubmitting) return;
    const newOrder = createEmptyOrder(nextOrderNumber);
    setOrders((prev) => [...prev, newOrder]);
    setActiveOrderId(newOrder.id);
    setNextOrderNumber((current) => current + 1);
    resetSharedSearchState();
    setError("");
    setSuccess("");
    focusProductSearch();
  }

  function handleSwitchOrder(orderId) {
    if (isSubmitting) return;
    if (orderId === activeOrderId) return;
    setActiveOrderId(orderId);
    resetSharedSearchState();
    setError("");
    setSuccess("");
    focusProductSearch();
  }

  function handleCloseOrder(orderId) {
    if (isSubmitting) return;
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    if (hasOrderDraft(order)) {
      const shouldClose = window.confirm("Đơn này chưa được lưu. Bạn có chắc muốn đóng đơn?");
      if (!shouldClose) return;
    }

    if (orders.length === 1) {
      clearOrder(orderId);
      resetSharedSearchState();
      setError("");
      setSuccess("");
      focusProductSearch();
      return;
    }

    const orderIndex = orders.findIndex((item) => item.id === orderId);
    const remainingOrders = orders.filter((item) => item.id !== orderId);
    setOrders(remainingOrders);
    if (activeOrderId === orderId) {
      const nextActiveOrder = remainingOrders[Math.max(0, orderIndex - 1)] || remainingOrders[0];
      setActiveOrderId(nextActiveOrder.id);
    }
    resetSharedSearchState();
    setError("");
    setSuccess("");
    focusProductSearch();
  }

  function focusProductSearch({ showDropdown = false, force = false } = {}) {
    if (showDropdown) setIsProductDropdownOpen(true);
    if (!force && !canAutoFocusProductSearchRef.current) return;

    suppressDropdownOnFocusRef.current = !showDropdown;
    window.setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 0);
  }

  function resetProductSearchAfterAdd() {
    productSearchRequestRef.current += 1;
    suppressDropdownOnFocusRef.current = false;
    setSearchInput("");
    setDebouncedSearch("");
    setSearchProducts([]);
    setIsSearchingProducts(false);
    setProductSearchError("");
    setIsProductDropdownOpen(false);
    setActiveProductSku("");
    focusProductSearch();
    window.setTimeout(() => {
      setIsProductDropdownOpen(false);
    }, 80);
  }

  function handleAddToCart(product, group) {
    if (isSubmitting) return;
    const maxQuantity = Number(group.quantity || 0);
    if (maxQuantity <= 0) {
      setError(`Nhóm ${formatWarrantyNote(group.label)} không còn tồn khả dụng để bán.`);
      return;
    }

    setRecentProducts(saveRecentItem(RECENT_PRODUCTS_KEY, product, 20));
    const cartKey = getCartKey(product.sku, group);
    setActiveOrderCartItems((prev) => {
      const existing = prev.find((item) => item.cartKey === cartKey);
      if (existing) {
        if (Number(existing.quantity || 0) >= maxQuantity) return prev;
        const nextQuantity = Math.min(Number(existing.quantity || 0) + 1, maxQuantity);
        return prev.map((item) => (item.cartKey === cartKey ? { ...item, quantity: nextQuantity } : item));
      }

      return [
        ...prev,
        {
          cartKey,
          product,
          sku: product.sku,
          warrantyNote: group.isNoNote ? NO_NOTE_WARRANTY_VALUE : group.note,
          warrantyLabel: group.label,
          maxQuantity,
          quantity: 1,
          discountAmount: 0,
          manualUnitPrice: null,
          saleNote: ""
        }
      ];
    });
    setError("");
    setSuccess("");
    resetProductSearchAfterAdd();
  }

  function removeCartItem(cartKey) {
    if (isSubmitting) return;
    setActiveOrderCartItems((prev) => prev.filter((item) => item.cartKey !== cartKey));
    setSuccess("");
  }

  function clampCartQuantity(item, quantity) {
    const maxQuantity = Math.max(1, Number(item.maxQuantity || 1));
    const parsedQuantity = Number.parseInt(quantity, 10);
    if (!Number.isFinite(parsedQuantity)) return 1;
    return Math.max(1, Math.min(parsedQuantity, maxQuantity));
  }

  function updateCartItemQuantity(cartKey, quantity) {
    if (isSubmitting) return;
    setActiveOrderCartItems((prev) => prev.map((item) => (
      item.cartKey === cartKey ? { ...item, quantity: clampCartQuantity(item, quantity) } : item
    )));
    setError("");
    setSuccess("");
  }

  function updateCartItemSaleNote(cartKey, saleNote) {
    if (isSubmitting) return;
    setActiveOrderCartItems((prev) => prev.map((item) => (
      item.cartKey === cartKey ? { ...item, saleNote } : item
    )));
    setError("");
    setSuccess("");
  }

  function updateCartItemPrice(cartKey, priceState) {
    if (isSubmitting) return;
    setActiveOrderCartItems((prev) => prev.map((item) => (
      item.cartKey === cartKey ? { ...item, ...priceState } : item
    )));
    setActivePriceEditorKey("");
    setError("");
    setSuccess("");
  }

  function clearCartWithConfirm() {
    if (isSubmitting) return;
    if (cartItems.length === 0) return;
    const shouldClear = window.confirm("Hệ thống sẽ không lưu lại thông tin của đơn bán này. Bạn có chắc chắn muốn xóa toàn bộ sản phẩm không?");
    if (!shouldClear) return;
    setActiveOrderCartItems([]);
    setError("");
    setSuccess("");
    focusProductSearch();
  }

  function handleClearProductSearch() {
    productSearchRequestRef.current += 1;
    setSearchInput("");
    setDebouncedSearch("");
    setSearchProducts([]);
    setIsSearchingProducts(false);
    setProductSearchError("");
    setIsProductDropdownOpen(true);
    setSuccess("");
    focusProductSearch({ showDropdown: true });
  }

  function validateCart() {
    if (cartItems.length === 0) {
      return "Vui lòng thêm ít nhất một sản phẩm vào đơn bán tại quầy.";
    }

    if (typeof orderNote === "string" && orderNote.trim().length > 500) {
      return "Ghi chú đơn hàng không được vượt quá 500 ký tự.";
    }

    for (const [index, item] of cartItems.entries()) {
      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
        return `Dòng ${index + 1}: số lượng bán phải là số nguyên dương.`;
      }
      if (Number(item.quantity) > Number(item.maxQuantity || 0)) {
        return `Dòng ${index + 1}: số lượng bán vượt quá tồn của nhóm ${formatWarrantyNote(item.warrantyLabel)}.`;
      }
      if (typeof item.saleNote === "string" && item.saleNote.length > 500) {
        return `Dòng ${index + 1}: Serial / Ghi chú không được vượt quá 500 ký tự.`;
      }
      const referencePrice = getReferencePrice(item);
      const hasConfiguredReferencePrice =
        item.product?.sale_price !== null && item.product?.sale_price !== undefined;
      if (hasConfiguredReferencePrice && referencePrice === null) {
        return `Dòng ${index + 1}: giá tham chiếu vượt giới hạn hỗ trợ.`;
      }
      if (referencePrice !== null) {
        const discountAmount = Number(item.discountAmount || 0);
        if (
          !Number.isSafeInteger(discountAmount)
          || discountAmount < 0
          || discountAmount > MAX_MONEY_AMOUNT
          || discountAmount > referencePrice
        ) {
          return `Dòng ${index + 1}: chiết khấu không hợp lệ.`;
        }
      } else if (
        item.manualUnitPrice !== null
        && item.manualUnitPrice !== undefined
        && getFinalUnitPrice(item) === null
      ) {
        return `Dòng ${index + 1}: giá bán thực tế không hợp lệ.`;
      }
      if (getSafeLineTotal(item).overflow) {
        return `Dòng ${index + 1}: thành tiền vượt giới hạn hỗ trợ.`;
      }
    }

    if (getCartTotalState(cartItems).overflow) {
      return "Tổng tiền vượt giới hạn hỗ trợ.";
    }

    return "";
  }

  async function reloadProducts() {
    const productItems = await listActiveProducts();
    setProducts(productItems);
  }

  async function submitOrder({ printAfterSuccess = false, printTab = null } = {}) {
    if (isSubmitting || submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    let shouldRefocusAfterSuccess = false;
    setError("");
    setSuccess("");
    const submittedOrderId = activeOrderId;

    const validationError = validateCart();
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedOrderNote = typeof orderNote === "string" ? orderNote.trim() : "";
    const payload = {
      ...(selectedCustomer?.id ? { customer_id: Number(selectedCustomer.id) } : {}),
      ...(trimmedOrderNote !== "" ? { note: trimmedOrderNote } : {}),
      items: cartItems.map((item) => {
        const saleNote = typeof item.saleNote === "string" ? item.saleNote.trim() : "";
        return {
          sku: item.sku,
          quantity: Number(item.quantity),
          warranty_note: item.warrantyNote,
          sale_note: saleNote !== "" ? saleNote : null,
          discount_amount: Number(item.discountAmount || 0),
          ...(getReferencePrice(item) === null
            && item.manualUnitPrice !== null
            && item.manualUnitPrice !== undefined
            ? { manual_unit_price: Number(item.manualUnitPrice) }
            : {})
        };
      })
    };

    setIsSubmitting(true);
    try {
      const result = await bulkStockOutRequest(payload);
      setSearchInput("");
      setDebouncedSearch("");
      setIsProductDropdownOpen(false);
      setInventoryBySku({});
      clearOrder(submittedOrderId);
      const voucherText = result?.voucher_code ? ` Mã phiếu: ${result.voucher_code}.` : "";
      if (printAfterSuccess && result?.voucher_id && printTab && !printTab.closed) {
        printTab.location.href = `/admin/transaction-history/${result.voucher_id}/print`;
        setSuccess(`Bán tại quầy thành công ${result?.items?.length || payload.items.length} dòng sản phẩm.${voucherText} Đã mở phiếu in.`);
      } else if (printAfterSuccess) {
        if (printTab && !printTab.closed) {
          printTab.close();
        }
        setSuccess(`Bán tại quầy thành công ${result?.items?.length || payload.items.length} dòng sản phẩm.${voucherText} Không mở được tab in, vui lòng in từ lịch sử giao dịch.`);
      } else {
        setSuccess(`Bán tại quầy thành công ${result?.items?.length || payload.items.length} dòng sản phẩm.${voucherText}`);
      }
      shouldRefocusAfterSuccess = true;

      try {
        await reloadProducts();
      } catch {
        setError("Bán thành công nhưng chưa làm mới tồn kho. Vui lòng tải lại trang.");
      }
    } catch (err) {
      if (printAfterSuccess && printTab && !printTab.closed) {
        printTab.close();
      }
      setError(err?.message || "Bán tại quầy thất bại.");
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
      if (shouldRefocusAfterSuccess) {
        window.setTimeout(() => focusProductSearch(), 0);
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitOrder();
  }

  function handleSubmitAndPrint() {
    if (isSubmitting || isLoading || cartItems.length === 0) return;
    const printTab = window.open("", "_blank");
    if (printTab) {
      printTab.document.title = "Đang tạo phiếu in...";
      printTab.document.body.innerHTML = "<p style=\"font-family: sans-serif; padding: 16px;\">Đang tạo phiếu in...</p>";
    }
    submitOrder({ printAfterSuccess: true, printTab });
  }

  return (
    <div ref={posShellRef} className="pos-shell-container flex w-full min-w-0 max-w-full flex-col bg-slate-100 text-slate-900">
      <form onSubmit={handleSubmit} className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col">
        <header className="pos-header shrink-0 bg-[#0B74E5] text-white shadow-sm">
          <div className="pos-header-layout relative h-full w-full min-w-0 max-w-full bg-[#0B74E5]">
            <Link
              to="/admin"
              aria-label="Về trang quản trị"
              className="pos-header-home flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/20 text-xl text-white/90 hover:bg-white/10"
            >
              🏠
            </Link>
            <div className="pos-header-title shrink-0 text-sm font-semibold tracking-wide text-white/95">Bán tại quầy</div>
            <div ref={dropdownContainerRef} className="pos-product-search relative min-w-0 max-w-full">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">⌕</span>
              <input
                ref={searchInputRef}
                className="h-10 w-full rounded-md border border-white/20 bg-white px-9 pr-10 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="Tìm sản phẩm theo tên hoặc SKU"
                value={searchInput}
                disabled={isSubmitting}
                onFocus={() => {
                  if (isSubmitting) return;
                  if (suppressDropdownOnFocusRef.current) {
                    suppressDropdownOnFocusRef.current = false;
                    setIsProductDropdownOpen(false);
                    return;
                  }
                  setIsProductDropdownOpen(true);
                }}
                onClick={() => {
                  if (!isSubmitting) setIsProductDropdownOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setIsProductDropdownOpen(false);
                }}
                onChange={(event) => {
                  if (isSubmitting) return;
                  setSearchInput(event.target.value);
                  setIsProductDropdownOpen(true);
                  setSuccess("");
                }}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm sản phẩm"
                  disabled={isSubmitting}
                  onClick={handleClearProductSearch}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ×
                </button>
              )}
            {showSearchLoadingState && (
              <div className="pos-product-dropdown absolute inset-x-0 top-12 z-50 rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-500 shadow-xl">
                Đang tìm sản phẩm...
              </div>
            )}

            {showSearchErrorState && (
              <div className="pos-product-dropdown absolute inset-x-0 top-12 z-50 rounded-md border border-red-200 bg-white px-3 py-3 text-sm shadow-xl">
                <p className="font-medium text-red-700">Không thể tải kết quả tìm kiếm.</p>
                <p className="mt-1 text-xs text-slate-500">{productSearchError}</p>
              </div>
            )}

            {isProductDropdownOpen && displayProducts.length > 0 && (
              <div
                className="pos-product-dropdown absolute inset-x-0 top-12 z-50 max-h-[55dvh] overflow-y-auto rounded-md border border-slate-300 bg-white shadow-xl"
              >
                {!debouncedSearch && (
                  <p className="border-b border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-slate-500">
                    Sản phẩm gần đây
                  </p>
                )}
                {displayProducts.map((product) => {
                  const groups = inventoryBySku[product.sku] || [];
                  const isLoadingGroups = loadingInventorySku === product.sku && !inventoryBySku[product.sku];
                  const isActiveProduct = product.sku === activeProductSku;
                  const hasAvailableInventory = Number(product.total_quantity || 0) > 0;

                  return (
                    <article
                      key={product.id}
                      onMouseEnter={() => setActiveProductSku(product.sku)}
                      onFocus={() => setActiveProductSku(product.sku)}
                      className={`border-b border-slate-200 last:border-b-0 transition-colors ${
                        isActiveProduct
                          ? "border-l-2 border-l-brand-600 bg-blue-100/80 shadow-[inset_0_0_0_1px_rgba(11,116,229,0.08)]"
                          : hasAvailableInventory
                            ? "bg-white hover:bg-blue-50"
                            : "bg-slate-50/80 opacity-70 hover:opacity-90"
                      }`}
                    >
                      <div className="grid grid-cols-[38px_minmax(0,1fr)_112px] items-center gap-2 px-3 py-1.5">
                        <AuthenticatedImage
                          path={product.primary_image ? `/admin/products/${product.id}/images/${product.primary_image.id}/thumbnail` : ""}
                          alt={product.name}
                          className="h-9 w-9 rounded border border-slate-200 object-contain"
                        />
                        <div className="min-w-0">
                          <p className={`line-clamp-2 break-words text-[13px] font-semibold [overflow-wrap:anywhere] ${hasAvailableInventory ? "text-slate-900" : "text-slate-500"}`}>{product.name}</p>
                          <p className={`break-all text-[11px] ${hasAvailableInventory ? "text-slate-500" : "text-slate-400"}`}>{product.sku}</p>
                        </div>
                        <div className="text-right text-[11px] text-slate-500">
                          <p className={`font-semibold ${hasAvailableInventory ? "text-slate-800" : "text-slate-400"}`}>Tồn: {Number(product.total_quantity || 0)}</p>
                          <p
                            className={`truncate text-[10.5px] font-semibold ${
                              product.sale_price === null || product.sale_price === undefined ? "text-slate-400" : "text-slate-700"
                            }`}
                          >
                            {formatSalePrice(product.sale_price)}
                          </p>
                          {!hasAvailableInventory && <p className="text-[10.5px] text-slate-400">hết hàng</p>}
                        </div>
                      </div>

                      {isActiveProduct && (
                        <div className="border-t border-slate-100 px-3 py-1">
                          {isLoadingGroups && <p className="py-0.5 text-[11px] text-slate-500">Đang tải nhóm bảo hành...</p>}
                          {!isLoadingGroups && groups.length === 0 && (
                            <p className="py-0.5 text-[11px] text-slate-400">Không có tồn khả dụng để bán.</p>
                          )}
                          <div className="space-y-0.5">
                            {groups.map((group) => {
                              const cartKey = getCartKey(product.sku, group);
                              const existingCartItem = cartItems.find((item) => item.cartKey === cartKey);
                              const selectedQuantity = Number(existingCartItem?.quantity || 0);
                              const maxQuantity = Number(group.quantity || 0);
                              const hasSelected = selectedQuantity > 0;
                              const isFullySelected = hasSelected && selectedQuantity >= maxQuantity;
                              const disabled = isSubmitting || maxQuantity <= 0 || isFullySelected;

                              return (
                                <div
                                  key={group.value}
                                  className={`grid grid-cols-[minmax(0,1fr)_124px_64px] items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-5 ${
                                    isFullySelected ? "bg-slate-100 opacity-75" : hasSelected ? "bg-blue-100/80" : "hover:bg-white"
                                  }`}
                                >
                                  <span className={`truncate font-semibold ${isFullySelected ? "text-slate-600" : "text-slate-900"}`}>{formatWarrantyNote(group.label)}</span>
                                  <span className={`truncate text-right ${hasSelected ? "font-medium text-brand-700" : "text-slate-500"}`}>
                                    còn {group.quantity}{hasSelected ? ` · đã chọn ${selectedQuantity}` : ""}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handleAddToCart(product, group)}
                                    title={isFullySelected ? "Đã chọn đủ tồn" : undefined}
                                    aria-label={isFullySelected ? `Đã chọn đủ tồn ${formatWarrantyNote(group.label)}` : undefined}
                                    className="h-5 rounded border border-brand-200 bg-brand-50 px-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-600"
                                  >
                                    {isFullySelected ? "✓ Đã chọn đủ" : hasSelected ? "+1" : "Thêm"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {isProductDropdownOpen && !showSearchLoadingState && !showSearchErrorState && (showEmptyState || showNoResultState) && (
              <div
                className="pos-product-dropdown absolute inset-x-0 top-12 z-50 rounded-md border border-slate-300 bg-white p-2.5 text-sm shadow-xl"
              >
                <p className="text-slate-700">Không tìm thấy sản phẩm. Vui lòng thêm sản phẩm ở mục Sản phẩm trước.</p>
                <Link to="/admin/products" className="mt-2 inline-flex rounded border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
                  Đi tới Sản phẩm
                </Link>
              </div>
            )}
            </div>

            <div className="pos-order-tabs flex h-full min-w-0 items-end overflow-x-auto border-l border-[#0b67c7] bg-[#0B74E5]">
              {orders.map((order) => {
                const isActiveOrder = order.id === activeOrderId;
                return (
                  <div
                    key={order.id}
                    ref={(element) => {
                      if (element) orderTabRefs.current[order.id] = element;
                    }}
                    className={`group flex h-full min-w-[92px] shrink-0 items-center border-r border-[#0b67c7] transition-colors ${
                      isActiveOrder ? "bg-white text-slate-900 shadow-sm" : "bg-[#0B74E5] text-white hover:bg-[#0966ca]"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSwitchOrder(order.id)}
                      className="flex h-full min-w-0 flex-1 items-center px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                      aria-current={isActiveOrder ? "page" : undefined}
                    >
                      {order.label}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCloseOrder(order.id);
                      }}
                      className={`mr-1 flex h-5 w-5 items-center justify-center rounded text-sm leading-none transition-opacity ${
                        isActiveOrder
                          ? "text-slate-400 opacity-100 hover:bg-slate-100 hover:text-red-600"
                          : "text-white/90 opacity-0 hover:bg-white/15 hover:text-white group-hover:opacity-100"
                      }`}
                      aria-label={`Đóng ${order.label}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button type="button" disabled={isSubmitting} onClick={handleCreateOrder} className="flex h-full w-14 shrink-0 items-center justify-center border-r border-[#0b67c7] bg-[#0B74E5] text-3xl font-light text-white shadow-inner hover:bg-[#0966ca] disabled:cursor-not-allowed disabled:opacity-60" aria-label="Tạo đơn mới">
                +
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="relative min-h-0 overflow-hidden bg-white">

            <div className="h-full overflow-auto">
              {cartItems.length === 0 ? (
                <div className="flex min-h-full flex-col items-center justify-center px-4 pb-20 text-center text-slate-500">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h6.9a2 2 0 0 0 1.9-1.4L20 8H7" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20h.01M17 20h.01" />
                    </svg>
                  </div>
                  <p className="text-base font-medium text-slate-700">Tìm và chọn sản phẩm để bắt đầu bán hàng.</p>
                  <p className="mt-1 text-sm text-slate-500">Sản phẩm sẽ được thêm vào đơn theo từng nhóm bảo hành / ghi chú.</p>
                  <button type="button" disabled={isSubmitting} onClick={() => focusProductSearch({ showDropdown: true, force: true })} className="mt-3 rounded-md border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                    Thêm sản phẩm ngay
                  </button>
                </div>
              ) : (
                <div className="min-w-[960px] pb-14">
                  <div className="grid grid-cols-[minmax(220px,1fr)_112px_150px_104px_132px_120px_32px] items-center gap-2 border-b border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Sản phẩm</span>
                    <span>SKU</span>
                    <span>Nhóm bảo hành / ghi chú</span>
                    <span className="text-right">Đơn giá</span>
                    <span className="text-right">Số lượng</span>
                    <span className="text-right">Thành tiền</span>
                    <span></span>
                  </div>
                  {cartItems.map((item) => {
                    const lineTotal = getCartLineTotalDisplay(item);
                    const saleNoteWidth = `${Math.min(Math.max((item.saleNote || "").length + 3, 12), 38)}ch`;
                    const saleNoteRows = Math.min(Math.max(Math.ceil(((item.saleNote || "").length + 3) / 38), 1), 4);

                    return (
                      <div key={item.cartKey} className="border-b border-slate-200 text-sm hover:bg-blue-50/60">
                        <div className="grid grid-cols-[minmax(220px,1fr)_112px_150px_104px_132px_120px_32px] items-center gap-2 px-3 py-1.5">
                          <div className="flex min-w-0 items-start gap-2">
                            <AuthenticatedImage
                              path={item.product?.primary_image ? `/admin/products/${item.product.id}/images/${item.product.primary_image.id}/thumbnail` : ""}
                              alt={item.product.name}
                              className="h-9 w-9 shrink-0 rounded border border-slate-200 object-contain"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-slate-900">{item.product.name}</p>
                              <textarea
                                value={item.saleNote || ""}
                                maxLength={500}
                                disabled={isSubmitting}
                                onChange={(event) => updateCartItemSaleNote(item.cartKey, event.target.value)}
                                placeholder="Serial / Ghi chú"
                                aria-label={`Serial / Ghi chú ${item.product.name}`}
                                rows={saleNoteRows}
                                style={{ width: saleNoteWidth, minWidth: "3cm", maxWidth: "100%" }}
                                className="mt-1 min-h-7 resize-none overflow-y-auto rounded border border-slate-200 bg-white px-2 py-1 text-[12px] leading-4 text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                              />
                            </div>
                          </div>
                          <div className="min-w-0 break-all text-[12px] font-medium leading-4 text-slate-600" title={item.sku}>
                            {item.sku}
                          </div>
                          <div className="min-w-0 truncate rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-brand-800" title={formatWarrantyNote(item.warrantyLabel)}>
                            {formatWarrantyNote(item.warrantyLabel)}
                          </div>
                          <PriceEditor
                            item={item}
                            isOpen={activePriceEditorKey === item.cartKey}
                            disabled={isSubmitting}
                            onOpen={() => setActivePriceEditorKey(item.cartKey)}
                            onClose={() => setActivePriceEditorKey("")}
                            onApply={(priceState) => updateCartItemPrice(item.cartKey, priceState)}
                          />
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={isSubmitting || Number(item.quantity) <= 1}
                              onClick={() => updateCartItemQuantity(item.cartKey, Number(item.quantity) - 1)}
                              className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              -
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={item.quantity}
                              disabled={isSubmitting}
                              onChange={(event) => updateCartItemQuantity(item.cartKey, event.target.value)}
                              onBlur={(event) => updateCartItemQuantity(item.cartKey, event.target.value)}
                              className="h-8 w-14 min-w-[3.5rem] rounded border border-slate-300 bg-white px-1 text-center text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:text-slate-950 focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                              aria-label={`Số lượng ${item.product.name} ${formatWarrantyNote(item.warrantyLabel)}`}
                            />
                            <button
                              type="button"
                              disabled={isSubmitting || Number(item.quantity) >= Number(item.maxQuantity || 0)}
                              onClick={() => updateCartItemQuantity(item.cartKey, Number(item.quantity) + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          <div className={`text-right text-[12px] font-semibold tabular-nums ${lineTotal.isMuted ? "text-slate-400" : "text-slate-900"}`}>
                            {lineTotal.label}
                          </div>
                          <button type="button" disabled={isSubmitting} onClick={() => removeCartItem(item.cartKey)} className="flex h-8 w-8 items-center justify-center rounded text-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Xóa sản phẩm">
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-slate-50 px-2.5 py-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={isSubmitting} onClick={() => focusProductSearch({ showDropdown: true, force: true })} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                  Thêm sản phẩm
                </button>
                <button type="button" onClick={clearCartWithConfirm} disabled={isSubmitting || cartItems.length === 0} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
                  Xóa toàn bộ sản phẩm
                </button>
              </div>
            </div>
          </main>

          <aside className="flex min-h-0 flex-col border-l border-slate-300 bg-white">
            <div className="border-b border-slate-200 p-3">
              <CustomerSelector selectedCustomer={selectedCustomer} onSelect={setActiveOrderSelectedCustomer} variant="pos" disabled={isSubmitting} />
            </div>

            <div className="flex-1 overflow-auto p-3">
              <div className="mb-3">
                <label htmlFor="pos-order-note" className="mb-1 block text-sm font-semibold text-slate-700">
                  Ghi chú đơn hàng
                </label>
                <textarea
                  id="pos-order-note"
                  value={orderNote}
                  onChange={(event) => updateActiveOrderNote(event.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={isSubmitting}
                  placeholder="Nhập ghi chú chung cho đơn..."
                  className="block w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">{orderNote.length}/500</p>
              </div>

              <div className="divide-y divide-slate-200 border-y border-slate-200 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>Tổng số dòng</span>
                  <span className="font-semibold text-slate-900">{cartItems.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>Tổng số lượng</span>
                  <span className="font-semibold text-slate-900">{totalCartQuantity}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>Tổng tiền</span>
                  <span className={`text-right text-base font-bold tabular-nums ${cartTotalDisplay.isWarning ? "text-amber-700" : "text-slate-950"}`}>
                    {cartTotalDisplay.label}
                  </span>
                </div>
              </div>

              {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {success && <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}
            </div>

            <div className="sticky bottom-0 shrink-0 space-y-2 border-t border-slate-300 bg-white p-2.5">
              <button
                type="button"
                onClick={handleSubmitAndPrint}
                disabled={isSubmitting || isLoading || cartItems.length === 0}
                className="h-10 w-full rounded-md border border-brand-700 bg-white px-5 text-sm font-bold uppercase tracking-wide text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang xử lý..." : "Bán & In phiếu"}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoading || cartItems.length === 0}
                className="h-11 w-full rounded-md bg-brand-700 px-5 text-base font-bold uppercase tracking-wide text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang xử lý..." : "Hoàn tất bán hàng"}
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
