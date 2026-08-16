import { formatPublicSellingPrice, normalizeOptionalProductDescription } from "./publicProductPresentation.js";
import { formatWarrantyNote } from "./warrantyNote.js";

export const PUBLIC_RESULT_VIEW_STORAGE_KEY = "public_catalogue_view_mode";
export const PUBLIC_RESULT_VIEW_MODES = Object.freeze(["card", "table"]);
export const PUBLIC_SEARCH_TABLE_COLUMNS = Object.freeze([
  "Tên sản phẩm",
  "Bảo hành / ghi chú",
  "SL",
  "Giá"
]);

export function normalizePublicResultViewMode(value) {
  return value === "table" ? "table" : "card";
}

export function loadPublicResultViewMode(storage) {
  try {
    const resolvedStorage = storage ?? window.localStorage;
    return normalizePublicResultViewMode(resolvedStorage.getItem(PUBLIC_RESULT_VIEW_STORAGE_KEY));
  } catch {
    return "card";
  }
}

export function savePublicResultViewMode(value, storage) {
  const viewMode = normalizePublicResultViewMode(value);
  try {
    const resolvedStorage = storage ?? window.localStorage;
    resolvedStorage.setItem(PUBLIC_RESULT_VIEW_STORAGE_KEY, viewMode);
  } catch {
    // Public search remains usable when localStorage is unavailable.
  }
  return viewMode;
}

export function changePublicResultViewMode({ query, results, viewMode }, nextMode, storage) {
  return {
    query,
    results,
    viewMode: savePublicResultViewMode(nextMode, storage)
  };
}

export function derivePublicWarrantyLines(noteGroups) {
  return [...(Array.isArray(noteGroups) ? noteGroups : [])]
    .sort((left, right) => Number(right?.quantity || 0) - Number(left?.quantity || 0))
    .map((group) => ({
      label: formatWarrantyNote(group?.label || group?.note),
      quantity: Number(group?.quantity || 0)
    }))
    .filter((group) => group.label.toLocaleLowerCase("vi-VN") !== "không ghi chú");
}

export function derivePublicSearchTableRow(product) {
  return {
    productId: Number(product?.productId || product?.id) || null,
    name: String(product?.name || "").trim(),
    specSummary: normalizeOptionalProductDescription(product?.specSummary),
    warrantyLines: derivePublicWarrantyLines(product?.noteGroups),
    totalQuantity: Number(product?.totalQuantity || 0),
    price: formatPublicSellingPrice(product?.salePrice)
  };
}
