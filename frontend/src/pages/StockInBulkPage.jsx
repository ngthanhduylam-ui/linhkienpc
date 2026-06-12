import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SupplierSelector } from "../components/SupplierSelector";
import {
  bulkStockInRequest,
  listActiveCategories,
  listActiveProducts
} from "../services/inventoryOperations.service";
import { RECENT_PRODUCTS_KEY, filterRecentItemsByAvailable, readRecentItems, saveRecentItem } from "../utils/recentItems";

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

function getCategoryName(product, categories) {
  if (product?.category?.name) return product.category.name;
  const match = categories.find((item) => Number(item.id) === Number(product?.category_id));
  return match?.name || "-";
}

function createRowId(product) {
  return `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCreateProductUrl(searchInput) {
  const name = searchInput.trim();
  return name ? `/admin/products/new?name=${encodeURIComponent(name)}` : "/admin/products/new";
}

export function StockInBulkPage() {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const rowNoteRefs = useRef({});
  const rowQuantityRefs = useRef({});
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasFocusedProductSearch, setHasFocusedProductSearch] = useState(false);
  const [recentProducts, setRecentProducts] = useState(() => readRecentItems(RECENT_PRODUCTS_KEY));
  const [items, setItems] = useState([]);
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

  useEffect(() => {
    if (!products.length) return;
    const activeRecentProducts = filterRecentItemsByAvailable(readRecentItems(RECENT_PRODUCTS_KEY), products).slice(0, 20);
    setRecentProducts(activeRecentProducts);
    try {
      window.localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(activeRecentProducts));
    } catch {
      // Recent products are an optional speed-up; ignore storage failures.
    }
  }, [products]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!dropdownRef.current || dropdownRef.current.contains(event.target)) return;
      setHasFocusedProductSearch(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      .slice(0, 14);
  }, [products, categories, debouncedSearch]);

  const displayProducts = useMemo(() => {
    if (debouncedSearch) return filteredProducts;
    if (hasFocusedProductSearch) return filterRecentItemsByAvailable(recentProducts, products).slice(0, 14);
    return [];
  }, [debouncedSearch, filteredProducts, hasFocusedProductSearch, products, recentProducts]);

  const totalRowsQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const showProductDropdown =
    hasFocusedProductSearch && !isLoading && (displayProducts.length > 0 || debouncedSearch.length > 0 || products.length === 0);
  const showNoResultState = !isLoading && debouncedSearch.length > 0 && filteredProducts.length === 0;

  function handleAddProduct(product) {
    const rowId = createRowId(product);
    setRecentProducts(saveRecentItem(RECENT_PRODUCTS_KEY, product, 20));
    setItems((prev) => [
      ...prev,
      {
        rowId,
        product,
        sku: product.sku,
        quantity: "1",
        note: ""
      }
    ]);
    setSearchInput("");
    setDebouncedSearch("");
    setHasFocusedProductSearch(false);
    setSuccess("");
    setError("");
    window.setTimeout(() => rowNoteRefs.current[rowId]?.focus() || rowQuantityRefs.current[rowId]?.focus(), 0);
  }

  function handleClearProductSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setSuccess("");
    setHasFocusedProductSearch(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function updateItem(rowId, changes) {
    setItems((prev) => prev.map((item) => (item.rowId === rowId ? { ...item, ...changes } : item)));
    setSuccess("");
  }

  function removeItem(rowId) {
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
    delete rowNoteRefs.current[rowId];
    delete rowQuantityRefs.current[rowId];
    setSuccess("");
  }

  function handleNoteKeyDown(event, rowId) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    rowQuantityRefs.current[rowId]?.focus();
  }

  function handleQuantityKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    setHasFocusedProductSearch(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function validateItems() {
    if (items.length === 0) {
      return "Vui lòng thêm ít nhất một sản phẩm vào phiếu nhập.";
    }

    for (const [index, item] of items.entries()) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return `Dòng ${index + 1}: số lượng nhập phải là số nguyên dương.`;
      }
      if (item.note && item.note.length > 500) {
        return `Dòng ${index + 1}: ghi chú không được vượt quá 500 ký tự.`;
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
    if (isSubmitting) return;
    setError("");
    setSuccess("");

    const validationError = validateItems();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      ...(selectedSupplier?.id ? { supplier_id: Number(selectedSupplier.id) } : {}),
      items: items.map((item) => ({
        sku: item.sku,
        quantity: Number(item.quantity),
        note: item.note.trim() || undefined
      }))
    };

    setIsSubmitting(true);
    try {
      const result = await bulkStockInRequest(payload);
      await reloadProducts();
      setSelectedSupplier(null);
      setSearchInput("");
      setDebouncedSearch("");
      setItems([]);
      setSuccess(`Nhập hàng thành công ${result?.items?.length || payload.items.length} dòng sản phẩm.`);
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } catch (err) {
      setError(err?.message || "Nhập hàng thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-5rem)] bg-slate-100">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Nhập hàng</h2>
              <p className="mt-0.5 text-sm text-slate-500">Tạo phiếu nhập kho theo nhà cung cấp và nhóm bảo hành.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/admin/products")}
                className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Thoát
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoading || items.length === 0}
                className="h-10 rounded-md bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang xử lý..." : "Nhập hàng"}
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-6">
          {(error || success) && (
            <div className="mx-auto mb-4 max-w-7xl">
              {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">{error}</p>}
              {success && <p className="rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-sm">{success}</p>}
            </div>
          )}

          <div className="mx-auto max-w-7xl space-y-4">
              <section className="rounded-md border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-base font-semibold text-slate-900">Thông tin nhà cung cấp</h3>
                </div>
                <div className="px-5 py-4">
                  <SupplierSelector selectedSupplier={selectedSupplier} onSelect={setSelectedSupplier} />
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h3 className="text-base font-semibold text-slate-900">Thông tin sản phẩm</h3>
                </div>

                <div className="p-5">
                  <div ref={dropdownRef} className="relative">
                    <input
                      ref={searchInputRef}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white px-4 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      placeholder="Tìm theo tên sản phẩm hoặc SKU"
                      value={searchInput}
                      onFocus={() => setHasFocusedProductSearch(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setHasFocusedProductSearch(false);
                      }}
                      onChange={(event) => {
                        setSearchInput(event.target.value);
                        setHasFocusedProductSearch(true);
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

                    {showProductDropdown && (
                      <div className="absolute left-0 right-0 z-20 mt-1 max-h-[52vh] overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl">
                        <Link
                          to={getCreateProductUrl(searchInput)}
                          className="flex items-center gap-2 border-b border-slate-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-blue-100"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-500 text-base leading-none">+</span>
                          <span>Thêm mới sản phẩm</span>
                        </Link>

                        {!debouncedSearch && displayProducts.length > 0 && (
                          <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Sản phẩm gần đây
                          </p>
                        )}

                        {isLoading && <p className="px-4 py-3 text-sm text-slate-500">Đang tải dữ liệu sản phẩm...</p>}

                        {!isLoading && displayProducts.length === 0 && (
                          <div className="px-4 py-3">
                            <p className="text-sm text-slate-600">Không tìm thấy sản phẩm phù hợp.</p>
                          </div>
                        )}

                        {displayProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleAddProduct(product)}
                            className="block w-full border-b border-slate-100 bg-white px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50"
                          >
                            <div className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-4">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">{product.sku}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[11px] text-slate-500">Tồn hiện tại</p>
                                <p className="text-sm font-semibold tabular-nums text-slate-900">{Number(product.total_quantity || 0)}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {showNoResultState && !showProductDropdown && (
                    <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                      <p className="text-sm text-slate-700">Không tìm thấy sản phẩm phù hợp.</p>
                      <Link
                        to={getCreateProductUrl(searchInput)}
                        className="mt-2 inline-flex rounded border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                      >
                        + Thêm mới sản phẩm
                      </Link>
                    </div>
                  )}

                  <div className="mt-5 rounded-md border border-slate-200">
                    <div>
                      <div className="grid grid-cols-[minmax(220px,1.25fr)_minmax(130px,0.5fr)_minmax(240px,1fr)_120px_48px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
                        <span>Tên sản phẩm</span>
                        <span>SKU</span>
                        <span>Nhóm bảo hành / ghi chú</span>
                        <span className="text-right">Số lượng</span>
                        <span className="text-center">Xóa</span>
                      </div>

                      {items.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                          <p className="text-sm font-medium text-slate-700">Chưa có sản phẩm trong phiếu nhập.</p>
                          <p className="mt-1 text-sm text-slate-500">Tìm sản phẩm ở ô phía trên để thêm vào danh sách nhập hàng.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {items.map((item) => (
                            <div
                              key={item.rowId}
                              className="grid grid-cols-[minmax(220px,1.25fr)_minmax(130px,0.5fr)_minmax(240px,1fr)_120px_48px] items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50/50"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{item.product.name}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">{getCategoryName(item.product, categories)}</p>
                              </div>
                              <p className="truncate text-sm text-slate-600" title={item.sku}>
                                {item.sku}
                              </p>
                              <input
                                ref={(element) => {
                                  if (element) rowNoteRefs.current[item.rowId] = element;
                                }}
                                className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                value={item.note}
                                onChange={(event) => updateItem(item.rowId, { note: event.target.value })}
                                onKeyDown={(event) => handleNoteKeyDown(event, item.rowId)}
                                autoCapitalize="off"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="Ví dụ: BH 12.28, để trống nếu không ghi chú"
                              />
                              <input
                                ref={(element) => {
                                  if (element) rowQuantityRefs.current[item.rowId] = element;
                                }}
                                type="number"
                                min={1}
                                step={1}
                                className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                value={item.quantity}
                                onChange={(event) => updateItem(item.rowId, { quantity: event.target.value })}
                                onKeyDown={handleQuantityKeyDown}
                                placeholder="SL"
                              />
                              <button
                                type="button"
                                onClick={() => removeItem(item.rowId)}
                                className="mx-auto flex h-8 w-8 items-center justify-center rounded text-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Xóa sản phẩm"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                      <div>
                        <span className="text-slate-500">Tổng số dòng: </span>
                        <span className="font-semibold tabular-nums text-slate-900">{items.length}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Tổng số lượng: </span>
                        <span className="font-semibold tabular-nums text-slate-900">{totalRowsQuantity}</span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || isLoading || items.length === 0}
                      className="h-10 rounded-md bg-brand-700 px-6 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Đang xử lý..." : "Nhập hàng"}
                    </button>
                  </div>
                </div>
              </section>
          </div>
        </div>
      </form>
    </section>
  );
}
