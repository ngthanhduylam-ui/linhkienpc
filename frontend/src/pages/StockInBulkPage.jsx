import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SupplierSelector } from "../components/SupplierSelector";
import { StockInNoteInput } from "../components/StockInNoteInput";
import {
  bulkStockInRequest,
  listActiveCategories,
  listActiveProducts,
  listProductsPage
} from "../services/inventoryOperations.service";
import { RECENT_PRODUCTS_KEY, filterRecentItemsByAvailable, readRecentItems, saveRecentItem } from "../utils/recentItems";

const STOCK_IN_SEARCH_PAGE_SIZE = 14;

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
  const selectedProductsGridHeaderRef = useRef(null);
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
  const [productSearch, setProductSearch] = useState({
    query: "", items: [], page: 0, totalPages: 1, loading: false, error: ""
  });
  const [searchPage, setSearchPage] = useState(1);
  const [searchRetry, setSearchRetry] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const keyword = searchInput.trim();
    if (!keyword || keyword !== debouncedSearch) return;
    let active = true;
    setProductSearch((current) => ({
      query: keyword,
      items: searchPage > 1 && current.query === keyword ? current.items : [],
      page: searchPage - 1,
      totalPages: current.query === keyword ? current.totalPages : 1,
      loading: true,
      error: ""
    }));

    // Search the full catalogue on the server, not the recent-products preload.
    // Stock In intentionally includes zero-stock products (no POS in_stock flag).
    listProductsPage({ keyword, page: searchPage, limit: STOCK_IN_SEARCH_PAGE_SIZE, is_active: true })
      .then((result) => {
        if (!active) return;
        setProductSearch((current) => {
          const candidates = searchPage === 1 ? result.items : [...current.items, ...result.items];
          const seen = new Set();
          return {
            query: keyword,
            items: candidates.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            }),
            page: searchPage,
            totalPages: Number(result.meta.total_pages || 1),
            loading: false,
            error: ""
          };
        });
      })
      .catch(() => {
        if (!active) return;
        setProductSearch((current) => ({
          ...current, loading: false, error: "Không thể tìm sản phẩm. Vui lòng thử lại."
        }));
      });
    // Also invalidate immediately on raw input changes, before the next debounce.
    return () => { active = false; };
  }, [searchInput, debouncedSearch, searchPage, searchRetry]);

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

  const searchKeyword = searchInput.trim();
  const hasSearchQuery = searchKeyword.length > 0;
  const isCurrentSearch = productSearch.query === searchKeyword && debouncedSearch === searchKeyword;
  const searchError = isCurrentSearch ? productSearch.error : "";
  const isSearching = hasSearchQuery && (!isCurrentSearch || productSearch.loading ||
    (!searchError && productSearch.page !== searchPage));
  const displayProducts = useMemo(() => {
    if (hasSearchQuery) return isCurrentSearch ? productSearch.items : [];
    if (hasFocusedProductSearch) return filterRecentItemsByAvailable(recentProducts, products).slice(0, 14);
    return [];
  }, [hasSearchQuery, isCurrentSearch, productSearch.items, hasFocusedProductSearch, products, recentProducts]);

  const totalRowsQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const showProductDropdown =
    hasFocusedProductSearch && (hasSearchQuery || (!isLoading && (displayProducts.length > 0 || products.length === 0)));
  const showNoResultState = hasSearchQuery && !isSearching && !searchError && displayProducts.length === 0;

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
    setSearchPage(1);
    setHasFocusedProductSearch(false);
    setSuccess("");
    setError("");
    window.setTimeout(() => {
      const gridHeader = selectedProductsGridHeaderRef.current;
      if (!gridHeader || window.getComputedStyle(gridHeader).display === "none") return;
      rowNoteRefs.current[rowId]?.focus({ preventScroll: true });
    }, 0);
  }

  function handleClearProductSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setSearchPage(1);
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
    <section className="stock-in-workspace min-w-0 max-w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <header className="stock-in-page-header">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nhập hàng</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/admin/products")}
                className="stock-in-exit min-h-11 rounded border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                Thoát
              </button>
            </div>
          </div>
        </header>

        <div className="min-w-0 pb-6">
          {(error || success) && (
            <div className="mb-4 min-w-0 [overflow-wrap:anywhere]" aria-live="polite">
              {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">{error}</p>}
              {success && <p className="rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-sm">{success}</p>}
            </div>
          )}

          <div className="min-w-0 space-y-4">
              <section className="stock-in-supplier-context" aria-label="Nhà cung cấp">
                <div>
                  <label htmlFor="stock-in-supplier" className="text-sm font-medium text-slate-700">Nhà cung cấp</label>
                  <p className="text-xs text-slate-500">Không bắt buộc</p>
                </div>
                <div className="min-w-0 max-w-full">
                  <SupplierSelector variant="compact" inputId="stock-in-supplier" selectedSupplier={selectedSupplier} onSelect={setSelectedSupplier} />
                </div>
              </section>

              <section className="min-w-0" aria-label="Sản phẩm nhập hàng">

                <div className="min-w-0">
                  <div ref={dropdownRef} className="relative">
                    <input
                      ref={searchInputRef}
                      className="stock-in-search h-11 w-full min-w-0 max-w-full rounded-md border border-slate-400 bg-white px-3 pr-12 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      aria-label="Tìm theo tên sản phẩm hoặc SKU"
                      placeholder="Tìm theo tên sản phẩm hoặc SKU"
                      value={searchInput}
                      onFocus={() => setHasFocusedProductSearch(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setHasFocusedProductSearch(false);
                      }}
                      onChange={(event) => {
                        setSearchInput(event.target.value);
                        setSearchPage(1);
                        setHasFocusedProductSearch(true);
                        setSuccess("");
                      }}
                    />
                    {searchInput && (
                      <button
                        type="button"
                        aria-label="Xóa tìm kiếm sản phẩm"
                        onClick={handleClearProductSearch}
                        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        ×
                      </button>
                    )}

                    {showProductDropdown && (
                      <div className="stock-in-search-results absolute left-0 right-0 z-20 mt-1 rounded-md border border-slate-200 bg-white shadow-lg">
                        <Link
                          to={getCreateProductUrl(searchInput)}
                          className="flex min-h-11 items-center gap-2 border-b border-slate-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-500 text-base leading-none">+</span>
                          <span>Thêm mới sản phẩm</span>
                        </Link>

                        {!hasSearchQuery && displayProducts.length > 0 && (
                          <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Sản phẩm gần đây
                          </p>
                        )}

                        {isSearching && <p role="status" className="px-4 py-3 text-sm text-slate-500">Đang tìm sản phẩm...</p>}

                        {searchError && (
                          <div role="alert" className="px-4 py-3 text-sm text-red-700">
                            <p>{searchError}</p>
                            <button type="button" onClick={() => setSearchRetry((value) => value + 1)} className="mt-1 min-h-11 underline focus-visible:ring-2 focus-visible:ring-brand-500">
                              Thử lại tìm kiếm
                            </button>
                          </div>
                        )}

                        {(hasSearchQuery ? showNoResultState : !isLoading && !error && displayProducts.length === 0) && (
                          <div className="px-4 py-3">
                            <p className="text-sm text-slate-600">Không tìm thấy sản phẩm phù hợp.</p>
                          </div>
                        )}

                        {displayProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleAddProduct(product)}
                            className="stock-in-search-result block w-full border-b border-slate-100 bg-white px-3 py-1.5 text-left transition-colors last:border-b-0 hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                          >
                            <div className="stock-in-search-result-grid">
                              <div className="stock-in-search-result-identity min-w-0">
                                <p className="break-words text-sm font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere]">{product.name}</p>
                                <p className="break-all text-xs leading-4 text-slate-500">{product.sku}</p>
                              </div>
                              <p className="stock-in-search-result-stock min-w-0 text-right text-xs text-slate-500 [overflow-wrap:anywhere]">
                                Tồn: <span className="text-sm font-semibold tabular-nums text-slate-900">{Number(product.total_quantity || 0)}</span>
                              </p>
                            </div>
                          </button>
                        ))}
                        {hasSearchQuery && isCurrentSearch && !searchError && productSearch.page < productSearch.totalPages && (
                          <button
                            type="button"
                            disabled={isSearching}
                            onClick={() => setSearchPage(productSearch.page + 1)}
                            className="min-h-11 w-full border-t border-slate-100 px-4 text-sm font-semibold text-brand-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                          >
                            Xem thêm sản phẩm
                          </button>
                        )}
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

                  <div className="stock-in-products-container mt-4 min-w-0 max-w-full border-t border-slate-200 bg-white">
                    <div>
                      <div
                        ref={selectedProductsGridHeaderRef}
                        className="stock-in-products-grid-header border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600"
                      >
                        <span>Sản phẩm</span>
                        <span>Nhóm bảo hành / ghi chú</span>
                        <span className="text-right">Số lượng</span>
                        <span className="text-center">Xóa</span>
                      </div>

                      {items.length === 0 ? (
                        <div className="px-3 py-5">
                          <p className="text-sm text-slate-500">Tìm sản phẩm để thêm vào phiếu</p>
                        </div>
                      ) : (
                        <div className="stock-in-products-list">
                          {items.map((item) => (
                            <div
                              key={item.rowId}
                              className="stock-in-product-row grid min-w-0 max-w-full grid-cols-1 gap-2 bg-white px-3 py-3 text-sm"
                            >
                              <div className="stock-in-product-main flex min-w-0 items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="stock-in-product-name break-words font-semibold text-slate-900">{item.product.name}</p>
                                  <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-slate-500">
                                    <p className="stock-in-product-sku min-w-0 break-all" title={item.sku}>
                                      {item.sku}
                                    </p>
                                    <p className="stock-in-product-category min-w-0 break-words">
                                      {getCategoryName(item.product, categories)}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.rowId)}
                                  className="stock-in-mobile-delete flex h-11 w-11 shrink-0 items-center justify-center rounded text-lg text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500"
                                  aria-label="Xóa sản phẩm"
                                >
                                  ×
                                </button>
                              </div>
                              <div className="min-w-0">
                                <label
                                  htmlFor={`stock-in-note-${item.rowId}`}
                                  className="stock-in-field-label mb-1.5 block text-xs font-semibold text-slate-600"
                                >
                                  Nhóm bảo hành / ghi chú
                                </label>
                                <StockInNoteInput
                                  key={item.product.id}
                                  id={`stock-in-note-${item.rowId}`}
                                  groups={item.product.note_groups}
                                  inputRef={(element) => {
                                    if (element) rowNoteRefs.current[item.rowId] = element;
                                    else delete rowNoteRefs.current[item.rowId];
                                  }}
                                  value={item.note}
                                  onChange={(note) => updateItem(item.rowId, { note })}
                                  onKeyDown={(event) => handleNoteKeyDown(event, item.rowId)}
                                />
                              </div>
                              <div className="min-w-0">
                                <label
                                  htmlFor={`stock-in-quantity-${item.rowId}`}
                                  className="stock-in-field-label mb-1.5 block text-xs font-semibold text-slate-600"
                                >
                                  Số lượng
                                </label>
                                <input
                                  id={`stock-in-quantity-${item.rowId}`}
                                  ref={(element) => {
                                    if (element) rowQuantityRefs.current[item.rowId] = element;
                                  }}
                                  type="number"
                                  min={1}
                                  step={1}
                                  className="stock-in-quantity-input h-11 w-full min-w-0 max-w-full rounded border border-slate-300 bg-white px-3 text-right text-base font-semibold tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                                  value={item.quantity}
                                  onChange={(event) => updateItem(item.rowId, { quantity: event.target.value })}
                                  onKeyDown={handleQuantityKeyDown}
                                  placeholder="SL"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.rowId)}
                                className="stock-in-desktop-delete mx-auto hidden h-10 w-11 items-center justify-center rounded text-lg text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500"
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

                  <div className="stock-in-summary flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-100/70 px-3 py-3">
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
                      className="stock-in-submit min-h-11 rounded-md bg-brand-700 px-6 text-sm font-semibold text-white hover:bg-brand-900 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
