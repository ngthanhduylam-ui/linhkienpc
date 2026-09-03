import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUBLIC_CATEGORY_DRAG_THRESHOLD_PX,
  canStartPublicCategoryMouseDrag,
  createPublicCategoryDragState,
  finishPublicCategoryDrag,
  movePublicCategoryDrag
} from "./publicCategoryDrag.js";

test("normal click and movement up to the threshold remain clicks", () => {
  const initial = createPublicCategoryDragState(1, 100, 40);
  const stationary = movePublicCategoryDrag(initial, 100);
  const belowThreshold = movePublicCategoryDrag(initial, 100 + PUBLIC_CATEGORY_DRAG_THRESHOLD_PX);

  assert.equal(stationary.isDragging, false);
  assert.equal(belowThreshold.isDragging, false);
  assert.equal(finishPublicCategoryDrag(belowThreshold).suppressClick, false);
});

test("movement beyond the threshold becomes a drag and updates horizontal scroll", () => {
  const initial = createPublicCategoryDragState(2, 100, 80);
  const draggedRight = movePublicCategoryDrag(initial, 120);
  const draggedLeft = movePublicCategoryDrag(initial, 70);

  assert.equal(draggedRight.isDragging, true);
  assert.equal(draggedRight.scrollLeft, 60);
  assert.equal(draggedLeft.isDragging, true);
  assert.equal(draggedLeft.scrollLeft, 110);
});

test("finishing a drag suppresses one category click and resets drag state", () => {
  const dragged = movePublicCategoryDrag(createPublicCategoryDragState(3, 100, 0), 107);
  const finished = finishPublicCategoryDrag(dragged);

  assert.equal(finished.suppressClick, true);
  assert.equal(finished.nextState, null);
});

test("custom dragging accepts only the primary mouse pointer", () => {
  assert.equal(canStartPublicCategoryMouseDrag("mouse", 0), true);
  assert.equal(canStartPublicCategoryMouseDrag("mouse", 1), false);
  assert.equal(canStartPublicCategoryMouseDrag("touch", 0), false);
  assert.equal(canStartPublicCategoryMouseDrag("pen", 0), false);
});

test("category strip wires mouse drag, click suppression, and pointer cleanup", async () => {
  const source = await readFile(new URL("../components/public/PublicCategoryNav.jsx", import.meta.url), "utf8");
  const pointerDownSource = source.match(/function handlePointerDown\(event\) \{.*?\n  \}/s)?.[0] || "";

  assert.match(source, /scrollLeft = nextDragState\.scrollLeft/);
  assert.match(source, /setPointerCapture\?\.\(event\.pointerId\)/);
  assert.match(source, /onClickCapture=\{handleClickCapture\}/);
  assert.match(source, /onPointerCancel=\{finishMouseDrag\}/);
  assert.match(source, /onLostPointerCapture=\{finishMouseDrag\}/);
  assert.doesNotMatch(source, /touch-action|touchAction/);
  assert.doesNotMatch(pointerDownSource, /preventDefault\(/);
});
