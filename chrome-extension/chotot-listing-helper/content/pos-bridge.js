(function initPosBridge() {
  const C = window.PHUOC_TAI_CHO_TOT;
  let bridgeDisabled = false;

  function postResult(result) {
    window.postMessage({
      type: C.POS_RESULT_TYPE,
      requestId: result.requestId,
      ok: Boolean(result.ok),
      code: result.code || "",
      message: result.message || "",
      error: result.error || ""
    }, window.location.origin);
  }

  function contextInvalidatedResult(requestId) {
    return {
      ok: false,
      requestId,
      code: "EXTENSION_CONTEXT_INVALIDATED",
      error: "EXTENSION_CONTEXT_INVALIDATED",
      message: "Tiện ích vừa được tải lại. Vui lòng tải lại trang POS và thử lại."
    };
  }

  function disableBridge(reason) {
    bridgeDisabled = true;
    window.removeEventListener("message", handleWindowMessage);
    try {
      chrome?.runtime?.onMessage?.removeListener?.(handleRuntimeMessage);
    } catch {
      // The old extension context may already be gone.
    }
    console.warn(C.LOG_PREFIX, "POS bridge disabled", { reason });
  }

  function isRuntimeAvailable() {
    try {
      return Boolean(chrome?.runtime?.id && chrome.runtime.sendMessage);
    } catch {
      return false;
    }
  }

  function safeSendRuntimeMessage(message, callback) {
    if (!isRuntimeAvailable()) {
      callback?.(contextInvalidatedResult(message?.payload?.requestId));
      return false;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        let lastError = null;
        try {
          lastError = chrome.runtime.lastError;
        } catch {
          lastError = { message: "Extension context invalidated." };
        }

        if (lastError) {
          const requestId = message?.payload?.requestId;
          const invalidated = /context invalidated|extension context/i.test(lastError.message || "");
          const result = invalidated
            ? contextInvalidatedResult(requestId)
            : {
                ok: false,
                requestId,
                error: "EXTENSION_COMMUNICATION_FAILED",
                message: lastError.message || "Không kết nối được với tiện ích Chrome."
              };
          if (invalidated) disableBridge(lastError.message);
          callback?.(result);
          return;
        }

        if (!response) {
          callback?.({
            ok: false,
            requestId: message?.payload?.requestId,
            error: "EXTENSION_COMMUNICATION_FAILED",
            message: "Tiện ích Chrome không phản hồi. Vui lòng tải lại trang POS và thử lại."
          });
          return;
        }

        callback?.(response);
      });
      return true;
    } catch (error) {
      const result = contextInvalidatedResult(message?.payload?.requestId);
      disableBridge(error?.message || "sendMessage threw");
      callback?.(result);
      return false;
    }
  }

  function validateWindowMessage(event) {
    if (event.source !== window || event.origin !== window.location.origin) return null;
    const message = event.data || {};
    if (message.type !== C.POS_TRANSFER_TYPE) return null;
    const draft = message.payload;
    if (!draft || draft.source !== C.SOURCE || draft.version !== 1) {
      return { error: "INVALID_PAYLOAD", requestId: draft?.requestId };
    }
    return { draft };
  }

  function handleWindowMessage(event) {
    if (bridgeDisabled) return;
    const parsed = validateWindowMessage(event);
    if (!parsed) return;
    if (parsed.error) {
      postResult({ ok: false, error: parsed.error, requestId: parsed.requestId });
      return;
    }

    safeSendRuntimeMessage({
      type: C.RUNTIME_TRANSFER_DRAFT,
      payload: parsed.draft
    }, (response) => {
      if (!response?.ok) {
        postResult({
          ok: false,
          requestId: parsed.draft.requestId,
          code: response?.code || "",
          message: response?.message || "",
          error: response?.error || "EXTENSION_COMMUNICATION_FAILED"
        });
        return;
      }
      postResult({
        ok: true,
        requestId: parsed.draft.requestId,
        code: response.code || "",
        message: response.message || "",
        error: ""
      });
    });
  }

  function handleRuntimeMessage(message) {
    if (bridgeDisabled) return;
    if (message?.type === C.RUNTIME_FILL_RESULT) {
      postResult(message.result || {});
      return;
    }
    if (message?.type === C.RUNTIME_FILL_PROGRESS) {
      const progress = message.progress || {};
      postResult({
        ok: true,
        requestId: progress.requestId,
        code: progress.code || "",
        message: progress.message || progress.code || ""
      });
    }
  }

  window.addEventListener("message", handleWindowMessage);
  try {
    if (isRuntimeAvailable()) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    } else {
      disableBridge("runtime unavailable at init");
    }
  } catch (error) {
    disableBridge(error?.message || "onMessage listener failed");
  }

  console.log(C.LOG_PREFIX, "POS bridge ready");
})();
