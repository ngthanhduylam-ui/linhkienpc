import { useEffect, useMemo, useRef, useState } from "react";
import {
  LOGICAL_PAGE_HEIGHT_PX,
  LOGICAL_PAGE_WIDTH_PX,
  getOverlappingBlockIds,
  moveBlockByRenderedDelta,
  resizeBlockByRenderedDelta,
  rollbackBuilderGesture
} from "../../../utils/printTemplateBuilderLab";
import { PrintBuilderBlock } from "./PrintBuilderBlock";

export function PrintBuilderCanvas({
  document,
  selectedBlockId,
  zoom,
  gridVisible,
  editing,
  onSelectBlock,
  onPreviewDocument,
  onCommitDocument,
  onAddAtDrop,
  onFitScale,
  onStartTextEdit,
  onEditingValueChange,
  onFinishTextEdit
}) {
  const workspaceRef = useRef(null);
  const paperRef = useRef(null);
  const documentRef = useRef(document);
  const previewRef = useRef(document);
  const gestureRef = useRef(null);
  const [guides, setGuides] = useState({ vertical: [], horizontal: [] });
  const collisionIds = useMemo(() => new Set(getOverlappingBlockIds(document, selectedBlockId)), [document, selectedBlockId]);

  useEffect(() => {
    documentRef.current = document;
    previewRef.current = document;
  }, [document]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || typeof ResizeObserver === "undefined") return undefined;
    const update = (width) => onFitScale(Math.min(1, Math.max(0.35, (width - 32) / LOGICAL_PAGE_WIDTH_PX)));
    update(workspace.clientWidth);
    const observer = new ResizeObserver((entries) => update(entries[0]?.contentRect?.width || workspace.clientWidth));
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [onFitScale]);

  useEffect(() => {
    function releaseGesturePointer(gesture) {
      const target = gesture?.captureTarget;
      if (!target) return;
      try {
        if (target.hasPointerCapture?.(gesture.pointerId)) target.releasePointerCapture(gesture.pointerId);
      } catch {
        // The browser may have already released capture during cancellation.
      }
    }

    function handlePointerMove(event) {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      if (gesture.kind === "move") {
        const result = moveBlockByRenderedDelta(
          gesture.startDocument,
          gesture.blockId,
          deltaX,
          deltaY,
          gesture.renderedWidth,
          { bypassSnap: event.altKey }
        );
        previewRef.current = result.document;
        gesture.setGuides(result.guides);
      } else {
        previewRef.current = resizeBlockByRenderedDelta(
          gesture.startDocument,
          gesture.blockId,
          gesture.handle,
          deltaX,
          deltaY,
          gesture.renderedWidth,
          { bypassSnap: event.altKey }
        );
      }
      onPreviewDocument(previewRef.current);
    }

    function finishPointer(event) {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      gestureRef.current = null;
      releaseGesturePointer(gesture);
      gesture.setGuides({ vertical: [], horizontal: [] });
      onCommitDocument(previewRef.current);
    }

    function cancelPointer(event) {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      gestureRef.current = null;
      releaseGesturePointer(gesture);
      previewRef.current = rollbackBuilderGesture(gesture.startDocument);
      gesture.setGuides({ vertical: [], horizontal: [] });
      onPreviewDocument(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", cancelPointer);
    return () => {
      releaseGesturePointer(gestureRef.current);
      gestureRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", cancelPointer);
    };
  }, [onCommitDocument, onPreviewDocument]);

  function beginGesture(event, block, kind, handle = "") {
    if (event.button !== 0 || block.locked || editing) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectBlock(block.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = {
      kind,
      handle,
      blockId: block.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      renderedWidth: paperRef.current?.getBoundingClientRect().width || LOGICAL_PAGE_WIDTH_PX * zoom,
      startDocument: documentRef.current,
      captureTarget: event.currentTarget,
      setGuides
    };
    previewRef.current = documentRef.current;
  }

  function handleDrop(event) {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/x-print-builder-block") || event.dataTransfer.getData("text/plain");
    if (!type || !paperRef.current) return;
    const rect = paperRef.current.getBoundingClientRect();
    onAddAtDrop(type, event.clientX - rect.left, event.clientY - rect.top, rect.width);
  }

  return (
    <section className="print-builder-workspace" ref={workspaceRef} aria-label="Vùng thiết kế A4">
      <div className="print-builder-workspace-note">
        <span>A4 · 210 × 297 mm</span>
        <span>Giữ Alt khi kéo để bỏ qua căn lưới</span>
      </div>
      <div className="print-builder-scroll-area">
        <div className="print-builder-page-holder" style={{ width: `${LOGICAL_PAGE_WIDTH_PX * zoom}px`, height: `${LOGICAL_PAGE_HEIGHT_PX * zoom}px` }}>
          <div
            ref={paperRef}
            className={`print-builder-paper ${gridVisible ? "show-grid" : ""}`}
            style={{ width: `${LOGICAL_PAGE_WIDTH_PX}px`, height: `${LOGICAL_PAGE_HEIGHT_PX}px`, transform: `scale(${zoom})` }}
            onClick={() => onSelectBlock(null)}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
            onDrop={handleDrop}
          >
            <div className="print-builder-guide-layer" aria-hidden="true">
              {guides.vertical.map((value) => <span key={`v-${value}`} className="print-builder-guide is-vertical" style={{ left: `${value / 210 * 100}%` }} />)}
              {guides.horizontal.map((value) => <span key={`h-${value}`} className="print-builder-guide is-horizontal" style={{ top: `${value / 297 * 100}%` }} />)}
            </div>
            {[...document.blocks].sort((a, b) => a.zIndex - b.zIndex).map((block) => (
              <PrintBuilderBlock
                key={block.id}
                block={block}
                selected={selectedBlockId === block.id}
                colliding={selectedBlockId === block.id ? collisionIds.size > 0 : collisionIds.has(block.id)}
                editingValue={editing?.blockId === block.id ? editing.value : null}
                onSelect={onSelectBlock}
                onPointerDown={(event, currentBlock) => beginGesture(event, currentBlock, "move")}
                onResizePointerDown={(event, currentBlock, handle) => beginGesture(event, currentBlock, "resize", handle)}
                onStartTextEdit={onStartTextEdit}
                onEditingValueChange={onEditingValueChange}
                onFinishTextEdit={onFinishTextEdit}
              />
            ))}
          </div>
        </div>
      </div>
      {collisionIds.size > 0 && (
        <p className="print-builder-collision-warning" role="status">Khối đang chồng lên {collisionIds.size} khối khác. Có thể dùng các lệnh lớp để điều chỉnh.</p>
      )}
    </section>
  );
}
