import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AuthenticatedImage } from "../components/AuthenticatedImage";
import {
  createCategoryRequest,
  createProductRequest,
  deleteCategoryRequest,
  deleteProductImage,
  downloadProductImage,
  getProductRequest,
  listActiveCategories,
  listProductImages,
  replaceProductImage,
  reorderProductImages,
  uploadProductImages,
  updateCategoryRequest,
  updateProductRequest
} from "../services/inventoryOperations.service";

const SKU_PATTERN = /^[a-z0-9]+(\.[a-z0-9]+)*$/i;
const SKU_FORMAT_MESSAGE = "SKU không hợp lệ. Chỉ dùng chữ thường, số và dấu chấm.";
const SKU_DUPLICATE_MESSAGE = "SKU này đã tồn tại. Vui lòng dùng SKU khác.";
const SKU_HELPER_TEXT = "SKU chỉ dùng chữ thường, số và dấu chấm. Ví dụ: 2nd.maybo.lenovo.v50t13imb";
const MAX_SALE_PRICE = 999999999999999;
const SALE_PRICE_INTEGER_MESSAGE = "Giá bán phải là số nguyên không âm.";
const SALE_PRICE_MAX_MESSAGE = "Giá bán vượt quá giới hạn cho phép.";
const CATEGORY_REQUIRED_MESSAGE = "Vui lòng chọn loại sản phẩm.";
const CATEGORY_CODE_ALIASES = {
  main: "mainboard"
};
const MAX_PRODUCT_IMAGES = 3;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getImageFileError(file) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return `${file.name}: chỉ chấp nhận JPEG, PNG hoặc WebP.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}: vượt quá 15 MB.`;
  }
  return "";
}

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

function getCategoryCodeFromSku(sku) {
  const parts = String(sku || "").trim().toLowerCase().split(".");
  const token = parts[1]?.trim() || "";
  return CATEGORY_CODE_ALIASES[token] || token;
}

function getCategoryByCode(categories, code) {
  if (!code) return null;
  return categories.find((item) => String(item.code || "").trim().toLowerCase() === code) || null;
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

  if (code === "VALIDATION_ERROR" && hasSkuValidationError) {
    return SKU_FORMAT_MESSAGE;
  }

  return message || fallbackMessage;
}

function hasCategoryValidationError(error) {
  const code = error?.payload?.error?.code;
  const details = error?.payload?.error?.details || [];
  const normalizedMessage = String(error?.message || "").toLowerCase();
  const hasCategoryDetail = details.some((detail) => {
    const field = String(detail?.field || "").toLowerCase();
    const issue = String(detail?.issue || "").toLowerCase();
    return field.includes("category_id") || issue.includes("category_id");
  });

  return (
    (code === "VALIDATION_ERROR" && hasCategoryDetail) ||
    (code === "RESOURCE_NOT_FOUND" && normalizedMessage.includes("category"))
  );
}

function replaceSkuConditionPrefix(sku, nextCondition) {
  const value = String(sku || "").trim().toLowerCase();
  if (value.startsWith("new.")) return `${nextCondition}.${value.slice(4)}`;
  if (value.startsWith("2nd.")) return `${nextCondition}.${value.slice(4)}`;
  return value;
}

function salePriceToInput(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeSalePriceInput(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return { value: null, error: "" };
  }

  const hasSeparator = /[.,]/.test(rawValue);
  const isValidDigits = /^\d+$/.test(rawValue);
  const isValidGroupedNumber = /^\d{1,3}([.,]\d{3})+$/.test(rawValue);

  if (!isValidDigits && !(hasSeparator && isValidGroupedNumber)) {
    return { value: null, error: SALE_PRICE_INTEGER_MESSAGE };
  }

  const normalizedValue = rawValue.replace(/[.,]/g, "");
  const numericValue = Number(normalizedValue);
  if (!Number.isSafeInteger(numericValue) || numericValue > MAX_SALE_PRICE) {
    return { value: null, error: SALE_PRICE_MAX_MESSAGE };
  }

  return { value: numericValue, error: "" };
}

function formatSalePricePreview(value) {
  const normalized = normalizeSalePriceInput(value);
  if (normalized.error || normalized.value === null) return "-";
  return `${normalized.value.toLocaleString("vi-VN")} VND`;
}

export function ProductFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = Boolean(id);
  const categorySelectRef = useRef(null);
  const hasUserEditedSkuRef = useRef(false);
  const pendingImagesRef = useRef([]);

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: searchParams.get("name") || "",
    sku: "",
    category_id: "",
    condition: "2nd",
    unit: "cái",
    spec_summary: "",
    sale_price: ""
  });
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [categorySelectionSource, setCategorySelectionSource] = useState(isEditMode ? "manual" : "empty");
  const [showCategoryCreateForm, setShowCategoryCreateForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryInlineInfo, setCategoryInlineInfo] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [categoryRenameValue, setCategoryRenameValue] = useState("");
  const [categoryRenameError, setCategoryRenameError] = useState("");
  const [categoryManagerMessage, setCategoryManagerMessage] = useState("");
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isRenamingCategory, setIsRenamingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [productImages, setProductImages] = useState([]);
  const [pendingImages, setPendingImages] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageErrors, setImageErrors] = useState([]);
  const [isDraggingImages, setIsDraggingImages] = useState(false);

  useEffect(() => {
    if (location.state?.imageUploadError) {
      setError(`Sản phẩm đã được tạo nhưng tải ảnh thất bại: ${location.state.imageUploadError}`);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => () => {
    pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

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
          spec_summary: product?.spec_summary || "",
          sale_price: salePriceToInput(product?.sale_price)
        });
        setIsSkuManuallyEdited(true);
        setCategorySelectionSource(product?.category_id ? "manual" : "empty");
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

  async function reloadProductImages(productId = id) {
    if (!productId) return [];
    setIsLoadingImages(true);
    try {
      const images = await listProductImages(productId);
      setProductImages(images);
      return images;
    } finally {
      setIsLoadingImages(false);
    }
  }

  useEffect(() => {
    if (!isEditMode) return;
    reloadProductImages().catch((err) => {
      setError(err?.message || "Không thể tải ảnh sản phẩm.");
    });
  }, [id, isEditMode]);

  useEffect(() => {
    if (isEditMode || isSkuManuallyEdited || !form.name.trim() || !selectedCategory) return;
    const suggestedSku = buildSuggestedSku(form.name, selectedCategory, form.condition);
    if (suggestedSku) {
      setForm((prev) => ({ ...prev, sku: suggestedSku }));
    }
  }, [form.condition, form.name, isEditMode, isSkuManuallyEdited, selectedCategory]);

  useEffect(() => {
    if (!categories.length || categorySelectionSource === "manual") return;
    if (isEditMode && !hasUserEditedSkuRef.current) return;

    const categoryCode = getCategoryCodeFromSku(form.sku);
    const matchedCategory = getCategoryByCode(categories, categoryCode);
    if (!matchedCategory) return;

    const matchedCategoryId = String(matchedCategory.id);
    if (form.category_id === matchedCategoryId && categorySelectionSource === "suggested") return;

    setForm((prev) => ({ ...prev, category_id: matchedCategoryId }));
    setCategorySelectionSource("suggested");
    setCategoryInlineInfo("Đã gợi ý từ SKU");
    clearFieldError("category_id");
  }, [categories, categorySelectionSource, form.category_id, form.sku, isEditMode]);

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
    setError("");
    setSuccess("");
  }

  function clearFieldError(field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: "" };
    });
  }

  function focusCategoryField() {
    window.requestAnimationFrame(() => {
      const control = categorySelectRef.current;
      if (!control) return;
      control.focus({ preventScroll: true });
      control.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function showCategoryError() {
    setFieldErrors((prev) => ({ ...prev, category_id: CATEGORY_REQUIRED_MESSAGE }));
    focusCategoryField();
  }

  function handleCategoryChange(event) {
    const nextCategoryId = event.target.value;
    updateForm({ category_id: nextCategoryId });
    setCategorySelectionSource(nextCategoryId ? "manual" : "empty");
    setCategoryInlineInfo("");
    clearFieldError("category_id");
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
      setCategorySelectionSource("manual");
      clearFieldError("category_id");
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
          setCategorySelectionSource("manual");
          clearFieldError("category_id");
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

  function openCategoryManager() {
    setShowCategoryManager(true);
    setShowCategoryCreateForm(false);
    setCategoryInlineInfo("");
    setCategoryManagerMessage("");
    setCategoryRenameError("");
    setEditingCategoryId("");
    setCategoryRenameValue("");
  }

  function closeCategoryManager() {
    setShowCategoryManager(false);
    setCategoryManagerMessage("");
    setCategoryRenameError("");
    setEditingCategoryId("");
    setCategoryRenameValue("");
  }

  function startCategoryRename(category) {
    setEditingCategoryId(String(category.id));
    setCategoryRenameValue(category.name || "");
    setCategoryRenameError("");
    setCategoryManagerMessage("");
  }

  function cancelCategoryRename() {
    setEditingCategoryId("");
    setCategoryRenameValue("");
    setCategoryRenameError("");
  }

  async function handleRenameCategory(category) {
    const nextName = categoryRenameValue.trim();
    if (!nextName) {
      setCategoryRenameError("Vui lòng nhập tên loại sản phẩm.");
      return;
    }

    setIsRenamingCategory(true);
    setCategoryRenameError("");
    setCategoryManagerMessage("");
    setError("");
    setSuccess("");

    try {
      const updated = await updateCategoryRequest(category.id, { name: nextName });
      await reloadCategories();
      setEditingCategoryId("");
      setCategoryRenameValue("");
      setCategoryManagerMessage(`Đã đổi tên loại sản phẩm thành ${updated?.name || nextName}.`);
    } catch (err) {
      setCategoryRenameError(err?.message || "Đổi tên loại sản phẩm thất bại.");
    } finally {
      setIsRenamingCategory(false);
    }
  }

  async function handleDeleteCategory(category) {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xoá loại sản phẩm "${category.name}"?\nChỉ loại chưa có sản phẩm mới có thể xoá.`
    );
    if (!confirmed) return;

    setDeletingCategoryId(String(category.id));
    setCategoryRenameError("");
    setCategoryManagerMessage("");
    setError("");
    setSuccess("");

    try {
      await deleteCategoryRequest(category.id);
      await reloadCategories();
      if (String(form.category_id) === String(category.id)) {
        setForm((prev) => ({ ...prev, category_id: "" }));
        setCategorySelectionSource("empty");
        clearFieldError("category_id");
      }
      if (editingCategoryId === String(category.id)) {
        cancelCategoryRename();
      }
      setCategoryManagerMessage(`Đã xoá loại sản phẩm ${category.name}.`);
    } catch (err) {
      const code = err?.payload?.error?.code;
      const status = err?.status || err?.payload?.error?.status;
      if (code === "CATEGORY_IN_USE" || status === 409) {
        setCategoryRenameError("Không thể xoá loại sản phẩm vì đang có sản phẩm sử dụng.");
      } else {
        setCategoryRenameError(err?.message || "Xoá loại sản phẩm thất bại.");
      }
    } finally {
      setDeletingCategoryId("");
    }
  }

  function addPendingImages(files) {
    setPendingImages((current) => [
      ...current,
      ...files.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ]);
  }

  async function processSelectedImages(files) {
    if (!files.length) return;

    const remainingSlots = MAX_PRODUCT_IMAGES - productImages.length - pendingImages.length;
    if (files.length > remainingSlots) {
      setImageErrors([`Chỉ còn ${remainingSlots} vị trí ảnh. Mỗi sản phẩm tối đa ${MAX_PRODUCT_IMAGES} ảnh.`]);
      return;
    }

    const validationErrors = files.map(getImageFileError).filter(Boolean);
    const validFiles = files.filter((file) => !getImageFileError(file));
    setImageErrors(validationErrors);
    if (!validFiles.length) return;

    setError("");
    if (!isEditMode) {
      addPendingImages(validFiles);
      return;
    }

    setIsUploadingImages(true);
    const failedFiles = [...validationErrors];
    for (const file of validFiles) {
      try {
        await uploadProductImages(id, [file]);
      } catch (err) {
        failedFiles.push(`${file.name}: ${err?.message || "Tải ảnh thất bại."}`);
      }
    }
    try {
      await reloadProductImages();
    } catch (err) {
      setError(`Ảnh đã tải lên nhưng chưa thể làm mới danh sách: ${err?.message || "Vui lòng tải lại trang."}`);
    } finally {
      setIsUploadingImages(false);
    }
    setImageErrors(failedFiles);
  }

  async function handleImageSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await processSelectedImages(files);
  }

  async function handleImageDrop(event) {
    event.preventDefault();
    setIsDraggingImages(false);
    await processSelectedImages(Array.from(event.dataTransfer.files || []));
  }

  function removePendingImage(key) {
    setPendingImages((current) => {
      const target = current.find((image) => image.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((image) => image.key !== key);
    });
  }

  function movePendingImage(index, direction) {
    setPendingImages((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function replacePendingImage(key, file) {
    const issue = getImageFileError(file);
    if (issue) {
      setImageErrors([issue]);
      return;
    }
    setImageErrors([]);
    setPendingImages((current) => current.map((image) => {
      if (image.key !== key) return image;
      URL.revokeObjectURL(image.previewUrl);
      return {
        ...image,
        file,
        key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        previewUrl: URL.createObjectURL(file)
      };
    }));
  }

  async function handleReplaceStoredImage(image, file) {
    const issue = getImageFileError(file);
    if (issue) {
      setImageErrors([issue]);
      return;
    }
    setImageErrors([]);
    setIsUploadingImages(true);
    try {
      setProductImages(await replaceProductImage(id, image.id, file));
    } catch (err) {
      setImageErrors([`${file.name}: ${err?.message || "Thay ảnh thất bại."}`]);
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function moveStoredImage(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= productImages.length) return;
    const next = [...productImages];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setIsUploadingImages(true);
    setError("");
    try {
      setProductImages(await reorderProductImages(id, next.map((image) => image.id)));
    } catch (err) {
      setError(err?.message || "Không thể đổi thứ tự ảnh.");
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function handleDeleteStoredImage(image) {
    setIsUploadingImages(true);
    setError("");
    try {
      await deleteProductImage(id, image.id);
      await reloadProductImages();
    } catch (err) {
      setError(err?.message || "Không thể xóa ảnh.");
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = form.name.trim();
    const sku = form.sku.trim().toLowerCase();
    const categoryId = form.category_id;
    const validCategory = getCategoryById(categories, categoryId);

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
    if (!categoryId || !validCategory) {
      showCategoryError();
      return;
    }
    const salePrice = normalizeSalePriceInput(form.sale_price);
    if (salePrice.error) {
      setError(salePrice.error);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await updateProductRequest(id, {
          name,
          sku,
          category_id: Number(categoryId),
          spec_summary: form.spec_summary.trim() || null,
          sale_price: salePrice.value
        });
        setSuccess("Đã lưu sản phẩm.");
      } else {
        const created = await createProductRequest({
          name,
          sku,
          category_id: Number(categoryId),
          sale_price: salePrice.value
        });
        if (pendingImages.length > 0) {
          const failedImages = [];
          for (const image of pendingImages) {
            try {
              await uploadProductImages(created.id, [image.file]);
            } catch (imageError) {
              failedImages.push(`${image.file.name}: ${imageError?.message || "Tải ảnh thất bại"}`);
            }
          }
          if (failedImages.length > 0) {
            navigate(`/admin/products/${created.id}/edit`, {
              replace: true,
              state: { imageUploadError: failedImages.join("; ") }
            });
            return;
          }
        }
        setSuccess("Đã thêm sản phẩm.");
      }
      navigate("/admin/products");
    } catch (err) {
      if (hasCategoryValidationError(err)) {
        showCategoryError();
      } else {
        setError(
          getProductErrorMessage(err, isEditMode ? "Cập nhật sản phẩm thất bại." : "Thêm sản phẩm thất bại.")
        );
      }
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
                disabled={isSubmitting || isLoading || isUploadingImages}
                className="h-10 rounded-md bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-5">
          <h1 className="text-xl font-bold text-slate-900">{isEditMode ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h1>
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
                          hasUserEditedSkuRef.current = true;
                          updateForm({ sku: event.target.value.toLowerCase() });
                          setIsSkuManuallyEdited(true);
                        }}
                        placeholder="2nd.maybo.lenovo.v50t13imb"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Loại sản phẩm *</label>
                      <select
                        ref={categorySelectRef}
                        className={[
                          "h-10 w-full rounded border px-3 text-sm outline-none focus:ring-1",
                          fieldErrors.category_id
                            ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                            : "border-slate-300 focus:border-brand-500 focus:ring-brand-500"
                        ].join(" ")}
                        value={form.category_id}
                        onChange={handleCategoryChange}
                        aria-invalid={Boolean(fieldErrors.category_id)}
                        aria-describedby={fieldErrors.category_id ? "product-category-error" : undefined}
                      >
                        <option value="">Chọn loại sản phẩm</option>
                        {categories.map((category) => (
                          <option key={category.id} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.category_id && (
                        <p id="product-category-error" className="mt-1 text-xs font-medium text-red-600">
                          {fieldErrors.category_id}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-700 hover:underline"
                          onClick={() => {
                            setShowCategoryCreateForm((prev) => !prev);
                            setShowCategoryManager(false);
                            setCategoryInlineInfo("");
                          }}
                        >
                          + Tạo loại sản phẩm mới
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-slate-700 hover:text-brand-700 hover:underline"
                          onClick={openCategoryManager}
                        >
                          Quản lý loại
                        </button>
                      </div>
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

                    {showCategoryManager && (
                      <div className="md:col-span-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">Quản lý loại sản phẩm</h3>
                            <p className="text-xs text-slate-500">Có thể đổi tên loại hiện có. Chỉ xoá được loại chưa có sản phẩm sử dụng.</p>
                          </div>
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            onClick={closeCategoryManager}
                          >
                            Đóng
                          </button>
                        </div>

                        {categoryManagerMessage && (
                          <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                            {categoryManagerMessage}
                          </p>
                        )}
                        {categoryRenameError && (
                          <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                            {categoryRenameError}
                          </p>
                        )}

                        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                          {categories.map((category) => {
                            const isEditingCategory = editingCategoryId === String(category.id);
                            return (
                              <div key={category.id} className="rounded border border-slate-200 p-2">
                                {isEditingCategory ? (
                                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                                    <input
                                      className="h-9 rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                      value={categoryRenameValue}
                                      onChange={(event) => {
                                        setCategoryRenameValue(event.target.value);
                                        setCategoryRenameError("");
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Escape") cancelCategoryRename();
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          handleRenameCategory(category);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      disabled={isRenamingCategory}
                                      onClick={() => handleRenameCategory(category)}
                                      className="h-9 rounded bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isRenamingCategory}
                                      onClick={cancelCategoryRename}
                                      className="h-9 rounded border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-slate-900">{category.name}</p>
                                      <p className="truncate text-xs text-slate-500">Mã: {category.code}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                      <button
                                        type="button"
                                        disabled={Boolean(deletingCategoryId)}
                                        className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={() => startCategoryRename(category)}
                                      >
                                        Đổi tên
                                      </button>
                                      <button
                                        type="button"
                                        disabled={Boolean(deletingCategoryId)}
                                        className="rounded border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        onClick={() => handleDeleteCategory(category)}
                                      >
                                        {deletingCategoryId === String(category.id) ? "Đang xoá..." : "Xóa"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Giá bán</label>
                      <div className="relative">
                        <input
                          className="h-10 w-full rounded border border-slate-300 px-3 pr-14 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                          value={form.sale_price}
                          inputMode="numeric"
                          onChange={(event) => updateForm({ sale_price: event.target.value })}
                          placeholder="Nhập giá bán"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                          VND
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Giá bán mặc định, có thể để trống.</p>
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

            <section className="rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Ảnh sản phẩm</h2>
                  <p className="mt-1 text-xs text-slate-500">Tối đa 3 ảnh JPEG, PNG hoặc WebP; mỗi ảnh tối đa 15 MB.</p>
                </div>
                <label className="inline-flex h-9 cursor-pointer items-center rounded border border-brand-600 px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">
                  + Thêm ảnh
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    disabled={isUploadingImages || productImages.length + pendingImages.length >= MAX_PRODUCT_IMAGES}
                    onChange={handleImageSelection}
                  />
                </label>
              </div>
              <div
                className={[
                  "px-5 py-4 transition-colors",
                  isDraggingImages ? "bg-brand-50" : ""
                ].join(" ")}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingImages(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingImages(false);
                }}
                onDrop={handleImageDrop}
              >
                {isUploadingImages && (
                  <p className="mb-3 rounded bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                    Đang xử lý ảnh...
                  </p>
                )}
                {imageErrors.length > 0 && (
                  <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                    {imageErrors.map((message) => <p key={message}>{message}</p>)}
                  </div>
                )}
                {isDraggingImages && (
                  <p className="mb-3 rounded border border-dashed border-brand-400 bg-white px-3 py-4 text-center text-sm font-medium text-brand-700">
                    Thả ảnh vào đây để thêm.
                  </p>
                )}
                {isLoadingImages ? (
                  <p className="text-sm text-slate-500">Đang tải ảnh sản phẩm...</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {productImages.map((image, index) => (
                      <article key={image.id} className="min-w-0 rounded border border-slate-200 bg-white p-2">
                        <div className="relative aspect-square overflow-hidden rounded bg-slate-100">
                          <AuthenticatedImage
                            path={`/admin/products/${id}/images/${image.id}/thumbnail`}
                            alt={form.name || image.original_name}
                            className="h-full w-full object-contain"
                          />
                          {index === 0 && (
                            <span className="absolute left-2 top-2 rounded bg-brand-700 px-2 py-1 text-[11px] font-semibold text-white">
                              Ảnh chính
                            </span>
                          )}
                        </div>
                        <p className="mt-2 truncate text-xs text-slate-600" title={image.original_name}>{image.original_name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button type="button" disabled={index === 0 || isUploadingImages} onClick={() => moveStoredImage(index, -1)} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">←</button>
                          <button type="button" disabled={index === productImages.length - 1 || isUploadingImages} onClick={() => moveStoredImage(index, 1)} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">→</button>
                          <label className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs">
                            Thay ảnh
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              disabled={isUploadingImages}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) handleReplaceStoredImage(image, file);
                              }}
                            />
                          </label>
                          <button type="button" onClick={() => downloadProductImage(id, image)} className="rounded border border-slate-300 px-2 py-1 text-xs">Tải gốc</button>
                          <button type="button" disabled={isUploadingImages} onClick={() => handleDeleteStoredImage(image)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-40">Xóa</button>
                        </div>
                      </article>
                    ))}
                    {pendingImages.map((image, index) => {
                      const absoluteIndex = productImages.length + index;
                      return (
                        <article key={image.key} className="min-w-0 rounded border border-dashed border-brand-300 bg-brand-50/30 p-2">
                          <div className="relative aspect-square overflow-hidden rounded bg-white">
                            <img src={image.previewUrl} alt={image.file.name} className="h-full w-full object-contain" />
                            {absoluteIndex === 0 && (
                              <span className="absolute left-2 top-2 rounded bg-brand-700 px-2 py-1 text-[11px] font-semibold text-white">Ảnh chính</span>
                            )}
                          </div>
                          <p className="mt-2 truncate text-xs text-slate-600" title={image.file.name}>{image.file.name}</p>
                          <div className="mt-2 flex gap-1">
                            <button type="button" disabled={index === 0} onClick={() => movePendingImage(index, -1)} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">←</button>
                            <button type="button" disabled={index === pendingImages.length - 1} onClick={() => movePendingImage(index, 1)} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">→</button>
                            <label className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs">
                              Thay ảnh
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.target.value = "";
                                  if (file) replacePendingImage(image.key, file);
                                }}
                              />
                            </label>
                            <button type="button" onClick={() => removePendingImage(image.key)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600">Xóa</button>
                          </div>
                        </article>
                      );
                    })}
                    {Array.from({
                      length: Math.max(0, MAX_PRODUCT_IMAGES - productImages.length - pendingImages.length)
                    }).map((_, index) => {
                      const slotNumber = productImages.length + pendingImages.length + index + 1;
                      return (
                        <label
                          key={`empty-slot-${slotNumber}`}
                          className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50"
                        >
                          <span className="font-medium">Ảnh {slotNumber}{slotNumber === 1 ? " - Đại diện" : ""}</span>
                          <span className="mt-1 text-xs">Bấm hoặc kéo thả để chọn ảnh</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={isUploadingImages}
                            onChange={handleImageSelection}
                          />
                        </label>
                      );
                    })}
                  </div>
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
                  <div className="flex justify-between gap-3 py-2">
                    <span className="text-slate-500">Giá bán</span>
                    <span className="text-right font-medium text-slate-900">{formatSalePricePreview(form.sale_price)}</span>
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
