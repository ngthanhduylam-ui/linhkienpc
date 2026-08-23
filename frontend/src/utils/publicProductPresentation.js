export function normalizeOptionalProductDescription(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function formatPublicSellingPrice() {
  return "Liên hệ";
}
