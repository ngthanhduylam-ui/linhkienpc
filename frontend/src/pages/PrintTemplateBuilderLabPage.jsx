import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useBlocker } from "react-router-dom";
import { PrintBuilderCanvas } from "../components/settings/builder/PrintBuilderCanvas";
import { PrintBuilderInspector } from "../components/settings/builder/PrintBuilderInspector";
import { PrintBuilderPalette } from "../components/settings/builder/PrintBuilderPalette";
import { PrintBuilderToolbar } from "../components/settings/builder/PrintBuilderToolbar";
import { SettingsSectionNav } from "../components/settings/SettingsSectionNav";
import {
  addBlockAtDropPosition,
  addBlockFromPaletteClick,
  changeBlockZOrder,
  commitBuilderHistory,
  createBuilderHistory,
  createDefaultBuilderDocument,
  deleteBuilderBlock,
  duplicateBuilderBlock,
  inspectBuilderDocumentStorage,
  nudgeBuilderBlock,
  normalizeBuilderLabDocumentToCanonical,
  redoBuilderHistory,
  removeBuilderDocumentFromStorage,
  saveBuilderDocumentToStorage,
  serializeBuilderDocument,
  undoBuilderHistory,
  updateBuilderBlock
} from "../utils/printTemplateBuilderLab";
import {
  deleteBuilderDraft,
  getBuilderDraft,
  saveBuilderDraft
} from "../services/printTemplateBuilderDraft.service";
import {
  applyBuilderDraftSaveResponse,
  builderDraftFingerprint,
  isBuilderDraftConflictError,
  isBuilderDraftDirty,
  resolveInitialBuilderSources
} from "../utils/printTemplateBuilderDraftState";
import "../components/settings/builder/PrintBuilderCanvas.css";

const UNSAVED_MESSAGE = "Bản thử nghiệm có thay đổi chưa lưu vào bản nháp hệ thống. Rời trang và bỏ các thay đổi này?";

function isTypingTarget(target) {
  return target instanceof HTMLElement && (
    target.matches("input, textarea, select, [contenteditable='true']")
    || Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

export function PrintTemplateBuilderLabPage() {
  const defaultDocumentRef = useRef(null);
  if (!defaultDocumentRef.current) defaultDocumentRef.current = createDefaultBuilderDocument();
  const addOffsetRef = useRef(0);
  const localInspectionRef = useRef(null);
  if (!localInspectionRef.current) localInspectionRef.current = inspectBuilderDocumentStorage();
  const [history, setHistory] = useState(() => createBuilderHistory(defaultDocumentRef.current));
  const [previewDocument, setPreviewDocument] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [serverBaseline, setServerBaseline] = useState(() => JSON.stringify(serializeBuilderDocument(defaultDocumentRef.current)));
  const [serverRevision, setServerRevision] = useState(0);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(null);
  const [serverDraftExists, setServerDraftExists] = useState(false);
  const [sourceChoice, setSourceChoice] = useState(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [savingServer, setSavingServer] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [zoom, setZoom] = useState(null);
  const [fitScale, setFitScale] = useState(0.72);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeDocument = previewDocument || history.present;
  const displayZoom = zoom ?? fitScale;
  const selectedBlock = activeDocument.blocks.find((block) => block.id === selectedBlockId) || null;
  const dirty = isBuilderDraftDirty(history.present, serverBaseline);

  const commitDocument = useCallback((nextDocument) => {
    setPreviewDocument(null);
    setHistory((current) => commitBuilderHistory(current, nextDocument));
    setMessage("");
    setError("");
  }, []);

  const handleFitScale = useCallback((scale) => setFitScale(scale), []);

  const replaceWorkingDocument = useCallback((document) => {
    setHistory(createBuilderHistory(document));
    setPreviewDocument(null);
    setSelectedBlockId(null);
    setEditing(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await getBuilderDraft();
        if (!mounted) return;
        const source = resolveInitialBuilderSources(response, localInspectionRef.current);
        replaceWorkingDocument(source.document);
        setServerBaseline(source.serverBaseline);
        setServerRevision(source.serverRevision);
        setServerUpdatedAt(source.serverUpdatedAt);
        setServerDraftExists(source.serverDraftExists);
        setSourceChoice(source.sourceChoice);
        if (source.localInvalid) setError("Bản thử lưu trên trình duyệt không hợp lệ và chưa được mở.");
      } catch (loadError) {
        if (mounted) setError(loadError.message || "Không thể tải bản nháp hệ thống.");
      } finally {
        if (mounted) setServerLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [replaceWorkingDocument]);

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

  useEffect(() => {
    function handleKeyDown(event) {
      if (isTypingTarget(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setPreviewDocument(null);
        setHistory((current) => event.shiftKey ? redoBuilderHistory(current) : undoBuilderHistory(current));
        return;
      }
      if ((modifier && event.key.toLowerCase() === "y")) {
        event.preventDefault();
        setPreviewDocument(null);
        setHistory((current) => redoBuilderHistory(current));
        return;
      }
      if (event.key === "Escape") {
        setEditing(null);
        setSelectedBlockId(null);
        return;
      }
      if (!selectedBlockId) return;
      if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const result = duplicateBuilderBlock(history.present, selectedBlockId);
        if (result.block) { commitDocument(result.document); setSelectedBlockId(result.block.id); }
        return;
      }
      if (["Delete", "Backspace"].includes(event.key)) {
        event.preventDefault();
        const next = deleteBuilderBlock(history.present, selectedBlockId);
        if (next !== history.present) { commitDocument(next); setSelectedBlockId(null); }
        return;
      }
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (directions[event.key]) {
        event.preventDefault();
        const step = event.shiftKey ? 5 : 1;
        const [dx, dy] = directions[event.key];
        commitDocument(nudgeBuilderBlock(history.present, selectedBlockId, dx * step, dy * step));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commitDocument, history.present, selectedBlockId]);

  function addFromPalette(type) {
    const result = addBlockFromPaletteClick(history.present, type, addOffsetRef.current++);
    commitDocument(result.document);
    setSelectedBlockId(result.block.id);
  }

  function addAtDrop(type, xPx, yPx, renderedWidth) {
    try {
      const result = addBlockAtDropPosition(history.present, type, xPx, yPx, renderedWidth);
      commitDocument(result.document);
      setSelectedBlockId(result.block.id);
    } catch (dropError) {
      setError(dropError.message || "Không thể thêm khối này.");
    }
  }

  function updateSelected(patch) {
    if (!selectedBlock) return;
    commitDocument(updateBuilderBlock(history.present, selectedBlock.id, patch));
  }

  function duplicateSelected() {
    if (!selectedBlock) return;
    const result = duplicateBuilderBlock(history.present, selectedBlock.id);
    if (result.block) { commitDocument(result.document); setSelectedBlockId(result.block.id); }
  }

  function deleteSelected() {
    if (!selectedBlock || selectedBlock.locked) return;
    commitDocument(deleteBuilderBlock(history.present, selectedBlock.id));
    setSelectedBlockId(null);
  }

  function startTextEdit(block) {
    setSelectedBlockId(block.id);
    setEditing({ blockId: block.id, original: block.props.text, value: block.props.text });
  }

  function finishTextEdit(commit) {
    if (!editing) return;
    if (commit && editing.value !== editing.original) {
      const next = updateBuilderBlock(history.present, editing.blockId, (block) => ({ ...block, props: { ...block.props, text: editing.value } }));
      commitDocument(next);
    }
    setEditing(null);
  }

  function saveLocalPrototype() {
    const result = saveBuilderDocumentToStorage(history.present);
    if (!result.ok) { setError(result.errors.join(" ")); setMessage(""); return; }
    setMessage("Đã lưu trên trình duyệt.");
    setError("");
    setSourceChoice(null);
    localInspectionRef.current = { status: "valid", document: serializeBuilderDocument(history.present), errors: [] };
  }

  function openSavedPrototype() {
    if (localInspectionRef.current.status !== "valid") return;
    replaceWorkingDocument(localInspectionRef.current.document);
    setSourceChoice(null);
    setMessage("Đã mở bản lưu trên trình duyệt. Bản nháp hệ thống chưa bị thay đổi.");
    setConflict(false);
  }

  function startFromDefault() {
    const fresh = createDefaultBuilderDocument();
    replaceWorkingDocument(fresh);
    if (!serverDraftExists) setServerBaseline(builderDraftFingerprint(fresh));
    setSourceChoice(null);
  }

  async function saveServerDraft() {
    setSavingServer(true);
    setError("");
    try {
      const response = await saveBuilderDraft(history.present, serverRevision);
      const saved = applyBuilderDraftSaveResponse(response);
      setServerRevision(saved.serverRevision);
      setServerUpdatedAt(saved.serverUpdatedAt);
      setServerDraftExists(saved.serverDraftExists);
      setServerBaseline(saved.serverBaseline);
      setConflict(false);
      setMessage("Đã lưu bản nháp.");
    } catch (saveError) {
      if (isBuilderDraftConflictError(saveError)) {
        setConflict(true);
        setError("Bản nháp hệ thống đã được thay đổi ở nơi khác.");
      } else {
        setError(saveError.message || "Không thể lưu bản nháp hệ thống.");
      }
    } finally {
      setSavingServer(false);
    }
  }

  async function loadLatestServerDraft() {
    if (dirty && !window.confirm("Tải bản mới nhất và bỏ các thay đổi chưa lưu trong vùng làm việc?")) return;
    setServerLoading(true);
    setError("");
    try {
      const response = await getBuilderDraft();
      setServerRevision(response?.revision ?? 0);
      setServerUpdatedAt(response?.updated_at ?? null);
      if (response?.draft) {
        const normalized = normalizeBuilderLabDocumentToCanonical(response.draft);
        if (!normalized.ok) throw new Error("Bản nháp hệ thống không hợp lệ.");
        replaceWorkingDocument(normalized.document);
        setServerBaseline(builderDraftFingerprint(normalized.document));
        setServerDraftExists(true);
      } else {
        const fresh = createDefaultBuilderDocument();
        replaceWorkingDocument(fresh);
        setServerBaseline(builderDraftFingerprint(fresh));
        setServerDraftExists(false);
      }
      setConflict(false);
      setMessage("Đã tải bản mới nhất từ hệ thống.");
    } catch (loadError) {
      setError(loadError.message || "Không thể tải bản nháp hệ thống.");
    } finally {
      setServerLoading(false);
    }
  }

  async function deleteServerPrototype() {
    if (!window.confirm("Xóa bản nháp hệ thống? Bản lưu trên trình duyệt sẽ được giữ nguyên.")) return;
    setSavingServer(true);
    setError("");
    try {
      const response = await deleteBuilderDraft(serverRevision);
      setServerRevision(response.revision);
      setServerUpdatedAt(null);
      setServerDraftExists(false);
      setServerBaseline(builderDraftFingerprint(createDefaultBuilderDocument()));
      setConflict(false);
      setMessage("Đã xóa bản nháp hệ thống.");
    } catch (deleteError) {
      if (isBuilderDraftConflictError(deleteError)) {
        setConflict(true);
        setError("Bản nháp hệ thống đã được thay đổi ở nơi khác.");
      } else setError(deleteError.message || "Không thể xóa bản nháp hệ thống.");
    } finally {
      setSavingServer(false);
    }
  }

  function resetPrototype() {
    if (!window.confirm("Đặt lại tài liệu về mẫu thử mặc định? Bản lưu trên trình duyệt chưa bị xóa.")) return;
    commitDocument(createDefaultBuilderDocument());
    setSelectedBlockId(null);
    setEditing(null);
  }

  function deleteSavedPrototype() {
    if (!window.confirm("Xóa bản lưu trên trình duyệt này?")) return;
    if (removeBuilderDocumentFromStorage()) {
      localInspectionRef.current = { status: "absent", document: null, errors: [] };
      setSourceChoice(null);
      setMessage("Đã xóa bản lưu trình duyệt.");
      setError("");
    } else setError("Không thể xóa bản lưu trên trình duyệt này.");
  }

  return (
    <div className="print-template-builder-lab min-w-0 max-w-full space-y-4">
      <SettingsSectionNav />
      <header className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-slate-900">Thử nghiệm trình thiết kế kéo thả</h1>
            <p className="mt-1 text-sm text-slate-600">Bản mẫu tự do một trang A4 dành cho đánh giá UX và kỹ thuật.</p>
          </div>
          <Link to="/admin/settings/print-template" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">← Quay lại Mẫu in</Link>
        </div>
      </header>

      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800" role="note">
        <strong>Đây là Builder Draft thử nghiệm.</strong> Bản nháp hệ thống và bản lưu trình duyệt không thay đổi mẫu Custom, lựa chọn mẫu đang dùng hoặc phiếu in thực tế.
      </div>

      {sourceChoice && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Chọn nguồn Builder Draft">
          <p className="text-sm font-semibold text-blue-900">
            {sourceChoice === "different"
              ? "Có một bản thử khác được lưu trên trình duyệt này."
              : "Có bản thử được lưu trên trình duyệt này."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={openSavedPrototype} className="min-h-10 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white">Mở bản trên trình duyệt</button>
            {sourceChoice === "different" ? (
              <button type="button" onClick={() => setSourceChoice(null)} className="min-h-10 rounded-lg border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-800">Giữ bản hệ thống</button>
            ) : (
              <button type="button" onClick={startFromDefault} className="min-h-10 rounded-lg border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-800">Bắt đầu từ mẫu mặc định</button>
            )}
          </div>
        </section>
      )}

      {conflict && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="Xung đột bản nháp">
          <p className="text-sm font-semibold text-amber-900">Bản nháp hệ thống đã được thay đổi ở nơi khác.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={loadLatestServerDraft} className="min-h-10 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white">Tải bản mới nhất</button>
            <button type="button" onClick={saveLocalPrototype} className="min-h-10 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900">Lưu bản hiện tại trên trình duyệt</button>
          </div>
        </section>
      )}

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" role="status">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      <PrintBuilderToolbar
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        gridVisible={gridVisible}
        zoom={displayZoom}
        onUndo={() => { setPreviewDocument(null); setHistory((current) => undoBuilderHistory(current)); }}
        onRedo={() => { setPreviewDocument(null); setHistory((current) => redoBuilderHistory(current)); }}
        onSaveServer={saveServerDraft}
        onSaveLocal={saveLocalPrototype}
        onDeleteServer={deleteServerPrototype}
        onDeleteLocal={deleteSavedPrototype}
        savingServer={savingServer || serverLoading}
        serverDraftExists={serverDraftExists}
        onReset={resetPrototype}
        onToggleGrid={() => setGridVisible((current) => !current)}
        onZoomChange={setZoom}
        onFitPage={() => setZoom(null)}
      />

      <div className="print-builder-layout">
        <PrintBuilderPalette onAddBlock={addFromPalette} />
        <PrintBuilderCanvas
          document={activeDocument}
          selectedBlockId={selectedBlockId}
          zoom={displayZoom}
          gridVisible={gridVisible}
          editing={editing}
          onSelectBlock={setSelectedBlockId}
          onPreviewDocument={setPreviewDocument}
          onCommitDocument={commitDocument}
          onAddAtDrop={addAtDrop}
          onFitScale={handleFitScale}
          onStartTextEdit={startTextEdit}
          onEditingValueChange={(value) => setEditing((current) => current ? { ...current, value } : current)}
          onFinishTextEdit={finishTextEdit}
        />
        <PrintBuilderInspector
          block={selectedBlock}
          onUpdate={updateSelected}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onChangeZOrder={(action) => selectedBlock && commitDocument(changeBlockZOrder(history.present, selectedBlock.id, action))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
        <span className="font-semibold">
          {serverLoading
            ? "Đang tải bản nháp hệ thống..."
            : conflict
              ? "Xung đột phiên bản"
              : dirty
                ? "Có thay đổi chưa lưu"
                : serverDraftExists
                  ? "Đã lưu bản nháp"
                  : "Bản nháp hệ thống chưa được tạo"}
        </span>
        <span>{serverUpdatedAt ? `Cập nhật hệ thống: ${new Date(serverUpdatedAt).toLocaleString("vi-VN")}` : "Chưa có thời gian lưu hệ thống"}</span>
      </div>
    </div>
  );
}
