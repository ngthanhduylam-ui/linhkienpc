import assert from "node:assert/strict";
import test from "node:test";
import { REFRESH_LOCK_NAME, runWithRefreshLock } from "./authRefreshCoordinator.js";

test("refresh uses one named exclusive Web Lock when available", async () => {
  const calls = [];
  const locks = {
    request: async (name, options, operation) => {
      calls.push({ name, options });
      return operation();
    }
  };
  const result = await runWithRefreshLock(async () => "refreshed", locks);
  assert.equal(result, "refreshed");
  assert.deepEqual(calls, [{ name: REFRESH_LOCK_NAME, options: { mode: "exclusive" } }]);
});

test("refresh safely falls back when Web Locks is unavailable", async () => {
  let calls = 0;
  const result = await runWithRefreshLock(async () => {
    calls += 1;
    return "fallback";
  }, {});
  assert.equal(result, "fallback");
  assert.equal(calls, 1);
});

test("the shared lock contract serializes simultaneous tab operations", async () => {
  let tail = Promise.resolve();
  let active = 0;
  let maximumActive = 0;
  const locks = {
    request(name, options, operation) {
      const run = tail.then(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        try {
          return await operation();
        } finally {
          active -= 1;
        }
      });
      tail = run.catch(() => {});
      return run;
    }
  };
  const results = await Promise.all([
    runWithRefreshLock(() => "tab-a", locks),
    runWithRefreshLock(() => "tab-b", locks)
  ]);
  assert.deepEqual(results, ["tab-a", "tab-b"]);
  assert.equal(maximumActive, 1);
});
