import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CustomerSelector } from "../components/CustomerSelector";
import {
  bulkStockOutRequest,
  getProductInventoryRequest,
  listActiveCategories,
  listActiveProducts
} from "../services/inventoryOperations.service";
import { formatWarrantyNote } from "../utils/warrantyNote";

const NO_NOTE_WARRANTY_VALUE = "__NO_NOTE__";

function stripDiacritics(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D");
}

function normalizeText(value) {
  return stripDiacritics(value).trim().toLowerCase();
}

function normalizeWarrantyValue(value) {
  if (value === NO_NOTE_WARRANTY_VALUE) return NO_NOTE_WARRANTY_VALUE;
  return (value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function getCategoryName(product, categories) {
  if (product?.category?.name) return product.category.name;
  const match = categories.find((item) => Number(item.id) === Number(product?.category_id));
  return match?.name || "-";
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

export function StockOutBulkPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [inventoryBySku, setInventoryBySku] = useState({});
  const [loadingInventorySku, setLoadingInventorySku] = useState("");
  const [draftQuantities, setDraftQuantities] = useState({});
  const [cartItems, setCartItems] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setIsLoading(true);
      setError("");
      try {
        const [productItems, categoryItems] = await Promise.all([listActiveProducts(), listActiveCategories()]);
        if (!active) return;
        setProducts(productItems);
        setCategories(categoryItems);
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

  const filteredProducts = useMemo(() => {
    const keyword = normalizeText(debouncedSearch);
    if (!keyword) return [];

    return products
      .filter((item) => {
        const sku = normalizeText(item.sku);
        const name = normalizeText(item.name);
        const categoryName = normalizeText(getCategoryName(item, categories));
        return sku.includes(keyword) || name.includes(keyword) || categoryName.includes(keyword);
      })
      .slice(0, 12);
  }, [products, categories, debouncedSearch]);

  useEffect(() => {
    let active = true;

    async function loadVisibleInventories() {
      for (const product of filteredProducts) {
        if (!active) return;
        if (inventoryBySku[product.sku]) continue;

        setLoadingInventorySku(product.sku);
        try {
          const inventory = await getProductInventoryRequest(product.sku);
          if (!active) return;
          const apiGroups = (inventory?.note_groups || []).map(buildGroupFromApi).filter((group) => group.quantity > 0);
          const groups =
            apiGroups.length > 0 ? apiGroups : [buildFallbackNoNoteGroup(product)].filter((group) => group.quantity > 0);
          setInventoryBySku((prev) => ({
            ...prev,
            [product.sku]: groups
          }));
        } catch {
          if (!active) return;
          setInventoryBySku((prev) => ({
            ...prev,
            [product.sku]: []
          }));
        } finally {
          if (active) setLoadingInventorySku("");
        }
      }
    }

    loadVisibleInventories();
    return () => {
      active = false;
    };
  }, [filteredProducts, inventoryBySku]);

  const showNoResultState = !isLoading && debouncedSearch.length > 0 && filteredProducts.length === 0;
  const showEmptyState = !isLoading && products.length === 0;
  const totalCartQuantity = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  function getDraftQuantity(product, group) {
    return Number(draftQuantities[getCartKey(product.sku, group)] || 1);
  }

  function setDraftQuantity(product, group, quantity) {
    const maxQuantity = Number(group.quantity || 0);
    const nextQuantity = Math.max(1, Math.min(Number(quantity || 1), maxQuantity || 1));
    setDraftQuantities((prev) => ({
      ...prev,
      [getCartKey(product.sku, group)]: String(nextQuantity)
    }));
  }

  function handleAddToCart(product, group) {
    const quantity = getDraftQuantity(product, group);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Số lượng xuất phải là số nguyên dương.");
      return;
    }
    if (quantity > Number(group.quantity || 0)) {
      setError(`Số lượng xuất vượt quá tồn của nhóm ${formatWarrantyNote(group.label)}.`);
      return;
    }

    const cartKey = getCartKey(product.sku, group);
    setCartItems((prev) => {
      const existing = prev.find((item) => item.cartKey === cartKey);
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + quantity, Number(group.quantity || 0));
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
          maxQuantity: Number(group.quantity || 0),
          quantity
        }
      ];
    });
    setError("");
    setSuccess("");
  }

  function removeCartItem(cartKey) {
    setCartItems((prev) => prev.filter((item) => item.cartKey !== cartKey));
    setSuccess("");
  }

  function handleClearProductSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setSuccess("");
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function validateCart() {
    if (cartItems.length === 0) {
      return "Vui lòng thêm ít nhất một sản phẩm vào danh sách giao hàng.";
    }

    for (const [index, item] of cartItems.entries()) {
      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
        return `Dòng ${index + 1}: số lượng xuất phải là số nguyên dương.`;
      }
      if (Number(item.quantity) > Number(item.maxQuantity || 0)) {
        return `Dòng ${index + 1}: số lượng xuất vượt quá tồn của nhóm ${formatWarrantyNote(item.warrantyLabel)}.`;
      }
    }

    return "";
  }

  async function reloadProducts() {
    const productItems = await listActiveProducts();
    setProducts(productItems);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateCart();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      ...(selectedCustomer?.id ? { customer_id: Number(selectedCustomer.id) } : {}),
      items: cartItems.map((item) => ({
        sku: item.sku,
        quantity: Number(item.quantity),
        warranty_note: item.warrantyNote
      }))
    };

    setIsSubmitting(true);
    try {
      const result = await bulkStockOutRequest(payload);
      await reloadProducts();
      setSelectedCustomer(null);
      setSearchInput("");
      setDebouncedSearch("");
      setInventoryBySku({});
      setDraftQuantities({});
      setCartItems([]);
      setSuccess(`Xuất & giao hàng thành công ${result?.items?.length || payload.items.length} dòng sản phẩm.`);
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } catch (err) {
      setError(err?.message || "Xuất & giao hàng thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Xuất & Giao hàng</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Chọn khách hàng, thêm nhiều sản phẩm và chọn đúng nhóm bảo hành cho từng dòng giao hàng.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-800">Thông tin khách hàng</h3>
          <div className="[&>div]:mt-2 [&>div]:rounded-md [&>div]:p-3">
            <CustomerSelector selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-800">Thông tin sản phẩm</h3>
          <label className="mt-2 mb-1 block text-xs font-medium text-slate-600">
            Tìm sản phẩm theo tên hoặc SKU
          </label>
          <div className="relative">
            <input
              ref={searchInputRef}
              className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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
                onClick={handleClearProductSearch}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            )}
          </div>

          {isLoading && <p className="mt-2 text-xs text-slate-500">Đang tải dữ liệu sản phẩm...</p>}

          {!isLoading && filteredProducts.length > 0 && (
            <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
              {filteredProducts.map((product) => {
                const groups = inventoryBySku[product.sku] || [];
                const isLoadingGroups = loadingInventorySku === product.sku && !inventoryBySku[product.sku];

                return (
                  <article key={product.id} className="bg-white p-2.5">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug text-slate-900">{product.name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="break-all">SKU: {product.sku}</span>
                          <span>Danh mục: {getCategoryName(product, categories)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-brand-800 sm:pt-0.5">
                        Tồn: {Number(product.total_quantity || 0)}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {isLoadingGroups && <p className="text-xs text-slate-500">Đang tải nhóm bảo hành...</p>}
                      {!isLoadingGroups && groups.length === 0 && (
                        <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                          Sản phẩm chưa có tồn khả dụng để xuất.
                        </p>
                      )}
                      {groups.map((group) => {
                        const quantity = getDraftQuantity(product, group);
                        const disabled = Number(group.quantity || 0) <= 0;

                        return (
                          <div
                            key={group.value}
                            className="flex flex-col gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 md:flex-row md:items-center"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="break-all text-sm font-medium text-slate-900">
                                {formatWarrantyNote(group.label)}
                              </p>
                            </div>
                            <p className="shrink-0 text-xs font-medium text-slate-500 md:w-14">còn {group.quantity}</p>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={disabled || quantity <= 1}
                                onClick={() => setDraftQuantity(product, group, quantity - 1)}
                                className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-base font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 md:h-7 md:w-7"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={group.quantity}
                                value={quantity}
                                onChange={(event) => setDraftQuantity(product, group, event.target.value)}
                                className="h-9 w-14 rounded border border-slate-300 px-1.5 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-500 md:h-7 md:w-11"
                              />
                              <button
                                type="button"
                                disabled={disabled || quantity >= Number(group.quantity || 0)}
                                onClick={() => setDraftQuantity(product, group, quantity + 1)}
                                className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-base font-semibold text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 md:h-7 md:w-7"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleAddToCart(product, group)}
                                className="h-9 rounded bg-brand-700 px-3 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50 md:h-7 md:text-xs"
                              >
                                Thêm
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {(showEmptyState || showNoResultState) && (
            <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2.5">
              <p className="text-sm text-slate-700">
                Không tìm thấy sản phẩm. Vui lòng tạo sản phẩm ở mục Sản phẩm trước.
              </p>
              <Link
                to="/admin/products"
                className="mt-2 inline-flex rounded border border-brand-600 px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                Đi tới Sản phẩm
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Danh sách giao hàng</h3>
              <p className="mt-0.5 text-xs text-slate-500">Mỗi dòng sẽ tạo một giao dịch xuất kho riêng.</p>
            </div>
            <div className="rounded bg-slate-50 px-2 py-1 text-sm text-slate-700">
              <span className="font-semibold">{cartItems.length}</span> dòng ·{" "}
              <span className="font-semibold">{totalCartQuantity}</span> sản phẩm
            </div>
          </div>

          {cartItems.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-sm text-slate-600">
              Chưa có sản phẩm nào trong danh sách giao hàng. Tìm sản phẩm và bấm Thêm ở đúng nhóm bảo hành.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
              {cartItems.map((item) => (
                <div
                  key={item.cartKey}
                  className="grid gap-1.5 bg-white p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.product.name}</p>
                    <p className="mt-0.5 break-all text-xs text-slate-500">SKU: {item.sku}</p>
                  </div>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-brand-800">{formatWarrantyNote(item.warrantyLabel)}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    SL: <span className="font-semibold">{item.quantity}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => removeCartItem(item.cartKey)}
                    className="h-8 shrink-0 rounded border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {success && <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={isSubmitting || isLoading || cartItems.length === 0}
            className="mt-3 h-10 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Đang xử lý..." : "Xác nhận xuất & giao hàng"}
          </button>
        </section>
      </form>
    </section>
  );
}
