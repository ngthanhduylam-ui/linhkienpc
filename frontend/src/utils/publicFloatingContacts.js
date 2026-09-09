export const PUBLIC_CONTACT_SAFE_MARGIN = 12;
export const PUBLIC_CONTACT_DRAG_THRESHOLD = 6;
export const PUBLIC_CONTACT_DEFAULT_RIGHT = 20;
export const PUBLIC_CONTACT_DEFAULT_BOTTOM = 24;

function finiteOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function clampPublicContactPosition(
  position,
  viewport,
  element,
  margin = PUBLIC_CONTACT_SAFE_MARGIN
) {
  const safeMargin = Math.max(0, finiteOrZero(margin));
  const viewportWidth = Math.max(0, finiteOrZero(viewport?.width));
  const viewportHeight = Math.max(0, finiteOrZero(viewport?.height));
  const elementWidth = Math.max(0, finiteOrZero(element?.width));
  const elementHeight = Math.max(0, finiteOrZero(element?.height));
  const minX = Math.min(safeMargin, Math.max(0, viewportWidth - elementWidth));
  const minY = Math.min(safeMargin, Math.max(0, viewportHeight - elementHeight));
  const maxX = Math.max(minX, viewportWidth - elementWidth - safeMargin);
  const maxY = Math.max(minY, viewportHeight - elementHeight - safeMargin);

  return {
    x: Math.min(maxX, Math.max(minX, finiteOrZero(position?.x))),
    y: Math.min(maxY, Math.max(minY, finiteOrZero(position?.y)))
  };
}

export function getDefaultPublicContactPosition(viewport, element) {
  const viewportWidth = Math.max(0, finiteOrZero(viewport?.width));
  const viewportHeight = Math.max(0, finiteOrZero(viewport?.height));
  const elementWidth = Math.max(0, finiteOrZero(element?.width));
  const elementHeight = Math.max(0, finiteOrZero(element?.height));

  return clampPublicContactPosition({
    x: viewportWidth - elementWidth - PUBLIC_CONTACT_DEFAULT_RIGHT,
    y: viewportHeight - elementHeight - PUBLIC_CONTACT_DEFAULT_BOTTOM
  }, viewport, element);
}

export function getPublicContactExpansionDirection(position, viewport, element) {
  const widgetCenter = finiteOrZero(position?.x) + Math.max(0, finiteOrZero(element?.width)) / 2;
  const viewportCenter = Math.max(0, finiteOrZero(viewport?.width)) / 2;
  return widgetCenter > viewportCenter ? "left" : "right";
}

export function didPublicContactPointerMove(start, current, threshold = PUBLIC_CONTACT_DRAG_THRESHOLD) {
  const deltaX = finiteOrZero(current?.x) - finiteOrZero(start?.x);
  const deltaY = finiteOrZero(current?.y) - finiteOrZero(start?.y);
  return Math.hypot(deltaX, deltaY) >= Math.max(0, finiteOrZero(threshold));
}

export function canStartPublicContactDrag({ button, isPrimary, pointerType } = {}) {
  return isPrimary === true && button === 0 && ["mouse", "touch", "pen"].includes(pointerType);
}

export function consumePublicContactClickSuppression(suppressionRef) {
  if (suppressionRef?.current !== true) return false;
  suppressionRef.current = false;
  return true;
}
