import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SupplierSelector } from "../components/SupplierSelector";
import {
  bulkStockInRequest,
  listActiveCategories,
  listActiveProducts
} from "../services/inventoryOperations.service";

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
  const showNoResultState = !isLoading && debouncedSearch.length > 0 && filteredProducts.length === 0;
  const showEmptyState = !isLoading && products.length === 0;

  function handleAddProduct(product) {
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
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Nhập hàng</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Chọn nhà cung cấp, thêm sản phẩm và ghi chú bảo hành cho từng dòng nhập hàng.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-sm font-semibold text-slate-800">Thông tin nhà cung cấp</h3>
          <div className="[&>div]:mt-2 [&>div]:rounded-md [&>div]:p-3">
            <SupplierSelector selectedSupplier={selectedSupplier} onSelect={setSelectedSupplier} />
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
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleAddProduct(product)}
                  className="block w-full bg-white p-2.5 text-left transition hover:bg-brand-50"
                >
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
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Danh sách nhập hàng</h3>
              <p className="mt-0.5 text-xs text-slate-500">Mỗi dòng sẽ tạo một giao dịch nhập kho riêng.</p>
            </div>
            <div className="rounded bg-slate-50 px-2 py-1 text-sm text-slate-700">
              <span className="font-semibold">{items.length}</span> dòng ·{" "}
              <span className="font-semibold">{totalRowsQuantity}</span> sản phẩm
            </div>
          </div>

          {items.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-sm text-slate-600">
              Chưa có sản phẩm nào trong phiếu nhập. Tìm sản phẩm và bấm vào sản phẩm để thêm dòng nhập.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
              {items.map((item, index) => (
                <div key={item.rowId} className="bg-white p-2.5">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_minmax(220px,0.9fr)_auto] sm:items-start sm:gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.product.name}</p>
                      <p className="mt-0.5 break-all text-xs text-slate-500">SKU: {item.sku}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Dòng {index + 1}</p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">SL nhập *</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.rowId, { quantity: event.target.value })}
                        placeholder="SL"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Ghi chú bảo hành / nhập hàng
                      </label>
                      <input
                        className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                        value={item.note}
                        onChange={(event) => updateItem(item.rowId, { note: event.target.value })}
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Ví dụ: BH 12.28"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.rowId)}
                      className="h-9 shrink-0 rounded border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {success && <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={isSubmitting || isLoading || items.length === 0}
            className="mt-3 h-10 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Đang xử lý..." : "Lưu phiếu nhập kho"}
          </button>
        </section>
      </form>
    </section>
  );
}
