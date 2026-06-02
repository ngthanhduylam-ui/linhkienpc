import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listActiveCategories, listActiveProducts, stockInRequest } from "../services/inventoryOperations.service";

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

export function StockInPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
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

  const selectedProduct = useMemo(
    () => products.find((item) => String(item.id) === String(selectedProductId)) || null,
    [products, selectedProductId]
  );

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

  const showNoResultState =
    !isLoading && debouncedSearch.length > 0 && filteredProducts.length === 0 && !selectedProduct;
  const showEmptyState = !isLoading && products.length === 0;

  async function reloadProducts(keepSku = "") {
    const items = await listActiveProducts();
    setProducts(items);
    if (!keepSku) return;
    const matched = items.find((item) => normalizeText(item.sku) === normalizeText(keepSku));
    if (matched) {
      setSelectedProductId(String(matched.id));
      setSearchInput(matched.sku);
      setDebouncedSearch(matched.sku);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedProduct) {
      setError("Chọn sản phẩm bên trái để nhập kho.");
      return;
    }

    const numericQuantity = Number(quantity);
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      setError("Số lượng nhập phải là số nguyên dương.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await stockInRequest({
        sku: selectedProduct.sku,
        quantity: numericQuantity,
        note: note.trim() || undefined
      });

      await reloadProducts(selectedProduct.sku);
      setSuccess(
        `Nhập kho thành công cho SKU ${selectedProduct.sku}. Tổng tồn mới: ${
          result?.inventory_balance?.quantity ?? "N/A"
        }.`
      );
      setQuantity("");
      setNote("");
    } catch (err) {
      setError(err?.message || "Nhập kho thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Nhập hàng</h2>
        <p className="mt-1 text-sm text-slate-600">Tìm sản phẩm và nhập thêm số lượng vào tồn kho.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-12">
        <section className="space-y-5 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Tìm sản phẩm</h3>
            <label className="mt-4 mb-1 block text-sm font-medium text-slate-700">
              Tìm sản phẩm theo tên hoặc SKU
            </label>
            <input
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Nhập tên sản phẩm hoặc SKU"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSelectedProductId("");
                setSuccess("");
              }}
            />

            {isLoading && <p className="mt-3 text-sm text-slate-500">Đang tải dữ liệu sản phẩm...</p>}

            {!isLoading && filteredProducts.length > 0 && (
              <div className="mt-4 space-y-2">
                {filteredProducts.map((item) => {
                  const isSelected = String(item.id) === String(selectedProductId);
                  const cardClassName = `w-full rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-brand-600 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(String(item.id));
                        setSearchInput(item.sku);
                        setDebouncedSearch(item.sku);
                        setSuccess("");
                      }}
                      className={cardClassName}
                    >
                      <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-2 text-base font-bold text-brand-800">
                        {Number(item.total_quantity || 0)}{" "}
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          tồn hiện tại
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">SKU: {item.sku}</p>
                      <p className="mt-1 text-xs text-slate-600">Danh mục: {getCategoryName(item, categories)}</p>
                    </button>
                  );
                })}
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
        </section>

        <aside className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h3 className="text-base font-semibold text-slate-900">Phiếu nhập kho</h3>

            {!selectedProduct ? (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Chọn sản phẩm bên trái để nhập kho.
              </p>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-2xl font-bold text-slate-900">{selectedProduct.name}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="text-xs text-slate-600">SKU: {selectedProduct.sku}</p>
                  <p className="text-xs text-slate-600">Danh mục: {getCategoryName(selectedProduct, categories)}</p>
                </div>
                <div className="mt-4 rounded-md bg-white px-4 py-4 text-center">
                  <p className="text-5xl font-extrabold leading-none text-brand-800">
                    {Number(selectedProduct.total_quantity || 0)}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">TỒN HIỆN TẠI</p>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng nhập *</label>
              <input
                type="number"
                min={1}
                step={1}
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Nhập số lượng nhập"
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Ghi chú bảo hành / ghi chú nhập hàng
              </label>
              <textarea
                rows={5}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: BH07.26"
              />
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {success && <p className="mt-4 text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="mt-5 h-11 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Đang xử lý..." : "Lưu và nhập kho"}
            </button>
          </div>
        </aside>
      </form>
    </section>
  );
}
