export const POS_ORDER_DRAFTS_STORAGE_KEY = "linhkienpc.pos.drafts.v1";
export const POS_ORDER_DRAFTS_VERSION = 1;
export const POS_ORDER_DRAFTS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_POS_ORDERS = 10;

function hasBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function removePosOrderDraftsStorage() {
  if (!hasBrowserStorage()) return;
  try {
    window.localStorage.removeItem(POS_ORDER_DRAFTS_STORAGE_KEY);
  } catch {
    // Draft persistence must never block POS usage.
  }
}

export function readPosOrderDraftsStorage(now = Date.now()) {
  if (!hasBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(POS_ORDER_DRAFTS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const updatedAt = Number(parsed?.updatedAt);
    if (
      parsed?.version !== POS_ORDER_DRAFTS_VERSION
      || !Number.isSafeInteger(updatedAt)
      || updatedAt <= 0
      || now - updatedAt > POS_ORDER_DRAFTS_MAX_AGE_MS
      || !parsed?.state
    ) {
      removePosOrderDraftsStorage();
      return null;
    }

    return parsed.state;
  } catch {
    removePosOrderDraftsStorage();
    return null;
  }
}

export function writePosOrderDraftsStorage(state, now = Date.now()) {
  if (!hasBrowserStorage()) return;

  if (!state?.orders?.length) {
    removePosOrderDraftsStorage();
    return;
  }

  try {
    window.localStorage.setItem(
      POS_ORDER_DRAFTS_STORAGE_KEY,
      JSON.stringify({
        version: POS_ORDER_DRAFTS_VERSION,
        updatedAt: now,
        state
      })
    );
  } catch {
    // Draft persistence is a convenience only; selling must remain available.
  }
}
