export function normalizeOptionalProductDescription(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function formatPublicSellingPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Liên hệ";
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}
