import { useEffect, useMemo, useRef, useState } from "react";
import { listActiveCategories } from "../services/inventoryOperations.service";
import {
  createSkuCategoryRule,
  deleteSkuCategoryRule,
  listSkuCategoryRules,
  updateSkuCategoryRule
} from "../services/skuCategoryRules.service";
import {
  extractSecondSkuToken,
  filterSkuCategoryRuleGroups,
  findSkuCategoryRule,
  groupSkuCategoryRules,
  normalizeSkuRuleToken
} from "../utils/skuCategoryRules";

const EMPTY_FORM = { token: "", category_id: "" };

function ActionIcon({ name }) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 17,
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 17
  };
  if (name === "delete") {
    return (
      <svg {...common}>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function validateTokenInput(value) {
  const token = normalizeSkuRuleToken(value);
  if (!token) return { token, error: "Vui lòng nhập token." };
  if (token.includes(".") || /\s/.test(token)) {
    return { token, error: "Token không được chứa dấu chấm hoặc khoảng trắng." };
  }
  return { token, error: "" };
}

function isValidCategory(category) {
  return (
    Number.isInteger(Number(category?.id)) &&
    Number(category.id) > 0 &&
    Boolean(String(category?.name || "").trim())
  );
}

function CreateRuleModal({
  form,
  setForm,
  categories,
  categoriesLoading,
  error,
  saving,
  onCancel,
  onSubmit
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, saving]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-sku-rule-title"
      >
        <h2 id="create-sku-rule-title" className="text-lg font-bold text-slate-900">Thêm quy ước</h2>
        <p className="mt-1 text-sm text-slate-500">
          Hệ thống đọc token thứ 2 trong SKU, ngăn cách bằng dấu chấm.
        </p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="sku-rule-token" className="mb-1 block text-sm font-semibold text-slate-700">
              Token thứ 2
            </label>
            <input
              id="sku-rule-token"
              autoFocus
              value={form.token}
              onChange={(event) => setForm((current) => ({ ...current, token: event.target.value }))}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm lowercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="main"
              maxLength={64}
            />
            <p className="mt-1 text-xs text-slate-500">
              Không dùng dấu chấm hoặc khoảng trắng. Token được lưu bằng chữ thường.
            </p>
          </div>

          <div>
            <label htmlFor="sku-rule-category" className="mb-1 block text-sm font-semibold text-slate-700">
              Danh mục gợi ý
            </label>
            <select
              id="sku-rule-category"
              value={form.category_id}
              onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              disabled={categoriesLoading}
            >
              <option value="">{categoriesLoading ? "Đang tải danh mục..." : "Chọn danh mục"}</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>{category.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || categoriesLoading}
              className="min-h-10 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
            >
              {saving ? "Đang lưu..." : "Lưu quy ước"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryRulesModal({
  group,
  categories,
  onClose,
  onRulesChanged,
  onMessage
}) {
  const addInputRef = useRef(null);
  const [newToken, setNewToken] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editingToken, setEditingToken] = useState("");
  const [repairCategoryId, setRepairCategoryId] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const busy = adding || savingEdit || deletingId !== null;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  function beginEdit(rule) {
    setEditingRuleId(rule.id);
    setEditingToken(rule.token);
    setRepairCategoryId("");
    setEditError("");
  }

  function cancelEdit() {
    setEditingRuleId(null);
    setEditingToken("");
    setRepairCategoryId("");
    setEditError("");
  }

  async function handleAdd(event) {
    event.preventDefault();
    const validation = validateTokenInput(newToken);
    if (validation.error) {
      setAddError(validation.error);
      return;
    }
    if (!group.categoryId) {
      setAddError("Quy ước này cần được liên kết lại với một danh mục trước.");
      return;
    }

    setAdding(true);
    setAddError("");
    try {
      await createSkuCategoryRule({
        token: validation.token,
        category_id: group.categoryId
      });
      await onRulesChanged();
      setNewToken("");
      onMessage(`Đã thêm token "${validation.token}" vào ${group.categoryName}.`);
      window.requestAnimationFrame(() => addInputRef.current?.focus({ preventScroll: true }));
    } catch (error) {
      setAddError(error?.message || "Không thể thêm token.");
    } finally {
      setAdding(false);
    }
  }

  async function handleEdit(event, rule) {
    event.preventDefault();
    const validation = validateTokenInput(editingToken);
    if (validation.error) {
      setEditError(validation.error);
      return;
    }
    const categoryId = group.categoryId || Number(repairCategoryId);
    if (!categoryId) {
      setEditError("Vui lòng chọn danh mục để sửa liên kết không khả dụng.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    try {
      await updateSkuCategoryRule(rule.id, {
        token: validation.token,
        category_id: categoryId
      });
      await onRulesChanged();
      cancelEdit();
      onMessage(`Đã cập nhật token "${validation.token}".`);
    } catch (error) {
      setEditError(error?.message || "Không thể cập nhật token.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(rule) {
    const confirmed = window.confirm(
      `Xóa token "${rule.token}" khỏi "${group.categoryName}"?\n\n` +
      "Sản phẩm đã lưu sẽ không thay đổi. Chỉ gợi ý trong tương lai cho token này sẽ dừng."
    );
    if (!confirmed) return;

    setDeletingId(rule.id);
    setEditError("");
    try {
      await deleteSkuCategoryRule(rule.id);
      await onRulesChanged();
      onMessage(`Đã xóa token "${rule.token}".`);
    } catch (error) {
      setEditError(error?.message || "Không thể xóa token.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-category-tokens-title"
      >
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="manage-category-tokens-title" className="break-words text-lg font-bold text-slate-900">
              Quản lý token cho {group.categoryName}
            </h2>
            {!group.categoryAvailable && (
              <p className="mt-1 text-xs font-semibold text-amber-700">Danh mục không khả dụng</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-xl text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            aria-label="Đóng cửa sổ quản lý token"
          >
            ×
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            {group.rules.map((rule) => (
              <div key={rule.id} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                {editingRuleId === rule.id ? (
                  <form className="space-y-2" onSubmit={(event) => handleEdit(event, rule)}>
                    <input
                      autoFocus
                      value={editingToken}
                      onChange={(event) => setEditingToken(event.target.value)}
                      className="h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm lowercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      maxLength={64}
                      aria-label={`Sửa token ${rule.token}`}
                    />
                    {!group.categoryId && (
                      <select
                        value={repairCategoryId}
                        onChange={(event) => setRepairCategoryId(event.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        aria-label="Chọn danh mục để sửa liên kết"
                      >
                        <option value="">Chọn danh mục để sửa liên kết</option>
                        {categories.map((category) => (
                          <option key={category.id} value={String(category.id)}>{category.name}</option>
                        ))}
                      </select>
                    )}
                    {editError && <p className="text-xs font-medium text-red-600" role="alert">{editError}</p>}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                        className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="min-h-9 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
                      >
                        {savingEdit ? "Đang lưu..." : "Lưu"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-md bg-brand-50 px-2 py-1.5 text-xs font-bold text-brand-700">
                      {rule.token}
                    </code>
                    <button
                      type="button"
                      onClick={() => beginEdit(rule)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label={`Sửa token ${rule.token}`}
                    >
                      <ActionIcon name="edit" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule)}
                      disabled={deletingId === rule.id}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                      aria-label={`Xóa token ${rule.token}`}
                    >
                      <ActionIcon name="delete" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {group.categoryId ? (
            <form className="rounded-lg border border-slate-200 p-3" onSubmit={handleAdd}>
              <label htmlFor="category-new-token" className="text-sm font-semibold text-slate-700">
                Thêm token
              </label>
              <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  id="category-new-token"
                  ref={addInputRef}
                  value={newToken}
                  onChange={(event) => {
                    setNewToken(event.target.value);
                    setAddError("");
                  }}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 font-mono text-sm lowercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="Nhập token mới"
                  maxLength={64}
                />
                <button
                  type="submit"
                  disabled={adding}
                  className="min-h-10 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
                >
                  {adding ? "Đang thêm..." : "Thêm"}
                </button>
              </div>
              {addError && <p className="mt-2 text-xs font-medium text-red-600" role="alert">{addError}</p>}
            </form>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Hãy sửa token hiện tại và chọn một danh mục để khôi phục liên kết trước khi thêm token khác.
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkuCategoryRulesPage() {
  const createButtonRef = useRef(null);
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [testerSku, setTesterSku] = useState("");
  const [testerResult, setTesterResult] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [openGroupKey, setOpenGroupKey] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => groupSkuCategoryRules(rules), [rules]);
  const filteredGroups = useMemo(
    () => filterSkuCategoryRuleGroups(groups, search),
    [groups, search]
  );
  const activeGroup = useMemo(
    () => groups.find((group) => group.key === openGroupKey) || null,
    [groups, openGroupKey]
  );
  const visibleRuleCount = filteredGroups.reduce((sum, group) => sum + group.rules.length, 0);
  const isSearching = Boolean(search.trim());
  const validCategories = useMemo(
    () => categories.filter(isValidCategory),
    [categories]
  );
  const categoryActionDisabled = (
    categoriesLoading ||
    !categoriesLoaded ||
    Boolean(categoriesError) ||
    validCategories.length === 0
  );

  useEffect(() => {
    if (openGroupKey && !activeGroup) setOpenGroupKey("");
  }, [activeGroup, openGroupKey]);

  async function reloadRules() {
    const items = await listSkuCategoryRules();
    setRules(items);
    setTesterResult(null);
    return items;
  }

  async function reloadCategories() {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const items = await listActiveCategories();
      setCategories(items);
      setCategoriesLoaded(true);
      return items;
    } catch (loadError) {
      setCategoriesError(loadError?.message || "Không thể tải danh mục.");
      throw loadError;
    } finally {
      setCategoriesLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setCategoriesLoading(true);
    setCategoriesError("");

    listSkuCategoryRules()
      .then((ruleItems) => {
        if (active) setRules(ruleItems);
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message || "Không thể tải quy ước SKU.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    listActiveCategories()
      .then((categoryItems) => {
        if (!active) return;
        setCategories(categoryItems);
        setCategoriesLoaded(true);
      })
      .catch((loadError) => {
        if (active) setCategoriesError(loadError?.message || "Không thể tải danh mục.");
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function openCreateModal() {
    if (categoryActionDisabled) return;
    setForm(EMPTY_FORM);
    setFormError("");
    try {
      const latestCategories = await reloadCategories();
      const hasValidCategory = latestCategories.some(isValidCategory);
      if (hasValidCategory) setCreateModalOpen(true);
    } catch {
      // The category error and retry action are rendered beside the button.
    }
  }

  async function openManageModal(groupKey) {
    setOpenGroupKey(groupKey);
    try {
      await reloadCategories();
    } catch (loadError) {
      setError(loadError?.message || "Không thể tải danh mục.");
    }
  }

  function closeCreateModal() {
    if (saving) return;
    setCreateModalOpen(false);
    setForm(EMPTY_FORM);
    setFormError("");
    window.requestAnimationFrame(() => createButtonRef.current?.focus({ preventScroll: true }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    const validation = validateTokenInput(form.token);
    if (validation.error) {
      setFormError(validation.error);
      return;
    }
    if (!form.category_id) {
      setFormError("Vui lòng chọn danh mục gợi ý.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await createSkuCategoryRule({
        token: validation.token,
        category_id: Number(form.category_id)
      });
      await reloadRules();
      setMessage("Đã thêm quy ước.");
      setCreateModalOpen(false);
      setForm(EMPTY_FORM);
      window.requestAnimationFrame(() => createButtonRef.current?.focus({ preventScroll: true }));
    } catch (saveError) {
      setFormError(saveError?.message || "Không thể lưu quy ước.");
    } finally {
      setSaving(false);
    }
  }

  function handleTester(event) {
    event.preventDefault();
    const token = extractSecondSkuToken(testerSku);
    if (!token) {
      setTesterResult({ type: "invalid", message: "SKU không có token thứ 2 hợp lệ." });
      return;
    }
    const rule = findSkuCategoryRule(rules, testerSku);
    if (!rule) {
      setTesterResult({ type: "missing", message: `Chưa có quy ước cho token "${token}".` });
      return;
    }
    if (!rule.category_available) {
      setTesterResult({
        type: "unavailable",
        message: `Token "${token}" đang liên kết với danh mục không khả dụng.`
      });
      return;
    }
    setTesterResult({
      type: "matched",
      message: `Token "${token}" gợi ý danh mục "${rule.category_name}".`
    });
  }

  return (
    <div className="sku-rules-page min-w-0 max-w-full space-y-5">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Quy ước gợi ý danh mục từ SKU</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Hệ thống đọc token thứ 2 của SKU được ngăn cách bằng dấu chấm.
            Ví dụ: <code className="rounded bg-slate-100 px-1 py-0.5">2nd.main.asus.b760m.a.d4</code>
            {" "}→ token thứ 2: <strong>main</strong> → gợi ý: <strong>Mainboard</strong>.
          </p>
        </div>
        <div className="flex max-w-sm shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <button
            ref={createButtonRef}
            type="button"
            onClick={openCreateModal}
            disabled={categoryActionDisabled}
            className="min-h-11 rounded-lg border border-brand-500 bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm hover:border-brand-700 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none"
          >
            {categoriesLoading ? "Đang tải danh mục..." : "+ Thêm quy ước"}
          </button>
          {categoriesError ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-red-700" role="alert">
              <span>{categoriesError}</span>
              <button
                type="button"
                onClick={() => reloadCategories().catch(() => {})}
                disabled={categoriesLoading}
                className="font-semibold underline underline-offset-2 hover:text-red-800 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                Thử lại
              </button>
            </div>
          ) : categoriesLoaded && validCategories.length === 0 ? (
            <p className="text-xs text-amber-700" role="status">
              Chưa có danh mục đang hoạt động để tạo quy ước.
            </p>
          ) : null}
        </div>
      </header>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setError("");
              setLoading(true);
              reloadRules()
                .catch((loadError) => setError(loadError?.message || "Không thể tải dữ liệu."))
                .finally(() => setLoading(false));
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Kiểm tra SKU</h2>
        <form className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row" onSubmit={handleTester}>
          <input
            value={testerSku}
            onChange={(event) => {
              setTesterSku(event.target.value);
              setTesterResult(null);
            }}
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Nhập mã SKU để thử (ví dụ: 2nd.main.asus.b760m.a.d4)"
            aria-label="SKU cần kiểm tra"
          />
          <button type="submit" className="h-11 rounded-lg border border-brand-500 px-5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            Kiểm tra
          </button>
        </form>
        {testerResult && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
              testerResult.type === "matched" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
            }`}
            role="status"
          >
            {testerResult.message}
          </p>
        )}
      </section>

      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Danh sách quy ước</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isSearching
                ? `${filteredGroups.length} danh mục phù hợp · ${visibleRuleCount} quy ước`
                : `${groups.length} danh mục · ${rules.length} quy ước`}
            </p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-64"
            placeholder="Tìm token..."
            aria-label="Tìm quy ước theo token hoặc danh mục"
          />
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Đang tải quy ước...</p>
        ) : rules.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-600">Chưa có quy ước SKU.</p>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={categoryActionDisabled}
              className="mt-2 text-sm font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
            >
              Thêm quy ước đầu tiên
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Không tìm thấy danh mục hoặc token phù hợp.</p>
        ) : (
          <div className="sku-rules-grid mt-4">
            {filteredGroups.map((group) => (
              <article key={group.key} className="min-w-0 self-start rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-bold text-slate-900">{group.categoryName}</h3>
                    {!group.categoryAvailable && (
                      <p className="mt-0.5 text-[11px] font-semibold text-amber-700">Không khả dụng</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openManageModal(group.key)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    aria-label={`Quản lý token cho ${group.categoryName}`}
                    title="Quản lý token"
                  >
                    <ActionIcon name="edit" />
                  </button>
                </div>
                <div className="mt-2.5 flex min-w-0 flex-wrap gap-1.5">
                  {group.tokens.map((token) => (
                    <code key={token} className="max-w-full break-all rounded-md bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">
                      {token}
                    </code>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {createModalOpen && (
        <CreateRuleModal
          form={form}
          setForm={setForm}
          categories={validCategories}
          categoriesLoading={categoriesLoading}
          error={formError}
          saving={saving}
          onCancel={closeCreateModal}
          onSubmit={handleCreate}
        />
      )}

      {activeGroup && (
        <CategoryRulesModal
          key={activeGroup.key}
          group={activeGroup}
          categories={validCategories}
          onClose={() => setOpenGroupKey("")}
          onRulesChanged={reloadRules}
          onMessage={setMessage}
        />
      )}
    </div>
  );
}
