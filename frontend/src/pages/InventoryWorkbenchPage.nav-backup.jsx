import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCategoryRequest,
  createProductRequest,
  getProductInventoryRequest,
  listActiveCategories,
  listActiveProducts,
  stockInRequest,
  stockOutRequest
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
      if (intelModelMatch?.[1]) {
        return `cpu.intel.${intelModelMatch[1]}`;
      }
      return `cpu.intel.${toDotToken(normalizedName)}`;
    }

    if (isAmd) {
      const amdModelMatch =
        normalizedName.match(/(?:^|\s)(?:r|ryzen)\s*([3579])\s*[- ]?([0-9]{3,5}[a-z]{0,2})\b/) ||
        normalizedName.match(/(?:^|\s)r([3579])\s*[- ]?([0-9]{3,5}[a-z]{0,2})\b/);
      if (amdModelMatch?.[1] && amdModelMatch?.[2]) {
        return `cpu.amd.r${amdModelMatch[1]}${amdModelMatch[2]}`;
      }
      return `cpu.amd.${toDotToken(normalizedName)}`;
    }
  }

  return `${categoryPrefix}.${toDotToken(normalizedName)}`;
}

export function InventoryWorkbenchPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductCategoryId, setNewProductCategoryId] = useState("");
  const [categoryInlineInfo, setCategoryInlineInfo] = useState("");
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);

  const [showCategoryCreateForm, setShowCategoryCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [actionType, setActionType] = useState("IN");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [warrantyNoteGroups, setWarrantyNoteGroups] = useState([]);
  const [selectedWarrantyNote, setSelectedWarrantyNote] = useState("");
  const [isLoadingWarrantyNotes, setIsLoadingWarrantyNotes] = useState(false);
  const quantityInputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!showCreateForm) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        cancelCreateProductFlow();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateForm]);

  const selectedProduct = useMemo(
    () => products.find((item) => String(item.id) === String(selectedProductId)) || null,
    [products, selectedProductId]
  );

  const currentStock = Number(selectedProduct?.total_quantity || 0);

  const selectedWarrantyGroup = useMemo(
    () => warrantyNoteGroups.find((item) => item.note === selectedWarrantyNote) || null,
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
  const showFirstProductEmptyState = !isLoading && products.length === 0 && !showCreateForm;

  const selectedCreateCategory = useMemo(
    () => getCategoryById(categories, newProductCategoryId),
    [categories, newProductCategoryId]
  );

  useEffect(() => {
    const keyword = normalizeText(debouncedSearch);
    if (!keyword) return;

    const exactSkuMatches = products.filter((item) => normalizeText(item.sku) === keyword);
    if (exactSkuMatches.length === 1) {
      setSelectedProductId(String(exactSkuMatches[0].id));
      setShowCreateForm(false);
      setShowCategoryCreateForm(false);
    }
  }, [debouncedSearch, products]);

  useEffect(() => {
    if (!showCreateForm || selectedProduct) return;
    if (!newProductName.trim() || !selectedCreateCategory) return;
    if (isSkuManuallyEdited && newProductSku.trim()) return;

    const suggestedSku = buildSuggestedSku(newProductName, selectedCreateCategory);
    if (suggestedSku) {
      setNewProductSku(suggestedSku);
    }
  }, [
    showCreateForm,
    selectedProduct,
    newProductName,
    selectedCreateCategory,
    isSkuManuallyEdited,
    newProductSku
  ]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setIsLoading(true);
      setError("");
      try {
        const [productItems, categoryItems] = await Promise.all([listActiveProducts(), listActiveCategories()]);
        if (!active) return;
        setProducts(productItems);
        setCategories(categoryItems);
      } catch (err) {
        if (active) setError(err?.message || "Không thể tải dữ liệu ban đầu.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

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

  async function reloadCategories() {
    const items = await listActiveCategories();
    setCategories(items);
    return items;
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
          note: item.note,
          quantity: Number(item.quantity || 0)
        }))
        .filter((item) => item.note && item.quantity > 0);

      setWarrantyNoteGroups(groups);
      if (selectedWarrantyNote && !groups.some((item) => item.note === selectedWarrantyNote)) {
        setSelectedWarrantyNote("");
        setNote("");
      }
      return groups;
    } finally {
      setIsLoadingWarrantyNotes(false);
    }
  }

  useEffect(() => {
    if (!selectedProduct || actionType !== "OUT") {
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
            note: item.note,
            quantity: Number(item.quantity || 0)
          }))
          .filter((item) => item.note && item.quantity > 0);

        setWarrantyNoteGroups(groups);
        setSelectedWarrantyNote((current) => (current && groups.some((item) => item.note === current) ? current : ""));
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
  }, [selectedProduct, actionType]);

  useEffect(() => {
    if (actionType === "OUT" && selectedWarrantyNote) {
      setNote(selectedWarrantyNote);
    }
  }, [actionType, selectedWarrantyNote]);

  function resetCreateForm(prefillSku = "") {
    setNewProductName("");
    setNewProductCategoryId("");
    setNewProductSku(prefillSku);
    setCategoryInlineInfo("");
    setIsSkuManuallyEdited(false);
    setShowCategoryCreateForm(false);
    setNewCategoryName("");
  }

  function openCreateProductFlow(prefillSku = "") {
    setSelectedProductId("");
    setActionType("IN");
    setShowCreateForm(true);
    setShowCategoryCreateForm(false);
    resetCreateForm(prefillSku);
  }

  function cancelCreateProductFlow() {
    setShowCreateForm(false);
    setShowCategoryCreateForm(false);
    resetCreateForm("");
    setError("");
  }

  async function handleCreateCategoryInline() {
    setError("");
    setCategoryInlineInfo("");

    const name = newCategoryName.trim();
    if (!name) {
      setError("Vui lòng nhập tên danh mục.");
      return;
    }

    setIsSavingCategory(true);
    try {
      const created = await createCategoryRequest({ name });
      const createdCategoryName = created?.name || name;
      const createdCategoryId = created?.id;

      if (createdCategoryId) {
        setCategories((prev) => {
          const existedById = prev.some((item) => Number(item.id) === Number(createdCategoryId));
          if (existedById) return prev;
          return [
            {
              ...created,
              id: createdCategoryId,
              name: createdCategoryName,
              is_active: true
            },
            ...prev
          ];
        });
        setNewProductCategoryId(String(createdCategoryId));
      }

      const nextCategories = await reloadCategories();
      const matchedById = createdCategoryId
        ? nextCategories.find((item) => Number(item.id) === Number(createdCategoryId))
        : null;
      const matchedByName = nextCategories.find(
        (item) => normalizeText(item.name) === normalizeText(createdCategoryName)
      );
      const matched = matchedById || matchedByName;

      if (!matched) {
        setError("Không thể tự động chọn danh mục vừa tạo.");
        return;
      }

      setNewProductCategoryId(String(matched.id));
      setShowCategoryCreateForm(false);
      setNewCategoryName("");
      setCategoryInlineInfo(`Đã chọn danh mục ${matched.name}`);
    } catch (err) {
      const errorCode = err?.payload?.error?.code;
      const message = String(err?.message || "").toLowerCase();
      const isDuplicateName =
        errorCode === "CATEGORY_NAME_ALREADY_EXISTS" || message.includes("category name already exists");

      if (isDuplicateName) {
        const nextCategories = await reloadCategories();
        const existed = nextCategories.find((item) => normalizeText(item.name) === normalizeText(name));
        if (existed) {
          setCategories(nextCategories);
          setNewProductCategoryId(String(existed.id));
          setShowCategoryCreateForm(false);
          setNewCategoryName("");
          setCategoryInlineInfo("Danh mục đã tồn tại, đã tự động chọn.");
        } else {
          setError("Không thể tự động chọn danh mục đã tồn tại.");
        }
      } else {
        setError(err?.message || "Lưu danh mục thất bại.");
      }
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function handleCreateProductInline() {
    const sku = newProductSku.trim();
    if (!newProductName.trim()) {
      setError("Vui lòng nhập tên sản phẩm.");
      return null;
    }
    if (!sku) {
      setError("Vui lòng nhập mã sản phẩm / SKU.");
      return null;
    }
    if (!newProductCategoryId) {
      setError("Vui lòng chọn danh mục.");
      return null;
    }

    const created = await createProductRequest({
      name: newProductName.trim(),
      sku,
      category_id: Number(newProductCategoryId)
    });

    await reloadProducts(created.sku);
    setShowCreateForm(false);
    setShowCategoryCreateForm(false);
    resetCreateForm("");
    setSearchInput(created.sku);
    setDebouncedSearch(created.sku);
    setActionType("IN");
    setSuccess(`Tạo sản phẩm thành công: ${created.name} (${created.sku}).`);
    window.setTimeout(() => quantityInputRef.current?.focus(), 0);
    return created;
  }

  async function handleCreateOnly() {
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await handleCreateProductInline();
    } catch (err) {
      const errorCode = err?.payload?.error?.code;
      const message = String(err?.message || "").toLowerCase();
      const isDuplicateSku = errorCode === "SKU_ALREADY_EXISTS" || message.includes("sku already exists");

      if (isDuplicateSku) {
        const sku = newProductSku.trim();
        const reloadedProducts = await listActiveProducts();
        setProducts(reloadedProducts);

        const existed = reloadedProducts.find((item) => normalizeText(item.sku) === normalizeText(sku));
        if (existed) {
          setSelectedProductId(String(existed.id));
          setSearchInput(existed.sku);
          setDebouncedSearch(existed.sku);
          setShowCreateForm(false);
          setShowCategoryCreateForm(false);
          resetCreateForm("");
          setSuccess("SKU đã tồn tại, đã tự động chọn sản phẩm.");
          setError("");
        } else {
          setError("SKU đã tồn tại nhưng chưa thể tự động chọn sản phẩm.");
        }
      } else {
        setError(err?.message || "Tạo sản phẩm mới thất bại.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const targetProduct = selectedProduct;
    if (!targetProduct) {
      setError("Chọn sản phẩm bên trái để nhập hoặc xuất kho.");
      return;
    }

    const numericQuantity = Number(quantity);
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      setError(
        actionType === "IN"
          ? "Số lượng nhập phải là số nguyên dương."
          : "Số lượng xuất phải là số nguyên dương."
      );
      return;
    }
    if (actionType === "OUT" && numericQuantity > Number(targetProduct.total_quantity || 0)) {
      setError(`Số lượng xuất vượt quá tồn hiện tại (${Number(targetProduct.total_quantity || 0)}).`);
      return;
    }
    if (actionType === "OUT" && warrantyNoteGroups.length > 0) {
      if (!selectedWarrantyGroup) {
        setError("Vui lòng chọn bảo hành cần xuất.");
        return;
      }
      if (numericQuantity > selectedWarrantyGroup.quantity) {
        setError(`Số lượng xuất vượt quá tồn của bảo hành ${selectedWarrantyGroup.note} (${selectedWarrantyGroup.quantity}).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const outboundNote =
        actionType === "OUT" && selectedWarrantyGroup ? selectedWarrantyGroup.note : note.trim() || undefined;
      const payload = {
        sku: targetProduct.sku,
        quantity: numericQuantity,
        note: outboundNote,
        ...(actionType === "OUT" && selectedWarrantyGroup ? { warranty_note: selectedWarrantyGroup.note } : {})
      };
      const result = actionType === "IN" ? await stockInRequest(payload) : await stockOutRequest(payload);

      await reloadProducts(targetProduct.sku);
      if (actionType === "OUT") {
        await reloadWarrantyNoteGroups(targetProduct.sku);
      }
      setSuccess(
        `${
          actionType === "IN" ? "Nhập kho" : "Xuất kho"
        } thành công cho SKU ${targetProduct.sku}. Tổng tồn mới: ${
          result?.inventory_balance?.quantity ?? "N/A"
        }.`
      );
      setQuantity("");
      if (actionType === "IN" || !selectedWarrantyGroup) {
        setNote("");
      }
    } catch (err) {
      setError(err?.message || "Thao tác tồn kho thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{"Quản lý kho"}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {"Tìm sản phẩm, sau đó nhập hoặc xuất kho ngay trên cùng một màn hình."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-12">
        <section className="space-y-5 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{"Tìm sản phẩm"}</h3>
            <label className="mt-4 mb-1 block text-sm font-medium text-slate-700">
              {"Tìm sản phẩm theo tên hoặc SKU"}
            </label>
            <input
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Nhập tên sản phẩm hoặc SKU"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSelectedProductId("");
                setShowCreateForm(false);
                setCategoryInlineInfo("");
                setSuccess("");
              }}
            />
            <div className="mt-3">
              <button
                type="button"
                className="rounded-md border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                onClick={() => openCreateProductFlow(searchInput.trim())}
              >
                {"+ Tạo sản phẩm mới"}
              </button>
            </div>

            {isLoading && <p className="mt-3 text-sm text-slate-500">{"Đang tải dữ liệu sản phẩm..."}</p>}

            {!isLoading && filteredProducts.length > 0 && (
              <div className="mt-4 space-y-2">
                {filteredProducts.map((item) => {
                  const isSelected = String(item.id) === String(selectedProductId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(String(item.id));
                        setShowCreateForm(false);
                        setSearchInput(item.sku);
                        setDebouncedSearch(item.sku);
                        setSuccess("");
                      }}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-brand-600 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-2 text-base font-bold text-brand-800">
                        {Number(item.total_quantity || 0)}{" "}
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {"tồn hiện tại"}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">SKU: {item.sku}</p>
                      <p className="mt-1 text-xs text-slate-600">{"Danh mục: "}{getCategoryName(item, categories)}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {showFirstProductEmptyState && (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">{"Chưa có sản phẩm nào."}</p>
                <button
                  type="button"
                  className="mt-3 rounded-md border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  onClick={() => openCreateProductFlow(searchInput.trim())}
                >
                  {"+ Tạo sản phẩm đầu tiên"}
                </button>
              </div>
            )}

            {showNoResultState && (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">{"Không tìm thấy sản phẩm."}</p>
                <button
                  type="button"
                  className="mt-3 rounded-md border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  onClick={() => openCreateProductFlow(searchInput.trim())}
                >
                  {"+ Tạo sản phẩm mới"}
                </button>
              </div>
            )}
          </div>

        </section>

        <aside className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h3 className="text-base font-semibold text-slate-900">{"Thao tác tồn kho"}</h3>

            {!selectedProduct ? (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                {"Chọn sản phẩm bên trái để nhập hoặc xuất kho."}
              </p>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-2xl font-bold text-slate-900">{selectedProduct.name}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="text-xs text-slate-600">SKU: {selectedProduct.sku}</p>
                  <p className="text-xs text-slate-600">
                    {"Danh mục: "}{getCategoryName(selectedProduct, categories)}
                  </p>
                </div>
                <div className="mt-4 rounded-md bg-white px-4 py-4 text-center">
                  <p className="text-5xl font-extrabold leading-none text-brand-800">{currentStock}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    {"TỒN HIỆN TẠI"}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 inline-flex w-full rounded-lg border border-slate-300 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActionType("IN")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  actionType === "IN" ? "bg-white text-brand-800 shadow-sm" : "text-slate-700 hover:text-slate-900"
                }`}
              >
                {"Nhập kho"}
              </button>
              <button
                type="button"
                onClick={() => setActionType("OUT")}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  actionType === "OUT" ? "bg-white text-brand-800 shadow-sm" : "text-slate-700 hover:text-slate-900"
                }`}
              >
                {"Xuất kho"}
              </button>
            </div>

            {selectedProduct && actionType === "OUT" && (
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
                      <option key={group.note} value={group.note}>
                        {group.note} - còn {group.quantity}
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
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {actionType === "IN" ? "Số lượng nhập *" : "Số lượng xuất *"}
              </label>
              <input
                ref={quantityInputRef}
                type="number"
                min={1}
                max={actionType === "OUT" && selectedWarrantyGroup ? selectedWarrantyGroup.quantity : undefined}
                step={1}
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={actionType === "IN" ? "Nhập số lượng nhập" : "Nhập số lượng xuất"}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {actionType === "IN" ? "Ghi chú bảo hành / ghi chú nhập hàng" : "Ghi chú xuất kho"}
              </label>
              <textarea
                rows={5}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={actionType === "IN" ? "Ví dụ: BH07.26" : "Nhập lý do hoặc mô tả xuất kho"}
              />
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            {success && <p className="mt-4 text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              disabled={isSubmitting || isLoading || isSavingCategory}
              className="mt-5 h-11 w-full rounded-md bg-brand-700 px-5 text-sm font-medium text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Đang xử lý..."
                : actionType === "IN"
                ? "Lưu và nhập kho"
                : "Xác nhận xuất kho"}
            </button>
          </div>
        </aside>
      </form>

      {showCreateForm && !selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-4">
          <div
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-product-title"
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 id="create-product-title" className="text-base font-semibold text-slate-900">
                Tạo sản phẩm mới
              </h3>
              <p className="mt-1 text-sm text-slate-500">Nhập thông tin sản phẩm để tiếp tục thao tác tồn kho.</p>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Tên sản phẩm *</label>
                  <input
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={newProductName}
                    onChange={(event) => setNewProductName(event.target.value)}
                    placeholder="Ví dụ: CPU Intel Core i5-12400F"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mã sản phẩm / SKU *</label>
                  <input
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={newProductSku}
                    onChange={(event) => {
                      setNewProductSku(event.target.value);
                      setIsSkuManuallyEdited(true);
                    }}
                    placeholder="cpu.intel.12400f"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Danh mục *</label>
                  <select
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                    value={newProductCategoryId}
                    onChange={(event) => {
                      setNewProductCategoryId(event.target.value);
                      setCategoryInlineInfo("");
                    }}
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-brand-700 hover:underline"
                    onClick={() => setShowCategoryCreateForm((prev) => !prev)}
                  >
                    + Tạo danh mục mới
                  </button>
                  {categoryInlineInfo && <p className="mt-2 text-xs text-emerald-700">{categoryInlineInfo}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Đơn vị tính</label>
                  <input
                    className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
                    value="cái"
                    readOnly
                  />
                </div>
              </div>

              {showCategoryCreateForm && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Tạo danh mục mới</h4>
                  <div className="mt-3">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Tên danh mục *</label>
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
                    {isSavingCategory ? "Đang lưu..." : "Lưu danh mục"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
              <button
                type="button"
                disabled={isSubmitting || isSavingCategory}
                onClick={cancelCreateProductFlow}
                className="h-11 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmitting || isSavingCategory}
                onClick={handleCreateOnly}
                className="h-11 rounded-md border border-brand-600 px-4 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Đang tạo sản phẩm..." : "Tạo sản phẩm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
