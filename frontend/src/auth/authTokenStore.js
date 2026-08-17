let accessToken = "";
let authFailureHandler = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = typeof token === "string" ? token : "";
  return accessToken;
}

export function clearAccessToken() {
  accessToken = "";
}

export function setAuthFailureHandler(handler) {
  authFailureHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (authFailureHandler === handler) authFailureHandler = null;
  };
}

export function notifyAuthFailure() {
  clearAccessToken();
  authFailureHandler?.();
}

export function clearLegacyAuthStorage(storage) {
  try {
    const resolvedStorage = storage ?? window.localStorage;
    resolvedStorage.removeItem("access_token");
    resolvedStorage.removeItem("refresh_token");
    return true;
  } catch (error) {
    return false;
  }
}
