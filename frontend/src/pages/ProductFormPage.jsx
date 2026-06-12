import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createCategoryRequest,
  createProductRequest,
  getProductRequest,
  listActiveCategories,
  updateProductRequest
} from "../services/inventoryOperations.service";

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

function buildSuggestedSku(productName, category, condition) {
  const categoryPrefix = toDotToken(category?.code || category?.name || "");
  const normalizedName = normalizeSkuChunk(productName);
  if (!categoryPrefix || !normalizedName) return "";
  return `${condition}.${categoryPrefix}.${toDotToken(normalizedName)}`;
}

function getCategoryById(categories, categoryId) {
  return categories.find((item) => Number(item.id) === Number(categoryId)) || null;
}

function getConditionFromSku(sku) {
  if (String(sku || "").startsWith("new.")) return "new";
  return "2nd";
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

  if (code === "VALIDATION_ERROR" && (hasSkuValidationError || normalizedMessage.includes("validation failed"))) {
    return SKU_FORMAT_MESSAGE;
  }

  return message || fallbackMessage;
}

function replaceSkuConditionPrefix(sku, nextCondition) {
  const value = String(sku || "").trim().toLowerCase();
  if (value.startsWith("new.")) return `${nextCondition}.${value.slice(4)}`;
  if (value.startsWith("2nd.")) return `${nextCondition}.${value.slice(4)}`;
  return value;
}

export function ProductFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: searchParams.get("name") || "",
    sku: "",
    category_id: "",
    condition: "2nd",
    unit: "cái",
    spec_summary: ""
  });
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [showCategoryCreateForm, setShowCategoryCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryInlineInfo, setCategoryInlineInfo] = useState("");
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCategory = useMemo(
    () => getCategoryById(categories, form.category_id),
    [categories, form.category_id]
  );

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const items = await listActiveCategories();
        if (active) setCategories(items);
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
    if (!isEditMode) return undefined;
    let active = true;

    async function loadProduct() {
      setIsLoading(true);
      setError("");
      try {
        const product = await getProductRequest(id);
        if (!active) return;
        setForm({
          name: product?.name || "",
          sku: product?.sku || "",
          category_id: product?.category_id ? String(product.category_id) : "",
          condition: getConditionFromSku(product?.sku),
          unit: "cái",
          spec_summary: product?.spec_summary || ""
        });
        setIsSkuManuallyEdited(true);
      } catch (err) {
        if (active) setError(err?.message || "Không thể tải sản phẩm.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadProduct();
    return () => {
      active = false;
    };
  }, [id, isEditMode]);

  useEffect(() => {
    if (isEditMode || isSkuManuallyEdited || !form.name.trim() || !selectedCategory) return;
    const suggestedSku = buildSuggestedSku(form.name, selectedCategory, form.condition);
    if (suggestedSku) {
      setForm((prev) => ({ ...prev, sku: suggestedSku }));
    }
  }, [form.condition, form.name, isEditMode, isSkuManuallyEdited, selectedCategory]);

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
    setError("");
    setSuccess("");
  }

  function handleConditionChange(event) {
    const nextCondition = event.target.value;
    setForm((prev) => ({
      ...prev,
      condition: nextCondition,
      sku: isEditMode || isSkuManuallyEdited ? replaceSkuConditionPrefix(prev.sku, nextCondition) : prev.sku
    }));
    setError("");
    setSuccess("");
  }

  async function reloadCategories() {
    const items = await listActiveCategories();
    setCategories(items);
    return items;
  }

  async function handleCreateCategoryInline() {
    setError("");
    setSuccess("");
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

      setForm((prev) => ({ ...prev, category_id: String(matched.id) }));
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
          setForm((prev) => ({ ...prev, category_id: String(existed.id) }));
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

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = form.name.trim();
    const sku = form.sku.trim().toLowerCase();
    const categoryId = form.category_id;

    if (!name) {
      setError("Vui lòng nhập tên sản phẩm.");
      return;
    }
    if (!sku) {
      setError("Vui lòng nhập mã sản phẩm / SKU.");
      return;
    }
    if (!SKU_PATTERN.test(sku)) {
      setError(SKU_FORMAT_MESSAGE);
      return;
    }
    if (!categoryId) {
      setError("Vui lòng chọn loại sản phẩm.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await updateProductRequest(id, {
          name,
          sku,
          category_id: Number(categoryId),
          spec_summary: form.spec_summary.trim() || null
        });
        setSuccess("Đã lưu sản phẩm.");
      } else {
        await createProductRequest({
          name,
          sku,
          category_id: Number(categoryId)
        });
        setSuccess("Đã thêm sản phẩm.");
      }
      navigate("/admin/products");
    } catch (err) {
      setError(getProductErrorMessage(err, isEditMode ? "Cập nhật sản phẩm thất bại." : "Thêm sản phẩm thất bại."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-100 -m-6">
      <form onSubmit={handleSubmit}>
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <Link to="/admin/products" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
              ← Quay lại danh sách sản phẩm
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/products"
                className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Thoát
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="h-10 rounded-md bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <section className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">Thông tin chung</h2>
              </div>

              <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                {isLoading ? (
                  <p className="md:col-span-2 text-sm text-slate-500">Đang tải sản phẩm...</p>
                ) : (
                  <>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm *</label>
                      <input
                        className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        value={form.name}
                        onChange={(event) => updateForm({ name: event.target.value })}
                        placeholder="Nhập tên sản phẩm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Mã sản phẩm / SKU *</label>
                      <input
                        className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        value={form.sku}
                        onChange={(event) => {
                          updateForm({ sku: event.target.value.toLowerCase() });
                          setIsSkuManuallyEdited(true);
                        }}
                        placeholder="2nd.maybo.lenovo.v50t13imb"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Loại sản phẩm *</label>
                      <select
                        className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        value={form.category_id}
                        onChange={(event) => updateForm({ category_id: event.target.value })}
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
                        onClick={() => {
                          setShowCategoryCreateForm((prev) => !prev);
                          setCategoryInlineInfo("");
                        }}
                      >
                        + Tạo loại sản phẩm mới
                      </button>
                      {categoryInlineInfo && <p className="mt-2 text-xs text-emerald-700">{categoryInlineInfo}</p>}
                    </div>

                    {showCategoryCreateForm && (
                      <div className="md:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                        <h3 className="text-sm font-semibold text-slate-900">Tạo loại sản phẩm mới</h3>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <input
                            className="h-10 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                            value={newCategoryName}
                            onChange={(event) => setNewCategoryName(event.target.value)}
                            placeholder="Nhập tên loại sản phẩm"
                          />
                          <button
                            type="button"
                            disabled={isSavingCategory}
                            onClick={handleCreateCategoryInline}
                            className="h-10 rounded border border-brand-600 px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSavingCategory ? "Đang lưu..." : "Lưu loại sản phẩm"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Tình trạng</label>
                      <select
                        className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        value={form.condition}
                        onChange={handleConditionChange}
                      >
                        <option value="new">new</option>
                        <option value="2nd">2nd</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Đơn vị tính</label>
                      <input
                        className="h-10 w-full rounded border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
                        value={form.unit}
                        readOnly
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả / spec summary</label>
                      <textarea
                        className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        value={form.spec_summary}
                        onChange={(event) => updateForm({ spec_summary: event.target.value })}
                        placeholder="Thông tin cấu hình ngắn nếu cần"
                      />
                    </div>

                    {error && (
                      <p className="md:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                    )}
                    {success && (
                      <p className="md:col-span-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {success}
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-base font-semibold text-slate-900">Xem trước</h3>
              </div>
              <div className="px-5 py-4">
                <p className="text-lg font-semibold text-slate-900">{form.name.trim() || "Tên sản phẩm"}</p>
                <div className="mt-3 divide-y divide-slate-100 border-y border-slate-100 text-sm">
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-slate-500">SKU</span>
                    <span className="break-all text-right font-medium text-slate-900">{form.sku.trim() || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-slate-500">Loại sản phẩm</span>
                    <span className="text-right font-medium text-slate-900">{selectedCategory?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-slate-500">Tình trạng</span>
                    <span className="font-medium text-slate-900">{form.condition}</span>
                  </div>
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-slate-500">Đơn vị</span>
                    <span className="font-medium text-slate-900">{form.unit}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Quy tắc SKU</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{SKU_HELPER_TEXT}</p>
            </section>
          </aside>
        </div>
      </form>
    </section>
  );
}
