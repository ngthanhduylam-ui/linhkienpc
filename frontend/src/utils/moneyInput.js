export const MAX_MONEY_AMOUNT = 999999999999999;

export function moneyInputToDigits(value) {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits;
}

export function formatMoneyInput(value) {
  const digits = moneyInputToDigits(value);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseMoneyInput(value, { emptyValue = 0, max = MAX_MONEY_AMOUNT } = {}) {
  const digits = moneyInputToDigits(value);
  if (!digits) return emptyValue;
  if (BigInt(digits) > BigInt(max)) return null;
  const numberValue = Number(digits);
  return Number.isSafeInteger(numberValue) ? numberValue : null;
}

function countDigitsBeforeCaret(value, caretPosition) {
  return String(value ?? "").slice(0, caretPosition ?? 0).replace(/\D/g, "").length;
}

function caretPositionForDigitCount(value, digitCount) {
  if (digitCount <= 0) return 0;

  let seenDigits = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      seenDigits += 1;
      if (seenDigits === digitCount) {
        return index + 1;
      }
    }
  }
  return value.length;
}

export function handleMoneyInputChange(event, setValue) {
  const input = event.target;
  const digitCount = countDigitsBeforeCaret(input.value, input.selectionStart);
  const formattedValue = formatMoneyInput(input.value);
  const nextCaret = caretPositionForDigitCount(formattedValue, digitCount);

  setValue(formattedValue);

  window.requestAnimationFrame(() => {
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // Some mobile keyboards/input modes do not expose selection ranges.
    }
  });

  return formattedValue;
}
