import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SettingsSectionNav } from "../components/settings/SettingsSectionNav";
import {
  getSaleDeliveryNoteTemplateSettings,
  saveSaleDeliveryNoteCustomTemplate,
  setSaleDeliveryNoteActiveTemplate
} from "../services/printTemplateSettings.service";
import {
  canSelectCustomTemplate,
  cloneTemplateConfig,
  getTemplateMetadata,
  hasActiveTemplateSelectionChanged,
  isTemplateSelectionValid,
  validatePrintTemplateSettingsResponse
} from "../utils/printTemplateSettings";

function isAbortError(error) {
  return error?.name === "AbortError";
}

function TemplateMetadata({ metadata }) {
  return (
    <div className="mt-3 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
      <span>{metadata.size}</span>
      <span aria-hidden="true">·</span>
      <span>{metadata.orientationLabel}</span>
      <span aria-hidden="true">·</span>
      <span>Lề {metadata.marginMm} mm</span>
      <span aria-hidden="true">·</span>
      <span>Schema v{metadata.schemaVersion}</span>
    </div>
  );
}

function StatusBadge({ children, tone = "slate" }) {
  const toneClass = tone === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : tone === "brand"
      ? "border-brand-200 bg-brand-50 text-brand-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneClass}`}>
      {children}
    </span>
  );
}

export function PrintTemplateSettingsPage() {
  const mountedRef = useRef(false);
  const abortControllerRef = useRef(null);
  const loadRequestIdRef = useRef(0);
  const operationRef = useRef("");

  const [settings, setSettings] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("system");
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [customAction, setCustomAction] = useState("");
  const [selectionSaving, setSelectionSaving] = useState(false);

  const applyLatestSettings = useCallback((latest, { preserveUnsavedSelection = false } = {}) => {
    setSettings(latest);
    setSelectedTemplate((current) => (
      preserveUnsavedSelection && isTemplateSelectionValid(latest, current)
        ? current
        : latest.active_template
    ));
  }, []);

  const loadSettings = useCallback(async ({ showInitialLoading = false } = {}) => {
    const requestId = ++loadRequestIdRef.current;
    if (showInitialLoading) {
      setInitialLoading(true);
      setLoadError("");
    }

    try {
      const rawSettings = await getSaleDeliveryNoteTemplateSettings({
        signal: abortControllerRef.current?.signal
      });
      const latest = validatePrintTemplateSettingsResponse(rawSettings);
      if (!mountedRef.current || requestId !== loadRequestIdRef.current) return null;
      applyLatestSettings(latest);
      return latest;
    } catch (error) {
      if (isAbortError(error) || !mountedRef.current || requestId !== loadRequestIdRef.current) return null;
      if (showInitialLoading) {
        setSettings(null);
        setLoadError(error?.message || "Không thể tải cấu hình mẫu in.");
      }
      throw error;
    } finally {
      if (showInitialLoading && mountedRef.current && requestId === loadRequestIdRef.current) {
        setInitialLoading(false);
      }
    }
  }, [applyLatestSettings]);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    loadSettings({ showInitialLoading: true }).catch(() => {});

    return () => {
      mountedRef.current = false;
      loadRequestIdRef.current += 1;
      controller.abort();
    };
  }, [loadSettings]);

  const systemMetadata = useMemo(() => {
    if (!settings) return null;
    return getTemplateMetadata(settings.system_template.config);
  }, [settings]);

  const customMetadata = useMemo(() => {
    if (!settings?.custom_template?.exists) return null;
    return getTemplateMetadata(settings.custom_template.config);
  }, [settings]);

  const customSelectable = settings ? canSelectCustomTemplate(settings) : false;
  const selectionDirty = settings
    ? hasActiveTemplateSelectionChanged(settings.active_template, selectedTemplate)
    : false;
  const settingsValid = settings
    ? isTemplateSelectionValid(settings, selectedTemplate)
    : false;
  const operationBusy = Boolean(customAction) || selectionSaving;

  function handleSelectionChange(nextSelection) {
    if (operationRef.current || operationBusy || !isTemplateSelectionValid(settings, nextSelection)) return;
    setSelectedTemplate(nextSelection);
    setActionError("");
    setSuccessMessage("");
  }

  async function handleCreateOrResetCustom() {
    if (!settings || operationRef.current) return;
    const resetting = settings.custom_template.exists;
    const confirmed = window.confirm(
      resetting
        ? "Khởi tạo lại Mẫu tùy chỉnh từ Mẫu gốc hệ thống?\n\nCấu hình tùy chỉnh hiện tại sẽ bị ghi đè. Mẫu gốc và lựa chọn đang lưu không thay đổi."
        : "Tạo Mẫu tùy chỉnh từ Mẫu gốc hệ thống?\n\nMẫu mới là một bản sao độc lập. Lựa chọn mẫu đang lưu vẫn giữ nguyên."
    );
    if (!confirmed) return;

    const actionName = resetting ? "reset" : "create";
    operationRef.current = actionName;
    setCustomAction(actionName);
    setActionError("");
    setSuccessMessage("");
    const persistedSelectionBefore = settings.active_template;
    let saved = false;

    try {
      const configCopy = cloneTemplateConfig(settings.system_template.config);
      const putResponse = validatePrintTemplateSettingsResponse(
        await saveSaleDeliveryNoteCustomTemplate(configCopy, {
          signal: abortControllerRef.current?.signal
        })
      );
      saved = true;
      if (putResponse.active_template !== persistedSelectionBefore) {
        throw new Error("Máy chủ đã thay đổi lựa chọn mẫu ngoài yêu cầu.");
      }
      if (!putResponse.custom_template.exists) {
        throw new Error("Máy chủ chưa xác nhận Mẫu tùy chỉnh đã được lưu.");
      }

      const latestRaw = await getSaleDeliveryNoteTemplateSettings({
        signal: abortControllerRef.current?.signal
      });
      const latest = validatePrintTemplateSettingsResponse(latestRaw);
      if (!mountedRef.current || operationRef.current !== actionName) return;
      applyLatestSettings(latest, { preserveUnsavedSelection: true });
      setSuccessMessage(
        resetting
          ? "Đã khởi tạo lại Mẫu tùy chỉnh từ Mẫu gốc. Lựa chọn đang lưu không thay đổi."
          : "Đã tạo Mẫu tùy chỉnh từ Mẫu gốc. Lựa chọn đang lưu không thay đổi."
      );
    } catch (error) {
      if (!isAbortError(error) && mountedRef.current) {
        setActionError(
          saved
            ? "Đã lưu Mẫu tùy chỉnh nhưng không thể tải lại trạng thái mới. Vui lòng thử tải lại trang."
            : error?.message || (resetting
                ? "Không thể khởi tạo lại Mẫu tùy chỉnh."
                : "Không thể tạo Mẫu tùy chỉnh.")
        );
      }
    } finally {
      if (mountedRef.current && operationRef.current === actionName) {
        operationRef.current = "";
        setCustomAction("");
      }
    }
  }

  async function handleSaveSelection() {
    if (
      !settings
      || operationRef.current
      || !selectionDirty
      || !isTemplateSelectionValid(settings, selectedTemplate)
    ) return;

    operationRef.current = "selection";
    setSelectionSaving(true);
    setActionError("");
    setSuccessMessage("");

    try {
      const updated = validatePrintTemplateSettingsResponse(
        await setSaleDeliveryNoteActiveTemplate(selectedTemplate, {
          signal: abortControllerRef.current?.signal
        })
      );
      if (!mountedRef.current || operationRef.current !== "selection") return;
      if (updated.active_template !== selectedTemplate) {
        throw new Error("Máy chủ chưa xác nhận lựa chọn mẫu in mới.");
      }
      applyLatestSettings(updated);
      setSuccessMessage("Đã lưu lựa chọn mẫu in.");
    } catch (error) {
      if (!isAbortError(error) && mountedRef.current) {
        setActionError(error?.message || "Không thể lưu lựa chọn mẫu in.");
      }
    } finally {
      if (mountedRef.current && operationRef.current === "selection") {
        operationRef.current = "";
        setSelectionSaving(false);
      }
    }
  }

  return (
    <div className="print-template-settings-page min-w-0 max-w-full space-y-5">
      <SettingsSectionNav />

      <header className="min-w-0">
        <h1 className="break-words text-2xl font-bold text-slate-900">Mẫu in Phiếu bán &amp; giao hàng</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          Chọn mẫu được sử dụng cho Phiếu bán &amp; giao hàng và quản lý một mẫu tùy chỉnh duy nhất.
        </p>
      </header>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800" role="note">
        Lựa chọn mẫu được lưu trong hệ thống. Phiếu in hiện tại vẫn sử dụng Mẫu gốc cho đến khi phần tích hợp in được hoàn tất.
      </div>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Trình thiết kế thử nghiệm">
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-900">Thử nghiệm bố cục tự do trên A4</p>
          <p className="mt-1 text-xs leading-5 text-violet-700">Bản thử chỉ lưu trong trình duyệt, không thay đổi mẫu in đang dùng.</p>
        </div>
        <Link
          to="/admin/settings/print-template/builder-lab"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-800 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          Thử trình thiết kế kéo thả
        </Link>
      </section>

      {initialLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm" role="status">
          Đang tải cấu hình mẫu in...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => loadSettings({ showInitialLoading: true }).catch(() => {})}
            className="mt-3 min-h-10 rounded-lg border border-red-300 bg-white px-4 font-semibold hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Thử lại
          </button>
        </div>
      ) : settings && systemMetadata ? (
        <>
          {successMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" role="status">
              {successMessage}
            </div>
          )}
          {actionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {actionError}
            </div>
          )}

          <section className="print-template-card-grid min-w-0" aria-label="Chọn mẫu in">
            <label className={`min-w-0 rounded-xl border bg-white p-5 shadow-sm transition-colors ${
              selectedTemplate === "system" ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200"
            }`}>
              <div className="flex min-w-0 items-start gap-3">
                <input
                  type="radio"
                  name="print-template"
                  value="system"
                  checked={selectedTemplate === "system"}
                  onChange={() => handleSelectionChange("system")}
                  disabled={operationBusy}
                  className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <h2 className="break-words text-base font-bold text-slate-900">Mẫu gốc hệ thống</h2>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge tone="brand">Mẫu hệ thống</StatusBadge>
                      {settings.active_template === "system" && <StatusBadge tone="active">Đang áp dụng</StatusBadge>}
                    </div>
                  </div>
                  <TemplateMetadata metadata={systemMetadata} />
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Mẫu in hoàn chỉnh hiện tại, luôn khả dụng, không thể chỉnh sửa hoặc xóa.
                  </p>
                </div>
              </div>
            </label>

            <article className={`min-w-0 rounded-xl border bg-white p-5 shadow-sm transition-colors ${
              selectedTemplate === "custom" ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200"
            }`}>
              <label className="flex min-w-0 items-start gap-3">
                <input
                  type="radio"
                  name="print-template"
                  value="custom"
                  checked={selectedTemplate === "custom"}
                  onChange={() => handleSelectionChange("custom")}
                  disabled={!customSelectable || operationBusy}
                  className="mt-1 h-4 w-4 shrink-0 accent-blue-600 disabled:cursor-not-allowed"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <h2 className="break-words text-base font-bold text-slate-900">Mẫu tùy chỉnh</h2>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge>{settings.custom_template.exists ? "Đã tạo" : "Chưa tạo"}</StatusBadge>
                      {settings.active_template === "custom" && <StatusBadge tone="active">Đang áp dụng</StatusBadge>}
                    </div>
                  </div>
                  {customMetadata && <TemplateMetadata metadata={customMetadata} />}
                </div>
              </label>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {settings.custom_template.exists
                  ? "Một cấu hình tùy chỉnh duy nhất đã được lưu và sẵn sàng để chỉnh sửa nội dung."
                  : "Tạo một bản sao từ Mẫu gốc hệ thống để chỉnh sửa ở bước tiếp theo."}
              </p>
              {!customSelectable && (
                <p className="mt-2 text-xs font-semibold text-amber-700">Cần tạo Mẫu tùy chỉnh trước khi có thể chọn.</p>
              )}
              <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                {settings.custom_template.exists && (
                  <Link
                    to="/admin/settings/print-template/edit"
                    aria-disabled={operationBusy}
                    onClick={(event) => {
                      if (operationBusy) event.preventDefault();
                    }}
                    className={`inline-flex min-h-10 max-w-full items-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                      operationBusy
                        ? "pointer-events-none bg-slate-200 text-slate-500"
                        : "bg-brand-500 text-white hover:bg-brand-700"
                    }`}
                  >
                    Chỉnh sửa mẫu tùy chỉnh
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleCreateOrResetCustom}
                  disabled={operationBusy}
                  className="min-h-10 max-w-full rounded-lg border border-brand-300 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {customAction
                    ? (customAction === "reset" ? "Đang khởi tạo lại..." : "Đang tạo...")
                    : (settings.custom_template.exists
                        ? "Khởi tạo lại từ Mẫu gốc"
                        : "Tạo mẫu tùy chỉnh")}
                </button>
              </div>
            </article>
          </section>

          <section className="print-template-action-bar min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                {selectionDirty ? "Lựa chọn chưa được lưu" : "Lựa chọn đã được lưu"}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                Việc lưu lựa chọn chưa làm thay đổi phiếu in hiện tại trong giai đoạn này.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveSelection}
              disabled={!selectionDirty || !settingsValid || operationBusy}
              className="min-h-11 shrink-0 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
            >
              {selectionSaving ? "Đang lưu..." : "Lưu lựa chọn"}
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
