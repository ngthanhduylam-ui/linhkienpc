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
  nudgeBuilderBlock,
  readBuilderDocumentFromStorage,
  redoBuilderHistory,
  removeBuilderDocumentFromStorage,
  saveBuilderDocumentToStorage,
  serializeBuilderDocument,
  undoBuilderHistory,
  updateBuilderBlock
} from "../utils/printTemplateBuilderLab";
import "../components/settings/builder/PrintBuilderCanvas.css";

const UNSAVED_MESSAGE = "Bản thử nghiệm có thay đổi chưa lưu trên trình duyệt. Rời trang và bỏ các thay đổi này?";

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
  const initialSavedRef = useRef(undefined);
  if (initialSavedRef.current === undefined) initialSavedRef.current = readBuilderDocumentFromStorage();
  const [history, setHistory] = useState(() => createBuilderHistory(defaultDocumentRef.current));
  const [previewDocument, setPreviewDocument] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [baseline, setBaseline] = useState(() => JSON.stringify(serializeBuilderDocument(defaultDocumentRef.current)));
  const [savedChoiceVisible, setSavedChoiceVisible] = useState(Boolean(initialSavedRef.current));
  const [gridVisible, setGridVisible] = useState(true);
  const [zoom, setZoom] = useState(null);
  const [fitScale, setFitScale] = useState(0.72);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeDocument = previewDocument || history.present;
  const displayZoom = zoom ?? fitScale;
  const selectedBlock = activeDocument.blocks.find((block) => block.id === selectedBlockId) || null;
  const dirty = JSON.stringify(serializeBuilderDocument(history.present)) !== baseline;

  const commitDocument = useCallback((nextDocument) => {
    setPreviewDocument(null);
    setHistory((current) => commitBuilderHistory(current, nextDocument));
    setMessage("");
    setError("");
  }, []);

  const handleFitScale = useCallback((scale) => setFitScale(scale), []);

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
    setBaseline(JSON.stringify(serializeBuilderDocument(history.present)));
    setMessage("Đã lưu bản thử trên trình duyệt này.");
    setError("");
    setSavedChoiceVisible(false);
    initialSavedRef.current = serializeBuilderDocument(history.present);
  }

  function openSavedPrototype() {
    if (!initialSavedRef.current) return;
    const saved = initialSavedRef.current;
    setHistory(createBuilderHistory(saved));
    setPreviewDocument(null);
    setBaseline(JSON.stringify(serializeBuilderDocument(saved)));
    setSelectedBlockId(null);
    setSavedChoiceVisible(false);
    setMessage("Đã mở bản thử lưu trên trình duyệt.");
  }

  function startFromDefault() {
    const fresh = createDefaultBuilderDocument();
    setHistory(createBuilderHistory(fresh));
    setPreviewDocument(null);
    setBaseline(JSON.stringify(serializeBuilderDocument(fresh)));
    setSelectedBlockId(null);
    setSavedChoiceVisible(false);
  }

  function resetPrototype() {
    if (!window.confirm("Đặt lại tài liệu về mẫu thử mặc định? Bản lưu trên trình duyệt chưa bị xóa.")) return;
    commitDocument(createDefaultBuilderDocument());
    setSelectedBlockId(null);
    setEditing(null);
  }

  function deleteSavedPrototype() {
    if (!window.confirm("Xóa bản thử đã lưu trên trình duyệt này?")) return;
    if (removeBuilderDocumentFromStorage()) {
      initialSavedRef.current = null;
      setSavedChoiceVisible(false);
      setMessage("Đã xóa bản thử lưu trên trình duyệt.");
      setError("");
    } else setError("Không thể xóa bản thử trên trình duyệt này.");
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
        <strong>Đây là bản thử nghiệm lưu trên trình duyệt.</strong> Mọi thay đổi chưa ảnh hưởng đến mẫu in và phiếu in thực tế.
      </div>

      {savedChoiceVisible && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Chọn bản thử khởi đầu">
          <p className="text-sm font-semibold text-blue-900">Trình duyệt này có một bản thử đã lưu.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={openSavedPrototype} className="min-h-10 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white">Mở bản thử đã lưu</button>
            <button type="button" onClick={startFromDefault} className="min-h-10 rounded-lg border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-800">Bắt đầu từ mẫu mặc định</button>
            <button type="button" onClick={deleteSavedPrototype} className="min-h-10 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700">Xóa bản thử đã lưu</button>
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
        onSave={saveLocalPrototype}
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
        <span>{dirty ? "Có thay đổi chưa lưu trên trình duyệt" : "Bản thử khớp với mốc lưu hiện tại"}</span>
        <button type="button" onClick={deleteSavedPrototype} className="min-h-9 rounded-lg border border-red-200 px-3 font-semibold text-red-700 hover:bg-red-50">Xóa bản thử đã lưu</button>
      </div>
    </div>
  );
}
