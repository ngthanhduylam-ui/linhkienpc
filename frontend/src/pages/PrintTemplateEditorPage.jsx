import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "react-router-dom";
import { PrintTemplateInspector } from "../components/settings/PrintTemplateInspector";
import { SaleDeliveryNoteTemplatePreview } from "../components/settings/SaleDeliveryNoteTemplatePreview";
import { SettingsSectionNav } from "../components/settings/SettingsSectionNav";
import {
  getSaleDeliveryNoteTemplateSettings,
  saveSaleDeliveryNoteCustomTemplate
} from "../services/printTemplateSettings.service";
import {
  PRINT_TEMPLATE_LIMITS,
  cloneEditableTemplateConfig,
  compareTemplateConfigs,
  createNoticeEditorItems,
  equalizeVisibleProductTableColumns,
  getSectionForFieldPath,
  moveNoticeItem,
  normalizeEditableTemplateConfig,
  resetProductTableColumnWidthsFromSystem,
  resetSectionLayoutFromSystem,
  resizeAdjacentProductTableColumns,
  selectEditorSection,
  updateDraftSectionField,
  updateProductTableColumnWeight,
  updateSectionVisibility,
  validateTemplateEditorDraft
} from "../utils/printTemplateEditor";
import { validatePrintTemplateSettingsResponse } from "../utils/printTemplateSettings";

const UNSAVED_MESSAGE = "Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?";

function isAbortError(error) {
  return error?.name === "AbortError";
}

function normalizeErrorField(field) {
  return String(field || "config")
    .replace(/^body\.custom_template_config\.?/, "")
    .replace(/^custom_template_config\.?/, "");
}

function fieldErrorMap(errors) {
  return errors.reduce((result, error) => {
    const field = normalizeErrorField(error?.field);
    if (!result[field]) result[field] = error?.message || error?.issue || "Giá trị không hợp lệ.";
    return result;
  }, {});
}

function editorErrorMessage(error) {
  const details = error?.payload?.error?.details;
  if (Array.isArray(details) && details.length) {
    return "Một số nội dung chưa hợp lệ. Vui lòng kiểm tra phần được đánh dấu trong bảng chỉnh sửa.";
  }
  return error?.message || "Không thể lưu Mẫu tùy chỉnh.";
}

export function PrintTemplateEditorPage() {
  const navigate = useNavigate();
  const mountedRef = useRef(false);
  const loadControllerRef = useRef(null);
  const saveControllerRef = useRef(null);
  const loadRequestIdRef = useRef(0);
  const savingRef = useRef(false);
  const noticeKeyRef = useRef(0);

  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [originalConfig, setOriginalConfig] = useState(null);
  const [selectedSection, setSelectedSection] = useState("documentTitle");
  const [forcedDirty, setForcedDirty] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  const createNoticeKey = useCallback(() => {
    noticeKeyRef.current += 1;
    return `editor-notice-${noticeKeyRef.current}`;
  }, []);

  const buildDraft = useCallback((config) => cloneEditableTemplateConfig(config, createNoticeKey), [createNoticeKey]);

  const applySettings = useCallback((latest) => {
    setSettings(latest);
    if (!latest.custom_template.exists) {
      setDraft(null);
      setOriginalConfig(null);
      setForcedDirty(false);
      return;
    }
    const normalized = normalizeEditableTemplateConfig(buildDraft(latest.custom_template.config));
    setOriginalConfig(normalized);
    setDraft(buildDraft(normalized));
    setForcedDirty(false);
  }, [buildDraft]);

  const loadSettings = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    setInitialLoading(true);
    setLoadError("");
    setSaveError("");

    try {
      const latest = validatePrintTemplateSettingsResponse(
        await getSaleDeliveryNoteTemplateSettings({ signal: controller.signal })
      );
      if (!mountedRef.current || requestId !== loadRequestIdRef.current) return;
      applySettings(latest);
    } catch (error) {
      if (!isAbortError(error) && mountedRef.current && requestId === loadRequestIdRef.current) {
        setSettings(null);
        setDraft(null);
        setOriginalConfig(null);
        setLoadError(error?.message || "Không thể tải Mẫu tùy chỉnh.");
      }
    } finally {
      if (mountedRef.current && requestId === loadRequestIdRef.current) setInitialLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    mountedRef.current = true;
    loadSettings();
    return () => {
      mountedRef.current = false;
      loadRequestIdRef.current += 1;
      loadControllerRef.current?.abort();
      saveControllerRef.current?.abort();
    };
  }, [loadSettings]);

  const dirty = useMemo(() => {
    if (!draft || !originalConfig) return false;
    return forcedDirty || compareTemplateConfigs(draft, originalConfig);
  }, [draft, forcedDirty, originalConfig]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm(UNSAVED_MESSAGE)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  function selectSection(sectionId) {
    setSelectedSection((current) => selectEditorSection(current, sectionId));
  }

  function clearFeedback() {
    setSuccessMessage("");
    setSaveError("");
    setFieldErrors({});
  }

  function applyValidationErrors(errors) {
    setFieldErrors(fieldErrorMap(errors));
    const affectedSection = errors
      .map((error) => getSectionForFieldPath(error?.field))
      .find(Boolean);
    if (affectedSection) selectSection(affectedSection);
  }

  function updatePaper(field, value) {
    clearFeedback();
    setForcedDirty(false);
    setDraft((current) => ({ ...current, paper: { ...current.paper, [field]: value } }));
  }

  function updateSectionField(sectionName, field, value) {
    clearFeedback();
    setForcedDirty(false);
    setDraft((current) => updateDraftSectionField(current, sectionName, field, value));
  }

  function updateVisibility(sectionName, visible) {
    clearFeedback();
    setForcedDirty(false);
    setDraft((current) => updateSectionVisibility(current, sectionName, visible));
  }

  function updateProductColumnWeight(columnId, value) {
    clearFeedback();
    setForcedDirty(false);
    const normalizedValue = value === "" ? "" : Number(value);
    setDraft((current) => updateProductTableColumnWeight(current, columnId, normalizedValue));
  }

  function equalizeProductColumns() {
    clearFeedback();
    setDraft((current) => equalizeVisibleProductTableColumns(current));
    setForcedDirty(true);
  }

  function resetProductColumnWidths() {
    if (!settings || savingRef.current) return;
    clearFeedback();
    setDraft((current) => resetProductTableColumnWidthsFromSystem(current, settings.system_template.config));
    setForcedDirty(true);
  }

  function resizeProductColumns(leftId, rightId, deltaWeight) {
    clearFeedback();
    setDraft((current) => resizeAdjacentProductTableColumns(current, leftId, rightId, deltaWeight));
    setForcedDirty(true);
  }

  function updateNotice(key, value) {
    clearFeedback();
    setForcedDirty(false);
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        notes: {
          ...current.sections.notes,
          items: current.sections.notes.items.map((item) => item.key === key ? { ...item, value } : item)
        }
      }
    }));
  }

  function addNotice() {
    if (draft.sections.notes.items.length >= PRINT_TEMPLATE_LIMITS.noticeCount) return;
    clearFeedback();
    setForcedDirty(false);
    const [item] = createNoticeEditorItems([""], createNoticeKey);
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        notes: { ...current.sections.notes, items: [...current.sections.notes.items, item] }
      }
    }));
  }

  function removeNotice(key) {
    if (draft.sections.notes.items.length <= 1) return;
    clearFeedback();
    setForcedDirty(false);
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        notes: {
          ...current.sections.notes,
          items: current.sections.notes.items.filter((item) => item.key !== key)
        }
      }
    }));
  }

  function reorderNotice(index, direction) {
    clearFeedback();
    setForcedDirty(false);
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        notes: { ...current.sections.notes, items: moveNoticeItem(current.sections.notes.items, index, direction) }
      }
    }));
  }

  function resetDraftFromSystem() {
    if (!settings || savingRef.current) return;
    const confirmed = window.confirm(
      "Bản nháp sẽ trở về nội dung của Mẫu gốc. Mẫu tùy chỉnh trên hệ thống chỉ thay đổi sau khi bạn bấm Lưu thay đổi."
    );
    if (!confirmed) return;
    clearFeedback();
    setDraft(buildDraft(settings.system_template.config));
    setForcedDirty(true);
  }

  function resetSelectedSectionLayout(sectionName) {
    if (!settings || savingRef.current) return;
    clearFeedback();
    setDraft((current) => resetSectionLayoutFromSystem(current, settings.system_template.config, sectionName));
    setForcedDirty(true);
  }

  function cancelDraftChanges() {
    if (!dirty || !originalConfig || savingRef.current) return;
    if (!window.confirm("Hoàn tác toàn bộ thay đổi chưa lưu và trở về Mẫu tùy chỉnh đã lưu gần nhất?")) return;
    setDraft(buildDraft(originalConfig));
    setForcedDirty(false);
    clearFeedback();
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (!draft || !dirty || savingRef.current) return;

    const validation = validateTemplateEditorDraft(draft);
    if (!validation.valid) {
      applyValidationErrors(validation.errors);
      setSaveError("Một số nội dung chưa hợp lệ. Vui lòng kiểm tra phần được đánh dấu trong bảng chỉnh sửa.");
      setSuccessMessage("");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    setSuccessMessage("");
    setFieldErrors({});
    saveControllerRef.current?.abort();
    const controller = new AbortController();
    saveControllerRef.current = controller;
    const activeTemplateBefore = settings.active_template;

    try {
      const updated = validatePrintTemplateSettingsResponse(
        await saveSaleDeliveryNoteCustomTemplate(validation.config, { signal: controller.signal })
      );
      if (!mountedRef.current) return;
      if (!updated.custom_template.exists) {
        throw new Error("Máy chủ chưa xác nhận Mẫu tùy chỉnh đã được lưu.");
      }
      if (updated.active_template !== activeTemplateBefore) {
        throw new Error("Máy chủ đã thay đổi lựa chọn mẫu ngoài yêu cầu.");
      }
      applySettings(updated);
      setSuccessMessage("Đã lưu thay đổi cho Mẫu tùy chỉnh. Phiếu in hiện tại vẫn chưa bị thay đổi trong Phase này.");
    } catch (error) {
      if (!isAbortError(error) && mountedRef.current) {
        const details = Array.isArray(error?.payload?.error?.details) ? error.payload.error.details : [];
        applyValidationErrors(details);
        setSaveError(editorErrorMessage(error));
      }
    } finally {
      if (mountedRef.current) setSaving(false);
      savingRef.current = false;
    }
  }

  return (
    <div className="print-template-editor-page min-w-0 max-w-full space-y-5">
      <SettingsSectionNav />

      <button
        type="button"
        onClick={() => navigate("/admin/settings/print-template")}
        className="inline-flex min-h-10 max-w-full items-center rounded-lg px-1 text-sm font-semibold text-brand-700 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        ← Quay lại Mẫu in
      </button>

      <header className="min-w-0">
        <h1 className="break-words text-2xl font-bold text-slate-900">Chỉnh sửa Mẫu tùy chỉnh</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          Chọn trực tiếp một phần trên phiếu để thay đổi nội dung hoặc trạng thái hiển thị.
        </p>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800" role="note">
        Các thay đổi chỉ được lưu vào Mẫu tùy chỉnh và chưa ảnh hưởng đến phiếu in hiện tại cho đến Phase tích hợp in.
      </div>

      {initialLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm" role="status">
          Đang tải Mẫu tùy chỉnh...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={loadSettings} className="mt-3 min-h-10 rounded-lg border border-red-300 bg-white px-4 font-semibold hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
            Thử lại
          </button>
        </div>
      ) : settings && !settings.custom_template.exists ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="status">
          <p className="font-semibold">Chưa có Mẫu tùy chỉnh để chỉnh sửa.</p>
          <Link to="/admin/settings/print-template" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-amber-300 bg-white px-4 font-semibold hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
            Quay lại Mẫu in
          </Link>
        </div>
      ) : draft ? (
        <form onSubmit={saveDraft} className="min-w-0 space-y-4" noValidate>
          {successMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" role="status">{successMessage}</div>}
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <p className="font-semibold">{saveError}</p>
              {Object.entries(fieldErrors).length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {Object.entries(fieldErrors).map(([field, message]) => <li key={field}>{message}</li>)}
                </ul>
              )}
            </div>
          )}

          <section className="print-template-editor-actions min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Thao tác chỉnh sửa">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${dirty ? "text-amber-700" : "text-emerald-700"}`}>{dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">Mẫu đang áp dụng: {settings.active_template === "custom" ? "Mẫu tùy chỉnh" : "Mẫu gốc hệ thống"}</p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <button type="submit" disabled={!dirty || saving} className="min-h-11 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600">
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              <button type="button" onClick={resetDraftFromSystem} disabled={saving} className="min-h-11 rounded-lg border border-brand-300 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
                Đặt lại bản nháp từ Mẫu gốc
              </button>
              <button type="button" onClick={cancelDraftChanges} disabled={!dirty || saving} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
                Hoàn tác thay đổi chưa lưu
              </button>
            </div>
          </section>

          <div className="print-template-visual-editor min-w-0">
            <main className="min-w-0" aria-label="Bản xem trước Mẫu tùy chỉnh">
              <SaleDeliveryNoteTemplatePreview
                config={draft}
                selectedSection={selectedSection}
                onSelectSection={selectSection}
                onResizeProductColumns={resizeProductColumns}
              />
            </main>
            <PrintTemplateInspector
              draft={draft}
              selectedSection={selectedSection}
              onSelectSection={selectSection}
              fieldErrors={fieldErrors}
              onPaperChange={updatePaper}
              onVisibilityChange={updateVisibility}
              onSectionFieldChange={updateSectionField}
              onNoticeChange={updateNotice}
              onNoticeAdd={addNotice}
              onNoticeRemove={removeNotice}
              onNoticeMove={reorderNotice}
              onResetSectionLayout={resetSelectedSectionLayout}
              onProductColumnWeightChange={updateProductColumnWeight}
              onEqualizeProductColumns={equalizeProductColumns}
              onResetProductColumnWidths={resetProductColumnWidths}
            />
          </div>
        </form>
      ) : null}
    </div>
  );
}
