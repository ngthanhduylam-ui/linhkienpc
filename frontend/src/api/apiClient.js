const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

let refreshPromise = null;

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(path, query = {}) {
  const normalizedBase = String(API_BASE_URL).replace(/\/+$/, "");
  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return `${normalizedBase}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
}

export function resolveApiAssetUrl(path) {
  const value = String(path || "");
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedBase = String(API_BASE_URL).replace(/\/+$/, "");
  if (/^https?:\/\//i.test(normalizedBase)) {
    return new URL(value.startsWith("/") ? value : `/${value}`, new URL(normalizedBase).origin).toString();
  }
  return value.startsWith("/") ? value : `/${value}`;
}

function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

function saveTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function redirectToAdminLogin() {
  if (window.location.pathname !== "/admin/login") {
    window.location.href = "/admin/login";
  }
}

async function parsePayload(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearTokens();
    redirectToAdminLogin();
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(buildUrl("/admin/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      const payload = await parsePayload(response);
      if (!response.ok) {
        clearTokens();
        redirectToAdminLogin();
        return false;
      }

      const tokenData = payload?.data;
      if (!tokenData?.access_token || !tokenData?.refresh_token) {
        clearTokens();
        redirectToAdminLogin();
        return false;
      }

      saveTokens(tokenData.access_token, tokenData.refresh_token);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function request(path, options = {}) {
  const {
    method = "GET",
    query = {},
    body,
    headers = {},
    retryOn401 = true,
    responseType = "json",
    signal,
    timeoutMs
  } = options;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const requestHeaders = { ...headers };
  if (body !== undefined && !isFormData && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const accessToken = getStoredAccessToken();
  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  let timeoutId = null;
  let abortController = null;
  let fetchSignal = signal;

  if (signal || timeoutMs) {
    abortController = new AbortController();
    fetchSignal = abortController.signal;

    if (signal) {
      if (signal.aborted) {
        abortController.abort();
      } else {
        signal.addEventListener("abort", () => abortController.abort(), { once: true });
      }
    }

    if (timeoutMs) {
      timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);
    }
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
    signal: fetchSignal
  }).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });

  const canTryRefresh =
    response.status === 401 &&
    retryOn401 &&
    path !== "/admin/auth/login" &&
    path !== "/admin/auth/refresh";

  if (canTryRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request(path, { ...options, retryOn401: false });
    }
  }

  const payload = responseType === "blob" && response.ok
    ? await response.blob()
    : await parsePayload(response);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export function apiGet(path, query = {}, options = {}) {
  return request(path, { ...options, method: "GET", query });
}

export function apiPost(path, body = {}, options = {}) {
  return request(path, { ...options, method: "POST", body });
}

export function apiPatch(path, body = {}, options = {}) {
  return request(path, { ...options, method: "PATCH", body });
}

export function apiDelete(path, options = {}) {
  return request(path, { ...options, method: "DELETE" });
}

export function apiGetBlob(path, query = {}, options = {}) {
  return request(path, { ...options, method: "GET", query, responseType: "blob" });
}
