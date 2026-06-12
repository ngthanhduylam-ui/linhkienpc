import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CustomerSelector } from "../components/CustomerSelector";
import {
  getProductInventoryRequest,
  listActiveCategories,
  listActiveProducts,
  stockOutRequest
} from "../services/inventoryOperations.service";
import { formatWarrantyNote } from "../utils/warrantyNote";

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

const NO_NOTE_WARRANTY_VALUE = "__NO_NOTE__";

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleString("vi-VN");
}

function DeliveryNotePreview({ deliveryNote, onClose }) {
  const [printOptions, setPrintOptions] = useState({
    showPhone: true,
    showAddress: true,
    showWarrantyNote: true,
    showSignature: true,
    showAdmin: true
  });
  const [footerNote, setFooterNote] = useState("Cảm ơn quý khách.");

  if (!deliveryNote) return null;

  function toggleOption(key) {
    setPrintOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 px-4 py-6 print:static print:overflow-visible print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl rounded-xl bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="delivery-note-controls border-b border-slate-200 p-4 print:hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Xem trước Phiếu giao hàng</h3>
              <p className="mt-1 text-sm text-slate-600">
                V1 dùng bố cục cố định. Trình chỉnh mẫu in tùy biến đầy đủ có thể làm sau nếu cần.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900"
              >
                In phiếu
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ["showPhone", "Hiện số điện thoại"],
              ["showAddress", "Hiện địa chỉ"],
              ["showWarrantyNote", "Hiện ghi chú bảo hành"],
              ["showSignature", "Hiện khu vực ký tên"],
              ["showAdmin", "Hiện người thao tác"]
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={printOptions[key]}
                  onChange={() => toggleOption(key)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                />
                {label}
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Ghi chú cuối phiếu</label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              value={footerNote}
              onChange={(event) => setFooterNote(event.target.value)}
            />
          </div>
        </div>

        <article className="delivery-note-page mx-auto bg-white p-8 text-slate-900 print:m-0 print:w-full print:p-0">
          <header className="border-b border-slate-300 pb-4 text-center">
            <p className="text-lg font-bold tracking-wide">VI TÍNH PHƯỚC TÀI</p>
            <h1 className="mt-3 text-2xl font-extrabold tracking-[0.18em]">PHIẾU GIAO HÀNG</h1>
          </header>

          <section className="mt-6 grid gap-4 text-sm md:grid-cols-2 print:grid-cols-2">
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Ngày giờ xuất:</span> {formatDateTime(deliveryNote.occurred_at)}
              </p>
              <p>
                <span className="font-semibold">Mã giao dịch:</span> {deliveryNote.transaction_id || "-"}
              </p>
              {printOptions.showAdmin && (
                <p>
                  <span className="font-semibold">Người thao tác/admin:</span> {deliveryNote.admin || "-"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Đối tác nhận hàng:</span> {deliveryNote.customer?.name || "-"}
              </p>
              {printOptions.showPhone && (
                <p>
                  <span className="font-semibold">Số điện thoại:</span> {deliveryNote.customer?.phone || "-"}
                </p>
              )}
              {printOptions.showAddress && (
                <p>
                  <span className="font-semibold">Địa chỉ:</span> {deliveryNote.customer?.address || "-"}
                </p>
              )}
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-lg border border-slate-300 print:rounded-none">
            <div className="grid grid-cols-[1.5fr_1fr_0.5fr] bg-slate-100 text-sm font-semibold print:bg-white">
              <div className="border-r border-slate-300 p-3">Sản phẩm</div>
              <div className="border-r border-slate-300 p-3">SKU</div>
              <div className="p-3 text-right">SL</div>
            </div>
            <div className="grid grid-cols-[1.5fr_1fr_0.5fr] text-sm">
              <div className="border-r border-t border-slate-300 p-3">{deliveryNote.product?.name || "-"}</div>
              <div className="border-r border-t border-slate-300 p-3">{deliveryNote.product?.sku || "-"}</div>
              <div className="border-t border-slate-300 p-3 text-right font-semibold">{deliveryNote.quantity}</div>
            </div>
          </section>

          <section className="mt-5 space-y-2 text-sm">
            {printOptions.showWarrantyNote && (
              <p>
                <span className="font-semibold">Warranty note / note:</span>{" "}
                {deliveryNote.warranty_note ? formatWarrantyNote(deliveryNote.warranty_note) : "-"}
              </p>
            )}
            <p>
              <span className="font-semibold">Ghi chú xuất kho:</span> {deliveryNote.note || "-"}
            </p>
          </section>

          {footerNote.trim() && <p className="mt-8 text-sm italic text-slate-700">{footerNote}</p>}

          {printOptions.showSignature && (
            <section className="mt-14 grid grid-cols-2 gap-8 text-center text-sm font-semibold">
              <div>
                <p>Người giao</p>
                <p className="mt-20 text-xs font-normal text-slate-500">(Ký, ghi rõ họ tên)</p>
              </div>
              <div>
                <p>Người nhận</p>
                <p className="mt-20 text-xs font-normal text-slate-500">(Ký, ghi rõ họ tên)</p>
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}

export function StockOutPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [warrantyNoteGroups, setWarrantyNoteGroups] = useState([]);
  const [selectedWarrantyNote, setSelectedWarrantyNote] = useState("");
  const [isLoadingWarrantyNotes, setIsLoadingWarrantyNotes] = useState(false);
  const [printAfterStockOut, setPrintAfterStockOut] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState(null);
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

  const selectedWarrantyGroup = useMemo(
    () => warrantyNoteGroups.find((item) => item.value === selectedWarrantyNote) || null,
    [warrantyNoteGroups, selectedWarrantyNote]
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

  useEffect(() => {
    const keyword = normalizeText(debouncedSearch);
    if (!keyword) return;

    const exactSkuMatches = products.filter((item) => normalizeText(item.sku) === keyword);
    if (exactSkuMatches.length === 1) {
      setSelectedProductId(String(exactSkuMatches[0].id));
    }
  }, [debouncedSearch, products]);

  async function reloadProducts(keepSku = "") {
    const items = await listActiveProducts();
    setProducts(items);
    if (!keepSku) return;
    const matched = items.find((item) => normalizeText(item.sku) === normalizeText(keepSku));
    if (matched) {
      setSelectedProductId(String(matched.id));
    }
  }

  async function reloadWarrantyNoteGroups(sku) {
    if (!sku) {
      setWarrantyNoteGroups([]);
      setSelectedWarrantyNote("");
      return [];
    }

    setIsLoadingWarrantyNotes(true);
    try {
      const inventory = await getProductInventoryRequest(sku);
      const groups = (inventory?.note_groups || [])
        .map((item) => ({
          note: item.note || "",
          label: item.label || item.note || "Không ghi chú",
          value: item.is_no_note || !item.note ? NO_NOTE_WARRANTY_VALUE : item.note,
          isNoNote: Boolean(item.is_no_note || !item.note),
          quantity: Number(item.quantity || 0)
        }))
        .filter((item) => item.quantity > 0);

      setWarrantyNoteGroups(groups);
      if (selectedWarrantyNote && !groups.some((item) => item.value === selectedWarrantyNote)) {
        setSelectedWarrantyNote("");
        setNote("");
      }
      return groups;
    } finally {
      setIsLoadingWarrantyNotes(false);
    }
  }

  function handleClearProductSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedProductId("");
    setWarrantyNoteGroups([]);
    setSelectedWarrantyNote("");
    setSuccess("");
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!selectedProduct) {
      setWarrantyNoteGroups([]);
      setSelectedWarrantyNote("");
      return;
    }

    let active = true;
    setIsLoadingWarrantyNotes(true);
    getProductInventoryRequest(selectedProduct.sku)
      .then((inventory) => {
        if (!active) return;
        const groups = (inventory?.note_groups || [])
          .map((item) => ({
            note: item.note || "",
            label: item.label || item.note || "Không ghi chú",
            value: item.is_no_note || !item.note ? NO_NOTE_WARRANTY_VALUE : item.note,
            isNoNote: Boolean(item.is_no_note || !item.note),
            quantity: Number(item.quantity || 0)
          }))
          .filter((item) => item.quantity > 0);

        setWarrantyNoteGroups(groups);
        setSelectedWarrantyNote((current) => (current && groups.some((item) => item.value === current) ? current : ""));
      })
      .catch(() => {
        if (!active) return;
        setWarrantyNoteGroups([]);
        setSelectedWarrantyNote("");
      })
      .finally(() => {
        if (active) setIsLoadingWarrantyNotes(false);
      });

    return () => {
      active = false;
    };
  }, [selectedProduct]);

  useEffect(() => {
    if (selectedWarrantyNote) {
      setNote(selectedWarrantyGroup?.isNoNote ? "" : selectedWarrantyGroup?.note || selectedWarrantyNote);
    }
  }, [selectedWarrantyNote, selectedWarrantyGroup]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedProduct) {
      setError("Chọn sản phẩm bên trái để xuất kho.");
      return;
    }

    const numericQuantity = Number(quantity);
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      setError("Số lượng xuất phải là số nguyên dương.");
      return;
    }
    if (numericQuantity > Number(selectedProduct.total_quantity || 0)) {
      setError(`Số lượng xuất vượt quá tồn hiện tại (${Number(selectedProduct.total_quantity || 0)}).`);
      return;
    }
    if (warrantyNoteGroups.length > 0) {
      if (!selectedWarrantyGroup) {
        setError("Vui lòng chọn bảo hành cần xuất.");
        return;
      }
      if (numericQuantity > selectedWarrantyGroup.quantity) {
        setError(
          `Số lượng xuất vượt quá tồn của bảo hành ${formatWarrantyNote(selectedWarrantyGroup.label)} (${selectedWarrantyGroup.quantity}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const outboundNote = selectedWarrantyGroup
        ? selectedWarrantyGroup.isNoNote
          ? undefined
          : selectedWarrantyGroup.note
        : note.trim() || undefined;
      const result = await stockOutRequest({
        sku: selectedProduct.sku,
        quantity: numericQuantity,
        ...(selectedCustomer?.id ? { customer_id: Number(selectedCustomer.id) } : {}),
        note: outboundNote,
        ...(selectedWarrantyGroup ? { warranty_note: selectedWarrantyGroup.value } : {})
      });
      const transaction = result?.transaction || {};
      const nextDeliveryNote = {
        transaction_id: transaction.id,
        occurred_at: transaction.occurred_at || new Date().toISOString(),
        admin: transaction.created_by_admin_id ? `Admin #${transaction.created_by_admin_id}` : "-",
        customer: selectedCustomer,
        product: {
          name: selectedProduct.name,
          sku: selectedProduct.sku
        },
        quantity: numericQuantity,
        warranty_note: selectedWarrantyGroup?.label || outboundNote || "",
        note: note.trim() || outboundNote || ""
      };

      await reloadProducts(selectedProduct.sku);
      await reloadWarrantyNoteGroups(selectedProduct.sku);
      setSuccess(
        `Xuất kho thành công: ${selectedProduct.name}. Tổng tồn mới: ${
          result?.inventory_balance?.quantity ?? "N/A"
        }.`
      );
      setQuantity("");
      if (!selectedWarrantyGroup) {
        setNote("");
      }
      if (printAfterStockOut) {
        setDeliveryNote(nextDeliveryNote);
      }
    } catch (err) {
      setError(err?.message || "Xuất kho thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Xuất hàng</h2>
        <p className="mt-1 text-sm text-slate-600">Tìm sản phẩm, chọn bảo hành nếu có, rồi xuất kho.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-12">
        <section className="space-y-5 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Tìm sản phẩm</h3>
            <label className="mt-4 mb-1 block text-sm font-medium text-slate-700">
              Tìm sản phẩm theo tên hoặc SKU
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                className="h-11 w-full rounded-md border border-slate-300 px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Nhập tên sản phẩm hoặc SKU"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSelectedProductId("");
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
                  Không tìm thấy sản phẩm. Vui lòng thêm sản phẩm ở mục Sản phẩm trước.
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
            <h3 className="text-base font-semibold text-slate-900">Phiếu xuất kho</h3>

            {!selectedProduct ? (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                Chọn sản phẩm bên trái để xuất kho.
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

            {selectedProduct && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Chọn bảo hành</label>
                {isLoadingWarrantyNotes ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Đang tải thông tin bảo hành...
                  </p>
                ) : warrantyNoteGroups.length > 0 ? (
                  <select
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={selectedWarrantyNote}
                    onChange={(event) => setSelectedWarrantyNote(event.target.value)}
                  >
                    <option value="">-- Chọn bảo hành --</option>
                    {warrantyNoteGroups.map((group) => (
                      <option key={group.value} value={group.value}>
                        {formatWarrantyNote(group.label)} - còn {group.quantity}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Sản phẩm chưa có ghi chú bảo hành. Có thể xuất kho bằng ghi chú tự do.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Số lượng xuất *</label>
              <input
                type="number"
                min={1}
                max={selectedWarrantyGroup ? selectedWarrantyGroup.quantity : undefined}
                step={1}
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Nhập số lượng xuất"
              />
            </div>

            <CustomerSelector selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} />

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Ghi chú xuất kho</label>
              <textarea
                rows={5}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder="Nhập lý do hoặc mô tả xuất kho"
              />
            </div>

            <label className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={printAfterStockOut}
                onChange={(event) => setPrintAfterStockOut(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
              />
              In phiếu giao hàng sau khi xuất
            </label>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {success && <p className="mt-4 text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="mt-5 h-11 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Đang xử lý..." : "Xác nhận xuất kho"}
            </button>
          </div>
        </aside>
      </form>

      {deliveryNote && <DeliveryNotePreview deliveryNote={deliveryNote} onClose={() => setDeliveryNote(null)} />}
    </section>
  );
}
