export const ONLINE_LISTING_TITLE_MAX_LENGTH = 80;
export const MAX_MONEY_AMOUNT = 999999999999999;

const MONEY_INTEGER_MESSAGE = "Giá đăng online phải là số nguyên VND không âm.";
const MONEY_MAX_MESSAGE = "Giá đăng online vượt quá giới hạn cho phép.";

export function formatVnd(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

export function formatMoneyInputValue(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString("vi-VN");
}

export function parseOnlinePriceInput(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    return { value: null, error: "" };
  }

  const hasSeparator = /[.,\s]/.test(rawValue);
  const isValidDigits = /^\d+$/.test(rawValue);
  const isValidGroupedNumber = /^\d{1,3}([.,\s]\d{3})+$/.test(rawValue);

  if (!isValidDigits && !(hasSeparator && isValidGroupedNumber)) {
    return { value: null, error: MONEY_INTEGER_MESSAGE };
  }

  const normalizedValue = rawValue.replace(/[.,\s]/g, "");
  const numericValue = Number(normalizedValue);
  if (!Number.isSafeInteger(numericValue) || numericValue < 0) {
    return { value: null, error: MONEY_INTEGER_MESSAGE };
  }
  if (numericValue > MAX_MONEY_AMOUNT) {
    return { value: null, error: MONEY_MAX_MESSAGE };
  }

  return { value: numericValue, error: "" };
}

export function getOnlinePriceInputFromProduct(product) {
  if (!product || product.sale_price === null || product.sale_price === undefined) {
    return "";
  }
  return formatMoneyInputValue(product.sale_price);
}

export function buildSuggestedOnlineListingTitle(product) {
  return String(product?.name || "").trim();
}

export function getNoteGroupLabel(group) {
  return group?.label || group?.note || "Không ghi chú";
}

export function buildOnlineListingDescription({ product, onlinePrice, selectedNoteGroup, hasImages }) {
  const lines = [];
  const productName = String(product?.name || "").trim();

  if (productName) {
    lines.push(productName);
  }

  if (onlinePrice !== null && onlinePrice !== undefined) {
    lines.push(`Giá đăng: ${formatVnd(onlinePrice)}`);
  }

  if (selectedNoteGroup) {
    lines.push(`Bảo hành/ghi chú: ${getNoteGroupLabel(selectedNoteGroup)}`);
  }

  if (hasImages) {
    lines.push("Hình ảnh sản phẩm được đính kèm trong tin.");
  }

  return lines.join("\n");
}
