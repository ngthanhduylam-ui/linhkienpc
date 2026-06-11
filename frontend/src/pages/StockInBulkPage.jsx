import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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

export function StockInBulkPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(null);
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

  const totalRowsQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const displayProducts = useMemo(() => {
    if (debouncedSearch) return filteredProducts;
    if (hasFocusedProductSearch) return filterRecentItemsByAvailable(recentProducts, products);
    return [];
  }, [debouncedSearch, filteredProducts, hasFocusedProductSearch, products, recentProducts]);
  const showNoResultState = !isLoading && debouncedSearch.length > 0 && filteredProducts.length === 0;
  const showEmptyState = !isLoading && products.length === 0;

  function handleAddProduct(product) {
    setRecentProducts(saveRecentItem(RECENT_PRODUCTS_KEY, product, 20));
    setItems((prev) => [
      ...prev,
      {
        rowId: createRowId(product),
        product,
        sku: product.sku,
        quantity: "1",
        note: ""
      }
    ]);
    setSuccess("");
    setError("");
  }

  function handleClearProductSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setSuccess("");
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function updateItem(rowId, changes) {
    setItems((prev) => prev.map((item) => (item.rowId === rowId ? { ...item, ...changes } : item)));
    setSuccess("");
  }

  function removeItem(rowId) {
    setItems((prev) => prev.filter((item) => item.rowId !== rowId));
    setSuccess("");
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
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Nhập hàng</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Chọn nhà cung cấp, thêm sản phẩm và nhập số lượng theo từng nhóm bảo hành.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Nhà cung cấp</h3>
            <p className="mt-0.5 text-xs text-slate-500">Tìm hoặc tạo nhanh nhà cung cấp cho phiếu nhập.</p>
          </div>
          <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:bg-white px-4 py-3">
            <SupplierSelector selectedSupplier={selectedSupplier} onSelect={setSelectedSupplier} />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Sản phẩm nhập</h3>
                <p className="mt-0.5 text-xs text-slate-500">Tìm sản phẩm theo tên hoặc SKU, bấm vào dòng để thêm vào phiếu.</p>
              </div>
              <div className="p-4">
          <div className="relative">
            <input
              ref={searchInputRef}
              className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="Tìm sản phẩm theo tên hoặc SKU"
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
                onClick={handleClearProductSearch}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            )}
          </div>

          {isLoading && <p className="mt-2 text-xs text-slate-500">Đang tải dữ liệu sản phẩm...</p>}

          {!isLoading && displayProducts.length > 0 && (
            <div className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {!debouncedSearch && (
                <p className="bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase text-slate-500">Sản phẩm gần đây</p>
              )}
              {displayProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleAddProduct(product)}
                  className="block w-full bg-white px-3 py-2 text-left transition hover:bg-blue-50"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_90px] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{product.sku}</p>
                    </div>
                    <div className="text-right text-xs font-semibold text-brand-800">
                      Tồn: {Number(product.total_quantity || 0)}
                    </div>
                  </div>
                </button>
              ))}
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
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Danh sách sản phẩm nhập</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Ghi chú dùng cho nhóm bảo hành hoặc lô nhập hiện tại.</p>
                </div>
                <div className="rounded bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {items.length} dòng · {totalRowsQuantity} sản phẩm
                </div>
              </div>

              {items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-600">
                    Chưa có sản phẩm nào trong phiếu nhập. Tìm sản phẩm và bấm vào sản phẩm để thêm dòng nhập.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[minmax(240px,1fr)_120px_minmax(220px,0.8fr)_44px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>Sản phẩm</span>
                      <span className="text-right">SL nhập</span>
                      <span>Ghi chú bảo hành</span>
                      <span></span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map((item, index) => (
                        <div key={item.rowId} className="grid grid-cols-[minmax(240px,1fr)_120px_minmax(220px,0.8fr)_44px] items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50/50">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{item.product.name}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{item.sku}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">Dòng {index + 1}</p>
                          </div>

                          <input
                            type="number"
                            min={1}
                            step={1}
                            className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                            value={item.quantity}
                            onChange={(event) => updateItem(item.rowId, { quantity: event.target.value })}
                            placeholder="SL"
                          />

                          <input
                            className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                            value={item.note}
                            onChange={(event) => updateItem(item.rowId, { note: event.target.value })}
                            autoCapitalize="off"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="Ví dụ: BH 12.28"
                          />

                          <button
                            type="button"
                            onClick={() => removeItem(item.rowId)}
                            className="flex h-8 w-8 items-center justify-center rounded text-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Xóa sản phẩm"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-3">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4">
              <h3 className="text-sm font-semibold text-slate-900">Tóm tắt phiếu nhập</h3>
              <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>Nhà cung cấp</span>
                  <span className="max-w-[150px] truncate font-semibold text-slate-900">{selectedSupplier?.name || "Chưa chọn"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>Số dòng sản phẩm</span>
                  <span className="font-semibold text-slate-900">{items.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2">
                  <span>Tổng số lượng</span>
                  <span className="font-semibold text-slate-900">{totalRowsQuantity}</span>
                </div>
              </div>

              {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {success && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

              <button
                type="submit"
                disabled={isSubmitting || isLoading || items.length === 0}
                className="mt-3 h-10 w-full rounded-md bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang xử lý..." : "Lưu phiếu nhập kho"}
              </button>
            </section>
          </aside>
        </div>
      </form>
    </section>
  );
}
