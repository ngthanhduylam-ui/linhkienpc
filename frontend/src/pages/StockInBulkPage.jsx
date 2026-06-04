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
      .slice(0, 20);
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
      setError(err?.message || "Nhập hàng nhiều sản phẩm thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Nhập hàng nhiều sản phẩm</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tạo một phiếu nhập gồm nhiều dòng sản phẩm, mỗi dòng giữ riêng số lượng và ghi chú bảo hành.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-base font-semibold text-slate-900">Thông tin phiếu nhập</h3>
          <SupplierSelector selectedSupplier={selectedSupplier} onSelect={setSelectedSupplier} />
        </section>

        <section className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-base font-semibold text-slate-900">Tìm sản phẩm</h3>
              <label className="mt-4 mb-1 block text-sm font-medium text-slate-700">
                Tìm sản phẩm theo tên hoặc SKU
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  className="h-12 w-full rounded-md border border-slate-300 px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-brand-500"
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

              {isLoading && <p className="mt-3 text-sm text-slate-500">Đang tải dữ liệu sản phẩm...</p>}

              {!isLoading && filteredProducts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50"
                    >
                      <p className="text-base font-semibold text-slate-900">{product.name}</p>
                      <p className="mt-2 text-sm font-bold text-brand-800">
                        {Number(product.total_quantity || 0)}{" "}
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          tồn hiện tại
                        </span>
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-600">SKU: {product.sku}</p>
                      <p className="mt-1 text-xs text-slate-600">Danh mục: {getCategoryName(product, categories)}</p>
                    </button>
                  ))}
                </div>
              )}

              {(showEmptyState || showNoResultState) && (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm text-slate-700">
                    Không tìm thấy sản phẩm. Vui lòng tạo sản phẩm ở mục Sản phẩm trước.
                  </p>
                  <Link
                    to="/admin/products"
                    className="mt-3 inline-flex rounded-md border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Đi tới Sản phẩm
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Danh sách nhập hàng</h3>
                  <p className="mt-1 text-sm text-slate-500">Mỗi dòng sẽ tạo một giao dịch nhập kho riêng.</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold">{items.length}</span> dòng ·{" "}
                  <span className="font-semibold">{totalRowsQuantity}</span> sản phẩm
                </div>
              </div>

              {items.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm text-slate-600">
                  Chưa có sản phẩm nào trong phiếu. Tìm và bấm vào sản phẩm bên trái để thêm dòng nhập.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {items.map((item, index) => (
                    <div key={item.rowId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-900">{item.product.name}</p>
                          <p className="mt-1 break-all text-xs text-slate-500">{item.sku}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.rowId)}
                          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white"
                        >
                          Xóa
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Số lượng nhập *
                          </label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                            value={item.quantity}
                            onChange={(event) => updateItem(item.rowId, { quantity: event.target.value })}
                            placeholder="SL"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Ghi chú bảo hành / ghi chú nhập hàng
                          </label>
                          <textarea
                            rows={2}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                            value={item.note}
                            onChange={(event) => updateItem(item.rowId, { note: event.target.value })}
                            autoCapitalize="off"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="Ví dụ: BH 12.28"
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">Dòng {index + 1}</p>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {success && <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>}

              <button
                type="submit"
                disabled={isSubmitting || isLoading || items.length === 0}
                className="mt-5 h-12 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang xử lý..." : "Lưu phiếu nhập kho"}
              </button>
            </div>
          </div>
        </section>
      </form>
    </section>
  );
}
