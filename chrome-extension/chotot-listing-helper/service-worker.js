importScripts("shared/constants.js");

const C = globalThis.PHUOC_TAI_CHO_TOT;
let pendingDraft = null;
const CHOTOT_MINIMUM_PRICE = 1000;

function log(...args) {
  console.log(C.LOG_PREFIX, ...args);
}

function isChoTotPostingUrl(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("chotot.com") && /dang|post|listing|sell/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

async function getRecentRequestIds() {
  const data = await chrome.storage.session.get({ recentRequestIds: [] });
  return Array.isArray(data.recentRequestIds) ? data.recentRequestIds : [];
}

async function rememberRequestId(requestId) {
  const recent = await getRecentRequestIds();
  const next = [requestId, ...recent.filter((item) => item !== requestId)].slice(0, C.RECENT_REQUEST_LIMIT);
  await chrome.storage.session.set({ recentRequestIds: next });
}

function validateDraft(draft) {
  if (!draft || typeof draft !== "object") return "INVALID_PAYLOAD";
  if (draft.version !== 1 || draft.source !== C.SOURCE) return "INVALID_SOURCE";
  if (!draft.requestId || typeof draft.requestId !== "string") return "INVALID_REQUEST_ID";
  if (!draft.title || typeof draft.title !== "string") return "TITLE_REQUIRED";
  if (!Number.isSafeInteger(draft.price) || draft.price <= 0) return "PRICE_REQUIRED";
  if (draft.price < CHOTOT_MINIMUM_PRICE) return "PRICE_BELOW_CHOTOT_MINIMUM";
  if (!draft.description || typeof draft.description !== "string") return "DESCRIPTION_REQUIRED";
  if (draft.description.length > C.MAX_DESCRIPTION_LENGTH) return "DESCRIPTION_TOO_LONG";
  if (!draft.condition || typeof draft.condition !== "string") return "CONDITION_REQUIRED";
  if (!draft.deviceType || draft.deviceType === "unknown") return "DEVICE_REQUIRED";
  if (!Array.isArray(draft.images) || draft.images.length < 1) return "IMAGE_REQUIRED";
  return "";
}

async function openOrFocusChoTot() {
  const tabs = await chrome.tabs.query({ url: ["https://www.chotot.com/*", "https://*.chotot.com/*"] });
  const postingTab = tabs.find((tab) => isChoTotPostingUrl(tab.url));
  if (postingTab?.id) {
    await chrome.tabs.update(postingTab.id, { active: true });
    if (postingTab.windowId) await chrome.windows.update(postingTab.windowId, { focused: true });
    return postingTab;
  }
  return chrome.tabs.create({ url: C.POSTING_URL, active: true });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === C.RUNTIME_TRANSFER_DRAFT) {
      const draft = message.payload;
      const validationError = validateDraft(draft);
      if (validationError) {
        sendResponse({ ok: false, error: validationError, requestId: draft?.requestId });
        return;
      }

      const recent = await getRecentRequestIds();
      if (recent.includes(draft.requestId)) {
        sendResponse({ ok: false, error: "DUPLICATE_REQUEST", requestId: draft.requestId });
        return;
      }

      pendingDraft = { ...draft, receivedAt: Date.now(), posTabId: sender.tab?.id || null };
      await rememberRequestId(draft.requestId);
      const tab = await openOrFocusChoTot();
      log("Stored draft and opened/focused Cho Tot tab", { requestId: draft.requestId, tabId: tab.id });
      sendResponse({
        ok: true,
        requestId: draft.requestId,
        code: "OPENING_CHOTOT",
        message: "Đã nhận draft. Đang mở hoặc focus trang đăng tin Chợ Tốt."
      });
      return;
    }

    if (message?.type === C.RUNTIME_GET_PENDING_DRAFT) {
      if (!pendingDraft) {
        sendResponse({ ok: false, error: "NO_PENDING_DRAFT" });
        return;
      }
      sendResponse({ ok: true, draft: pendingDraft });
      return;
    }

    if (message?.type === C.RUNTIME_FILL_RESULT) {
      const result = message.result || {};
      if (pendingDraft?.requestId && result.requestId !== pendingDraft.requestId) {
        log("Ignored stale fill result", { expected: pendingDraft.requestId, received: result.requestId });
        sendResponse({ ok: true, ignored: true });
        return;
      }
      const posTabId = pendingDraft?.posTabId;
      if (posTabId) {
        chrome.tabs.sendMessage(posTabId, {
          type: C.RUNTIME_FILL_RESULT,
          result
        }).catch(() => {});
      }
      if (result.ok) pendingDraft = null;
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === C.RUNTIME_FILL_PROGRESS) {
      const progress = message.progress || {};
      if (pendingDraft?.requestId && progress.requestId !== pendingDraft.requestId) {
        log("Ignored stale fill progress", { expected: pendingDraft.requestId, received: progress.requestId, code: progress.code });
        sendResponse({ ok: true, ignored: true });
        return;
      }
      const posTabId = pendingDraft?.posTabId;
      if (posTabId) {
        chrome.tabs.sendMessage(posTabId, {
          type: C.RUNTIME_FILL_PROGRESS,
          progress
        }).catch(() => {});
      }
      sendResponse({ ok: true });
    }
  })().catch((error) => {
    console.error(C.LOG_PREFIX, error);
    sendResponse({ ok: false, error: error?.message || "UNEXPECTED_ERROR" });
  });
  return true;
});
