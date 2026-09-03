export const PUBLIC_CATEGORY_DRAG_THRESHOLD_PX = 6;

export function canStartPublicCategoryMouseDrag(pointerType, button) {
  return pointerType === "mouse" && button === 0;
}

export function createPublicCategoryDragState(pointerId, clientX, scrollLeft) {
  return {
    pointerId,
    startX: clientX,
    startScrollLeft: scrollLeft,
    isDragging: false
  };
}

export function movePublicCategoryDrag(state, clientX) {
  if (!state) return null;

  const deltaX = clientX - state.startX;
  return {
    ...state,
    isDragging: state.isDragging || Math.abs(deltaX) > PUBLIC_CATEGORY_DRAG_THRESHOLD_PX,
    scrollLeft: state.startScrollLeft - deltaX
  };
}

export function finishPublicCategoryDrag(state) {
  return {
    nextState: null,
    suppressClick: state?.isDragging === true
  };
}
