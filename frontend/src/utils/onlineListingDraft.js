import {
  formatMoneyInput,
  moneyInputToDigits as sharedMoneyInputToDigits,
  parseMoneyInput
} from "./moneyInput";

export const ONLINE_LISTING_TITLE_MAX_LENGTH = 80;
export const MAX_MONEY_AMOUNT = 999999999999999;

const MONEY_INTEGER_MESSAGE = "Giá đăng online phải là số nguyên VND không âm.";
const MONEY_MAX_MESSAGE = "Giá đăng online vượt quá giới hạn cho phép.";

function ensureSentence(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function buildLeadSentence(productName, quickSellingNote) {
  const name = String(productName || "").trim();
  const note = String(quickSellingNote || "").trim();

  if (name && note) return ensureSentence(`${name} ${note}`);
  return ensureSentence(name || note);
}

function normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();
}

function quickNoteHasWarranty(value) {
  const normalized = normalizeForMatch(value);
  return (
    /\b(bh|hbh)\b/.test(normalized) ||
    normalized.includes("bao hanh") ||
    normalized.includes("het bao hanh") ||
    normalized.includes("con bao hanh")
  );
}

function isNoWarrantyGroup(group) {
  const normalized = normalizeForMatch(getNoteGroupLabel(group)).replace(/\s+/g, "");
  return normalized === "hbh" || normalized.includes("hetbaohanh");
}

export function formatVnd(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

export function formatMoneyInputValue(value) {
  if (value === null || value === undefined || value === "") return "";
  return formatMoneyInput(value);
}

export function moneyInputToDigits(value) {
  return sharedMoneyInputToDigits(value);
}

export function digitsToMoneyInput(value) {
  return formatMoneyInput(value);
}

export function parseOnlinePriceInput(value) {
  const numericValue = parseMoneyInput(value, { emptyValue: null, max: MAX_MONEY_AMOUNT });
  if (numericValue === null && !/\d/.test(String(value ?? ""))) {
    return { value: null, error: "" };
  }
  if (numericValue === null) {
    return { value: null, error: MONEY_MAX_MESSAGE };
  }

  return { value: numericValue, error: "" };
}

export function getOnlinePriceInputFromProduct(product) {
  if (!product || product.sale_price === null || product.sale_price === undefined) {
    return "";
  }
  return formatMoneyInput(product.sale_price);
}

export function buildSuggestedOnlineListingTitle(product) {
  return String(product?.name || "").trim();
}

export function getNoteGroupLabel(group) {
  return group?.label || group?.note || "Không ghi chú";
}

export function buildOnlineListingDescription({ product, quickSellingNote = "", selectedNoteGroup = null }) {
  const parts = [];
  const productName = String(product?.name || "").trim();
  const note = String(quickSellingNote || "").trim();
  const leadSentence = buildLeadSentence(productName, note);

  if (leadSentence) {
    parts.push(leadSentence);
  }

  if (selectedNoteGroup && !quickNoteHasWarranty(note)) {
    if (isNoWarrantyGroup(selectedNoteGroup)) {
      parts.push("Hết bảo hành.");
    } else {
      parts.push(ensureSentence(getNoteGroupLabel(selectedNoteGroup)));
    }
  }

  return parts.join(" ");
}
