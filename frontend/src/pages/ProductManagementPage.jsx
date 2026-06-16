import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  activateProductRequest,
  createCategoryRequest,
  createProductRequest,
  deactivateProductRequest,
  listActiveCategories,
  listProductsPage,
  updateProductRequest
} from "../services/inventoryOperations.service";

const PRODUCT_PAGE_SIZE = 20;
const PRODUCT_STATUS_ACTIVE = "active";
const PRODUCT_STATUS_INACTIVE = "inactive";
const PRODUCT_STATUS_ALL = "all";
const SKU_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)*$/i;
const SKU_FORMAT_MESSAGE = "SKU không hợp lệ. Chỉ dùng chữ thường, số và dấu chấm.";
const SKU_DUPLICATE_MESSAGE = "SKU này đã tồn tại. Vui lòng dùng SKU khác.";
const SKU_HELPER_TEXT = "SKU chỉ dùng chữ thường, số và dấu chấm. Ví dụ: 2nd.maybo.lenovo.v50t13imb";

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

function normalizeSkuChunk(value) {
  return normalizeText(value).replace(/[^a-z0-9\s.]/g, " ").replace(/\s+/g, " ").trim();
}

function toDotToken(value) {
  return normalizeSkuChunk(value).replace(/\s+/g, ".").replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "");
}

function getCategoryById(categories, categoryId) {
  return categories.find((item) => Number(item.id) === Number(categoryId)) || null;
}

function getCategoryName(product, categories) {
  if (product?.category?.name) return product.category.name;
  const match = getCategoryById(categories, product?.category_id);
  return match?.name || "-";
}

function buildSuggestedSku(productName, category) {
  const categoryPrefix = toDotToken(category?.code || category?.name || "");
  if (!categoryPrefix) return "";

  const normalizedName = normalizeSkuChunk(productName);
  if (!normalizedName) return "";

  if (categoryPrefix === "cpu") {
    const isIntel = /\b(i3|i5|i7|i9)\b/.test(normalizedName);
    const isAmd = /\b(r3|r5|r7|r9)\b/.test(normalizedName) || /\bryzen\b/.test(normalizedName);

    if (isIntel) {
      const intelModelMatch =
        normalizedName.match(/(?:^|\s)i[3579]\s*[- ]?([0-9]{3,5}[a-z]{0,2})\b/) ||
        normalizedName.match(/\b([0-9]{4,5}[a-z]{0,2})\b/);
      if (intelModelMatch?.[1]) return `cpu.intel.${intelModelMatch[1]}`;
      return `cpu.intel.${toDotToken(normalizedName)}`;
    }

    if (isAmd) {
      const amdModelMatch =
        normalizedName.match(/(?:^|\s)(?:r|ryzen)\s*([3579])\s*[- ]?([0-9]{3,5}[a-z]{0,2})\b/) ||
        normalizedName.match(/(?:^|\s)r([3579])\s*[- ]?([0-9]{3,5}[a-z]{0,2})\b/);
      if (amdModelMatch?.[1] && amdModelMatch?.[2]) return `cpu.amd.r${amdModelMatch[1]}${amdModelMatch[2]}`;
      return `cpu.amd.${toDotToken(normalizedName)}`;
    }
  }

  return `${categoryPrefix}.${toDotToken(normalizedName)}`;
}

function isValidSkuFormat(value) {
  return SKU_PATTERN.test(value);
}

function getProductErrorMessage(error, fallbackMessage) {
  const code = error?.payload?.error?.code;
  const details = error?.payload?.error?.details || [];
  const message = String(error?.message || "");
  const normalizedMessage = message.toLowerCase();
  const hasSkuValidationError = details.some(
    (detail) => String(detail?.field || "").includes("sku") || String(detail?.issue || "").includes("sku")
  );

  if (code === "SKU_ALREADY_EXISTS" || normalizedMessage.includes("sku already exists")) {
    return SKU_DUPLICATE_MESSAGE;
  }

  if (
    code === "VALIDATION_ERROR" &&
    (hasSkuValidationError || normalizedMessage.includes("validation failed"))
  ) {
    return SKU_FORMAT_MESSAGE;
  }

  return message || fallbackMessage;
}

function getStatusQueryValue(statusFilter) {
  if (statusFilter === PRODUCT_STATUS_ACTIVE) return true;
  if (statusFilter === PRODUCT_STATUS_INACTIVE) return false;
  return undefined;
}

function getProductStatusBadge(product) {
  return product?.is_active ? "Đang sử dụng" : "Ngừng sử dụng";
}

function formatSalePrice(value) {
  if (value === null || value === undefined) {
    return "Chưa thiết lập";
  }

  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

export function ProductManagementPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(PRODUCT_STATUS_ACTIVE);
  const searchInputRef = useRef(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    name: "",
    sku: "",
    category_id: "",
    spec_summary: ""
  });

  const [newProductName, setNewProductName] = useState("");
  const [newProductCondition, setNewProductCondition] = useState("2nd");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductCategoryId, setNewProductCategoryId] = useState("");
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [showCategoryCreateForm, setShowCategoryCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryInlineInfo, setCategoryInlineInfo] = useState("");

  const selectedCreateCategory = useMemo(
    () => getCategoryById(categories, newProductCategoryId),
    [categories, newProductCategoryId]
  );
  const selectedEditCategory = useMemo(
    () => getCategoryById(categories, editProductForm.category_id),
    [categories, editProductForm.category_id]
  );
  const createPreviewName = newProductName.trim() || "Tên sản phẩm";
  const createPreviewSku = newProductSku.trim() || "SKU";
  const createPreviewCategory = selectedCreateCategory?.name || "Chưa chọn loại sản phẩm";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const categoryItems = await listActiveCategories();
        if (active) setCategories(categoryItems);
      } catch (err) {
        if (active) setError(err?.message || "Không thể tải loại sản phẩm.");
      }
    }

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setIsLoading(true);
      setError("");
      try {
        const result = await listProductsPage({
          keyword: debouncedSearch,
          page,
          limit: PRODUCT_PAGE_SIZE,
          is_active: getStatusQueryValue(statusFilter)
        });
        if (!active) return;
        setProducts(result.items);
        setTotal(Number(result.meta?.total || 0));
        setTotalPages(Math.max(1, Number(result.meta?.total_pages || 1)));
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Không thể tải danh sách sản phẩm.");
        setProducts([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, [debouncedSearch, page, statusFilter]);

  useEffect(() => {
    if (!isModalOpen || !newProductName.trim() || !selectedCreateCategory) return;
    if (isSkuManuallyEdited && newProductSku.trim()) return;

    const suggestedSku = buildSuggestedSku(newProductName, selectedCreateCategory);
    if (suggestedSku) setNewProductSku(`${newProductCondition}.${suggestedSku}`);
  }, [isModalOpen, newProductName, selectedCreateCategory, newProductCondition, isSkuManuallyEdited, newProductSku]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("create") !== "1") return;

    const name = params.get("name") || "";
    navigate(`/admin/products/new${name ? `?name=${encodeURIComponent(name)}` : ""}`, { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") closeCreateModal();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  async function reloadProducts(nextPage = page, nextKeyword = debouncedSearch, nextStatus = statusFilter) {
    const result = await listProductsPage({
      keyword: nextKeyword,
      page: nextPage,
      limit: PRODUCT_PAGE_SIZE,
      is_active: getStatusQueryValue(nextStatus)
    });
    setProducts(result.items);
    setTotal(Number(result.meta?.total || 0));
    setTotalPages(Math.max(1, Number(result.meta?.total_pages || 1)));
    return result.items;
  }

  async function reloadCategories() {
    const items = await listActiveCategories();
    setCategories(items);
    return items;
  }

  function resetCreateForm() {
    setNewProductName("");
    setNewProductCondition("2nd");
    setNewProductSku("");
    setNewProductCategoryId("");
    setIsSkuManuallyEdited(false);
    setShowCategoryCreateForm(false);
    setNewCategoryName("");
    setCategoryInlineInfo("");
  }

  function openCreateModal() {
    setError("");
    setSuccess("");
    resetCreateForm();
    setIsModalOpen(true);
  }

  function closeCreateModal() {
    setIsModalOpen(false);
    resetCreateForm();
    setError("");
  }

  function openEditModal(product) {
    setError("");
    setSuccess("");
    setEditingProduct(product);
    setEditProductForm({
      name: product.name || "",
      sku: product.sku || "",
      category_id: product.category_id ? String(product.category_id) : "",
      spec_summary: product.spec_summary || ""
    });
  }

  function closeEditModal() {
    setEditingProduct(null);
    setEditProductForm({ name: "", sku: "", category_id: "", spec_summary: "" });
    setError("");
  }

  function handleClearSearch() {
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function handleStatusFilterChange(event) {
    setStatusFilter(event.target.value);
    setPage(1);
  }

  async function handleCreateCategoryInline() {
    setError("");
    setCategoryInlineInfo("");

    const name = newCategoryName.trim();
    if (!name) {
      setError("Vui lòng nhập tên loại sản phẩm.");
      return;
    }

    setIsSavingCategory(true);
    try {
      const created = await createCategoryRequest({ name });
      const createdCategoryName = created?.name || name;
      const createdCategoryId = created?.id;
      const nextCategories = await reloadCategories();
      const matched =
        (createdCategoryId ? nextCategories.find((item) => Number(item.id) === Number(createdCategoryId)) : null) ||
        nextCategories.find((item) => normalizeText(item.name) === normalizeText(createdCategoryName));

      if (!matched) {
        setError("Không thể tự động chọn loại sản phẩm vừa tạo.");
        return;
      }

      setNewProductCategoryId(String(matched.id));
      setShowCategoryCreateForm(false);
      setNewCategoryName("");
      setCategoryInlineInfo(`Đã chọn loại sản phẩm ${matched.name}`);
    } catch (err) {
      const errorCode = err?.payload?.error?.code;
      const message = String(err?.message || "").toLowerCase();
      const isDuplicateName =
        errorCode === "CATEGORY_NAME_ALREADY_EXISTS" || message.includes("category name already exists");

      if (isDuplicateName) {
        const nextCategories = await reloadCategories();
        const existed = nextCategories.find((item) => normalizeText(item.name) === normalizeText(name));
        if (existed) {
          setNewProductCategoryId(String(existed.id));
          setShowCategoryCreateForm(false);
          setNewCategoryName("");
          setCategoryInlineInfo("Loại sản phẩm đã tồn tại, đã tự động chọn.");
        } else {
          setError("Không thể tự động chọn loại sản phẩm đã tồn tại.");
        }
      } else {
        setError(err?.message || "Lưu loại sản phẩm thất bại.");
      }
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function handleCreateProduct() {
    setError("");
    setSuccess("");

    const sku = newProductSku.trim();
    if (!newProductName.trim()) {
      setError("Vui lòng nhập tên sản phẩm.");
      return;
    }
    if (!sku) {
      setError("Vui lòng nhập mã sản phẩm / SKU.");
      return;
    }
    if (!isValidSkuFormat(sku)) {
      setError(SKU_FORMAT_MESSAGE);
      return;
    }
    if (!newProductCategoryId) {
      setError("Vui lòng chọn loại sản phẩm.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createProductRequest({
        name: newProductName.trim(),
        sku,
        category_id: Number(newProductCategoryId)
      });

      setSearchInput("");
      setDebouncedSearch("");
      setPage(1);
      await reloadProducts(1, "");
      setSuccess(`Thêm sản phẩm thành công: ${created.name} (${created.sku}).`);
      setIsModalOpen(false);
      resetCreateForm();
    } catch (err) {
      setError(getProductErrorMessage(err, "Thêm sản phẩm thất bại."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateProduct() {
    if (!editingProduct) return;

    setError("");
    setSuccess("");

    const name = editProductForm.name.trim();
    const sku = editProductForm.sku.trim();
    const categoryId = editProductForm.category_id;

    if (!name) {
      setError("Vui lòng nhập tên sản phẩm.");
      return;
    }
    if (!sku) {
      setError("Vui lòng nhập SKU.");
      return;
    }
    if (!isValidSkuFormat(sku)) {
      setError(SKU_FORMAT_MESSAGE);
      return;
    }
    if (!categoryId) {
      setError("Vui lòng chọn loại sản phẩm.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateProductRequest(editingProduct.id, {
        name,
        sku,
        category_id: Number(categoryId),
        spec_summary: editProductForm.spec_summary.trim() || null
      });
      await reloadProducts();
      setSuccess(`Đã cập nhật sản phẩm: ${updated.name} (${updated.sku}).`);
      closeEditModal();
    } catch (err) {
      setError(getProductErrorMessage(err, "Cập nhật sản phẩm thất bại."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivateProduct(product) {
    const confirmed = window.confirm(`Ngừng sử dụng sản phẩm "${product.name}"?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await deactivateProductRequest(product.id);
      await reloadProducts();
      setSuccess(`Đã ngừng sử dụng sản phẩm: ${product.name}.`);
    } catch (err) {
      setError(err?.message || "Ngừng sử dụng sản phẩm thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivateProduct(product) {
    const confirmed = window.confirm(`Khôi phục sản phẩm "${product.name}"?`);
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await activateProductRequest(product.id);
      await reloadProducts();
      setSuccess(`Đã khôi phục sản phẩm: ${product.name}.`);
    } catch (err) {
      setError(err?.message || "Khôi phục sản phẩm thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Sản phẩm</h2>
          <p className="mt-1 text-sm text-slate-600">Quản lý thông tin sản phẩm và tồn hiện tại.</p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex h-11 items-center rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900"
        >
          + Thêm sản phẩm
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tìm sản phẩm</label>
            <div className="relative">
              <input
                ref={searchInputRef}
                className="h-11 w-full rounded-md border border-slate-300 px-3 pr-11 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Tìm theo tên sản phẩm, SKU hoặc loại sản phẩm"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Trạng thái</label>
            <select
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              value={statusFilter}
              onChange={handleStatusFilterChange}
            >
              <option value={PRODUCT_STATUS_ACTIVE}>Đang sử dụng</option>
              <option value={PRODUCT_STATUS_INACTIVE}>Ngừng sử dụng</option>
              <option value={PRODUCT_STATUS_ALL}>Tất cả</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.6fr)_minmax(0,1.25fr)_minmax(100px,1.2fr)_52px_92px_86px] md:items-center md:gap-3">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Tên sản phẩm</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">SKU</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Loại sản phẩm</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right">Giá bán</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right">Tồn</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-center">Trạng thái</span>
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right">Thao tác</span>
        </div>

        {isLoading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Đang tải danh sách sản phẩm...</p>
        ) : products.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {products.map((product) => (
              <div
                key={product.id}
                className="grid gap-2 px-4 py-4 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.6fr)_minmax(0,1.25fr)_minmax(100px,1.2fr)_52px_92px_86px] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <p
                    title={product.name}
                    className="line-clamp-2 break-words font-semibold text-slate-900"
                  >
                    {product.name}
                  </p>
                  <p className="mt-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-500 md:hidden" title={product.sku}>
                    SKU: {product.sku}
                  </p>
                </div>
                <p
                  title={product.sku}
                  className="min-w-0 truncate text-sm text-slate-700"
                >
                  {product.sku}
                </p>
                <p
                  title={getCategoryName(product, categories)}
                  className="min-w-0 truncate text-sm text-slate-700"
                >
                  {getCategoryName(product, categories)}
                </p>
                <p
                  className={[
                    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold md:text-right",
                    product.sale_price === null || product.sale_price === undefined ? "text-slate-400" : "text-slate-900"
                  ].join(" ")}
                  title={formatSalePrice(product.sale_price)}
                >
                  {formatSalePrice(product.sale_price)}
                </p>
                <p
                  className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-bold text-brand-800 md:text-right"
                  title={String(Number(product.total_quantity || 0))}
                >
                  {Number(product.total_quantity || 0)}
                </p>
                <div className="min-w-0 overflow-hidden md:text-center">
                  <span
                    className={[
                      "inline-flex max-w-full rounded-full px-2 py-1 text-xs font-semibold ring-1",
                      product.is_active
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                    ].join(" ")}
                    title={getProductStatusBadge(product)}
                  >
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                      {getProductStatusBadge(product)}
                    </span>
                  </span>
                </div>
                <div className="min-w-0 md:text-right">
                  <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                    <Link
                      to={`/admin/products/${product.id}/edit`}
                      className="whitespace-nowrap rounded-md border border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Sửa
                    </Link>
                    {product.is_active ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivateProduct(product)}
                        className="whitespace-nowrap rounded-md border border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Ngừng
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleActivateProduct(product)}
                        className="whitespace-nowrap rounded-md border border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Khôi phục
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-700">Không tìm thấy sản phẩm.</p>
            <p className="mt-1 text-xs text-slate-500">Thử tìm bằng tên, SKU hoặc loại sản phẩm khác.</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Tổng: <span className="font-semibold text-slate-900">{total}</span> sản phẩm
        </p>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Trước
          </button>
          <span className="min-w-28 text-center text-sm text-slate-700">
            Trang {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((prev) => (prev < totalPages ? prev + 1 : prev))}
            className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sau
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-4">
          <div
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-create-title"
          >
            <div className="border-b border-slate-200 px-5 py-3">
              <h3 id="product-create-title" className="text-base font-semibold text-slate-900">
                Thêm sản phẩm
              </h3>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm *</label>
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={newProductName}
                    onChange={(event) => setNewProductName(event.target.value)}
                    placeholder="Ví dụ: CPU Intel Core i5-12400F"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tình trạng</label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={newProductCondition}
                    onChange={(event) => setNewProductCondition(event.target.value)}
                  >
                    <option value="new">new</option>
                    <option value="2nd">2nd</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Loại sản phẩm *</label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={newProductCategoryId}
                    onChange={(event) => {
                      setNewProductCategoryId(event.target.value);
                      setCategoryInlineInfo("");
                    }}
                  >
                    <option value="">Chọn loại sản phẩm</option>
                    {categories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="mt-1.5 text-xs font-medium text-brand-700 hover:underline"
                    onClick={() => setShowCategoryCreateForm((prev) => !prev)}
                  >
                    + Tạo loại sản phẩm mới
                  </button>
                  {categoryInlineInfo && <p className="mt-2 text-xs text-emerald-700">{categoryInlineInfo}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mã sản phẩm / SKU *</label>
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={newProductSku}
                    onChange={(event) => {
                      setNewProductSku(event.target.value.toLowerCase());
                      setIsSkuManuallyEdited(true);
                      setError("");
                      setSuccess("");
                    }}
                    placeholder="2nd.maybo.lenovo.v50t13imb"
                  />
                  <p className="mt-1 text-xs text-slate-500">{SKU_HELPER_TEXT}</p>
                </div>

                <div className="md:col-span-2 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                  <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Đơn vị tính</label>
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
                    value="cái"
                    readOnly
                  />
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Xem trước</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">{createPreviewName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="break-all">{createPreviewSku}</span>
                      <span className="text-slate-300">•</span>
                      <span>{createPreviewCategory}</span>
                    </div>
                  </div>
                </div>
              </div>

              {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              {showCategoryCreateForm && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Tạo loại sản phẩm mới</h4>
                  <div className="mt-3">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tên loại sản phẩm *</label>
                    <input
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="Ví dụ: CPU"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSavingCategory}
                    onClick={handleCreateCategoryInline}
                    className="mt-3 h-10 rounded-md border border-brand-600 px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingCategory ? "Đang lưu..." : "Lưu loại sản phẩm"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-5 py-3">
              <button
                type="button"
                disabled={isSubmitting || isSavingCategory}
                onClick={closeCreateModal}
                className="h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting || isSavingCategory}
                onClick={handleCreateProduct}
                className="h-11 rounded-md border border-brand-600 px-4 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang lưu..." : "Lưu sản phẩm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-4">
          <div
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-edit-title"
          >
            <div className="border-b border-slate-200 px-5 py-3">
              <h3 id="product-edit-title" className="text-base font-semibold text-slate-900">
                Sửa sản phẩm
              </h3>
            </div>

            <div className="grid gap-3 overflow-y-auto px-5 py-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm *</label>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  value={editProductForm.name}
                  onChange={(event) => setEditProductForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Loại sản phẩm *</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  value={editProductForm.category_id}
                  onChange={(event) => setEditProductForm((prev) => ({ ...prev, category_id: event.target.value }))}
                >
                  <option value="">Chọn loại sản phẩm</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">SKU *</label>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  value={editProductForm.sku}
                  onChange={(event) => {
                    setEditProductForm((prev) => ({ ...prev, sku: event.target.value.toLowerCase() }));
                    setError("");
                    setSuccess("");
                  }}
                />
                <p className="mt-1 text-xs text-slate-500">{SKU_HELPER_TEXT}</p>
              </div>

              <div className="md:col-span-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Xem trước</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{editProductForm.name.trim() || "Tên sản phẩm"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="break-all">{editProductForm.sku.trim() || "SKU"}</span>
                  <span className="text-slate-300">•</span>
                  <span>{selectedEditCategory?.name || "Chưa chọn loại sản phẩm"}</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả / spec summary</label>
                <textarea
                  className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                  value={editProductForm.spec_summary}
                  onChange={(event) => setEditProductForm((prev) => ({ ...prev, spec_summary: event.target.value }))}
                />
              </div>

              {error && <p className="md:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-5 py-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={closeEditModal}
                className="h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleUpdateProduct}
                className="h-11 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
