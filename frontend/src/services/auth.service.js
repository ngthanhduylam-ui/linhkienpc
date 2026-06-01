import { apiGet, apiPost } from "../api/apiClient";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY) || "",
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) || ""
  };
}

export function saveTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function loginRequest(username, password) {
  const response = await apiPost(
    "/admin/auth/login",
    { username, password },
    { retryOn401: false }
  );
  return response?.data;
}

export async function refreshRequest(refreshToken) {
  if (!refreshToken) {
    return null;
  }

  const response = await apiPost(
    "/admin/auth/refresh",
    { refresh_token: refreshToken },
    { retryOn401: false }
  );
  return response?.data;
}

export async function logoutRequest(refreshToken) {
  if (!refreshToken) {
    return { logged_out: true, revoked: false };
  }

  const response = await apiPost(
    "/admin/auth/logout",
    { refresh_token: refreshToken },
    { retryOn401: false }
  );
  return response?.data;
}

export async function getMeRequest() {
  const response = await apiGet("/admin/auth/me", {}, { retryOn401: true });
  return response?.data;
}
