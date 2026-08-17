import assert from "node:assert/strict";
import test from "node:test";
import {
  clearAccessToken,
  clearLegacyAuthStorage,
  getAccessToken,
  notifyAuthFailure,
  setAccessToken,
  setAuthFailureHandler
} from "./authTokenStore.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    values
  };
}

test("access token exists only in the module memory store", () => {
  clearAccessToken();
  assert.equal(getAccessToken(), "");
  setAccessToken("memory-access-token");
  assert.equal(getAccessToken(), "memory-access-token");
  clearAccessToken();
  assert.equal(getAccessToken(), "");
});

test("legacy access_token and refresh_token keys are removed without migration", () => {
  const storage = createStorage({
    access_token: "legacy-access",
    refresh_token: "legacy-refresh",
    unrelated: "keep"
  });
  assert.equal(clearLegacyAuthStorage(storage), true);
  assert.equal(storage.getItem("access_token"), null);
  assert.equal(storage.getItem("refresh_token"), null);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("blocked browser storage never breaks auth cleanup", () => {
  const throwingStorage = {
    removeItem() { throw new Error("blocked"); }
  };
  assert.equal(clearLegacyAuthStorage(throwingStorage), false);
});

test("auth failure clears memory and notifies the current AuthContext handler", () => {
  let calls = 0;
  const remove = setAuthFailureHandler(() => { calls += 1; });
  setAccessToken("temporary");
  notifyAuthFailure();
  assert.equal(getAccessToken(), "");
  assert.equal(calls, 1);
  remove();
});
