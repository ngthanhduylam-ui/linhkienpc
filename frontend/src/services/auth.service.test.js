import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  setAuthFailureHandler
} from "../auth/authTokenStore.js";
import { apiGet, refreshAuthSession } from "../api/apiClient.js";
import { loginRequest, logoutRequest, refreshRequest } from "./auth.service.js";

const originalFetch = globalThis.fetch;

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});

test("login keeps access token in memory and sends credentials without persistent refresh JSON", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({
      success: true,
      data: {
        access_token: "login-memory-token",
        token_type: "Bearer",
        admin: { id: 7, username: "admin" }
      }
    });
  };
  const data = await loginRequest("admin", "correct-password");
  assert.equal(data.admin.username, "admin");
  assert.equal(getAccessToken(), "login-memory-token");
  assert.equal(request.options.credentials, "include");
  assert.deepEqual(JSON.parse(request.options.body), {
    username: "admin",
    password: "correct-password"
  });
});

test("cookie refresh returns only an access token and updates memory", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({
      success: true,
      data: {
        access_token: "refreshed-memory-token",
        token_type: "Bearer",
        admin: { id: 7, username: "admin" }
      }
    });
  };
  const data = await refreshRequest();
  assert.equal(data.access_token, "refreshed-memory-token");
  assert.equal(getAccessToken(), "refreshed-memory-token");
  assert.equal(request.options.credentials, "include");
  assert.deepEqual(JSON.parse(request.options.body), {});
  assert.equal(request.options.body.includes("refresh_token"), false);
});

test("concurrent same-tab refresh requests share one network refresh", async () => {
  let fetchCalls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = async () => {
    fetchCalls += 1;
    await gate;
    return jsonResponse({ success: true, data: { access_token: "shared-token" } });
  };
  const first = refreshAuthSession();
  const second = refreshAuthSession();
  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(fetchCalls, 1);
  assert.equal(firstResult.access_token, "shared-token");
  assert.equal(secondResult.access_token, "shared-token");
});

test("eligible 401 refreshes once and retries the business request once", async () => {
  setAccessToken("old-access");
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, authorization: options.headers.Authorization });
    if (url.endsWith("/admin/auth/refresh")) {
      return jsonResponse({ success: true, data: { access_token: "new-access" } });
    }
    if (calls.filter((item) => item.url.endsWith("/admin/products")).length === 1) {
      return jsonResponse({ success: false, error: { code: "AUTH_TOKEN_INVALID" } }, 401);
    }
    return jsonResponse({ success: true, data: [{ id: 1 }] });
  };
  const result = await apiGet("/admin/products");
  assert.deepEqual(result.data, [{ id: 1 }]);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].authorization, "Bearer old-access");
  assert.equal(calls[2].authorization, "Bearer new-access");
});

test("failed refresh clears memory, notifies auth state, and never loops", async () => {
  setAccessToken("expired-access");
  let failureCalls = 0;
  const remove = setAuthFailureHandler(() => { failureCalls += 1; });
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return jsonResponse({ success: false, error: { code: "AUTH_TOKEN_INVALID" } }, 401);
  };
  await assert.rejects(apiGet("/admin/products"));
  assert.equal(fetchCalls, 2);
  assert.equal(getAccessToken(), "");
  assert.equal(failureCalls, 1);
  remove();
});

test("logout uses cookie flow and clears memory even when no token is persisted", async () => {
  setAccessToken("current-access");
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({ success: true, data: { logged_out: true, revoked: true } });
  };
  await logoutRequest();
  assert.equal(getAccessToken(), "");
  assert.equal(request.options.credentials, "include");
  assert.deepEqual(JSON.parse(request.options.body), {});
});

test("AuthContext startup is one cookie refresh flow and source has no token persistence", async () => {
  const [contextSource, serviceSource, clientSource] = await Promise.all([
    readFile(new URL("../contexts/AuthContext.jsx", import.meta.url), "utf8"),
    readFile(new URL("./auth.service.js", import.meta.url), "utf8"),
    readFile(new URL("../api/apiClient.js", import.meta.url), "utf8")
  ]);
  assert.match(contextSource, /const restored = await refreshRequest\(\)/);
  assert.doesNotMatch(contextSource, /getStoredTokens|saveTokens/);
  assert.doesNotMatch(serviceSource, /localStorage\.setItem/);
  assert.doesNotMatch(clientSource, /localStorage\.(?:getItem|setItem)/);
  assert.doesNotMatch(clientSource, /refresh_token\s*:/);
});
