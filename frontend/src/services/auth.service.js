import { apiGet, apiPost, refreshAuthSession } from "../api/apiClient.js";
import {
  clearAccessToken,
  clearLegacyAuthStorage,
  setAccessToken
} from "../auth/authTokenStore.js";

export function clearLegacyTokens(storage) {
  return clearLegacyAuthStorage(storage);
}

export async function loginRequest(username, password) {
  const response = await apiPost(
    "/admin/auth/login",
    { username, password },
    { retryOn401: false }
  );
  const data = response?.data;
  if (data?.access_token) setAccessToken(data.access_token);
  return data;
}

export async function refreshRequest() {
  return refreshAuthSession();
}

export async function logoutRequest() {
  try {
    const response = await apiPost(
      "/admin/auth/logout",
      {},
      { retryOn401: false }
    );
    return response?.data;
  } finally {
    clearAccessToken();
    clearLegacyAuthStorage();
  }
}

export async function getMeRequest() {
  const response = await apiGet("/admin/auth/me", {}, { retryOn401: true });
  return response?.data;
}
