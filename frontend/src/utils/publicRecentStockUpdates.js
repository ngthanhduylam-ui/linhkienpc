export const PUBLIC_RECENT_STOCK_LIMIT = 10;

export function sanitizePublicRecentStockUpdates(products) {
  const usedIds = new Set();
  return (Array.isArray(products) ? products : []).filter((product) => {
    const productId = Number(product?.productId || product?.id);
    if (!Number.isSafeInteger(productId) || productId < 1 || usedIds.has(productId)) return false;
    if (Number(product?.totalQuantity || 0) <= 0) return false;
    usedIds.add(productId);
    return true;
  }).slice(0, PUBLIC_RECENT_STOCK_LIMIT);
}

function parseStockUpdateTime(value) {
  if (value instanceof Date) return value.getTime();
  const normalized = typeof value === "string" ? value.trim().replace(" ", "T") : value;
  return new Date(normalized).getTime();
}

function isSameLocalDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function formatPublicStockUpdatedAt(value, now = Date.now()) {
  const timestamp = parseStockUpdateTime(value);
  const nowTimestamp = Number(now);
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowTimestamp)) return "";

  const elapsedMs = Math.max(0, nowTimestamp - timestamp);
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 1) return "Vừa cập nhật";
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút trước`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 12) return `${elapsedHours} giờ trước`;

  const currentDate = new Date(nowTimestamp);
  const updatedDate = new Date(timestamp);
  if (isSameLocalDay(updatedDate, currentDate)) return "Hôm nay";

  const yesterday = new Date(currentDate);
  yesterday.setDate(currentDate.getDate() - 1);
  if (isSameLocalDay(updatedDate, yesterday)) return "Hôm qua";

  return `${Math.max(2, Math.floor(elapsedHours / 24))} ngày trước`;
}

export function formatPublicStockUpdateCardText(value, now = Date.now()) {
  const relativeText = formatPublicStockUpdatedAt(value, now);
  if (!relativeText || relativeText === "Vừa cập nhật") return relativeText;
  return `Cập nhật ${relativeText.toLocaleLowerCase("vi-VN")}`;
}
