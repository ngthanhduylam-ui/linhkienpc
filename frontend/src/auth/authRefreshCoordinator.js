const REFRESH_LOCK_NAME = "pt-admin-auth-refresh";

function resolveLocks(locks) {
  if (locks) return locks;
  try {
    return globalThis.navigator?.locks || null;
  } catch (error) {
    return null;
  }
}

export async function runWithRefreshLock(operation, locks) {
  const resolvedLocks = resolveLocks(locks);
  if (!resolvedLocks?.request) {
    return operation();
  }
  return resolvedLocks.request(REFRESH_LOCK_NAME, { mode: "exclusive" }, operation);
}

export { REFRESH_LOCK_NAME };
