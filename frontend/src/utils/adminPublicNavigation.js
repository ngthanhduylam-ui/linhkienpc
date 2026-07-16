export const ADMIN_RETURN_LOCATION_KEY = "public_catalogue_admin_return_location";

const ADMIN_ROOT_PATH = "/admin";

export function validateAdminReturnLocation(value, origin = window.location.origin) {
  const returnLocation = typeof value === "string" ? value.trim() : "";
  if (!returnLocation.startsWith("/") || returnLocation.startsWith("//")) {
    return ADMIN_ROOT_PATH;
  }

  try {
    const parsed = new URL(returnLocation, origin);
    const isAdminPath = parsed.pathname === ADMIN_ROOT_PATH || parsed.pathname.startsWith(`${ADMIN_ROOT_PATH}/`);
    if (parsed.origin !== origin || !isAdminPath) return ADMIN_ROOT_PATH;
    return returnLocation;
  } catch {
    return ADMIN_ROOT_PATH;
  }
}

export function saveAdminReturnLocation(location = window.location, storage) {
  const returnLocation = `${location.pathname || ""}${location.search || ""}${location.hash || ""}`;
  const safeReturnLocation = validateAdminReturnLocation(returnLocation, location.origin);

  try {
    const resolvedStorage = storage ?? window.sessionStorage;
    resolvedStorage.setItem(ADMIN_RETURN_LOCATION_KEY, safeReturnLocation);
    return true;
  } catch {
    return false;
  }
}

export function readAdminReturnLocation(storage, origin = window.location.origin) {
  try {
    const resolvedStorage = storage ?? window.sessionStorage;
    const storedValue = resolvedStorage.getItem(ADMIN_RETURN_LOCATION_KEY);
    if (storedValue === null) return null;
    return validateAdminReturnLocation(storedValue, origin);
  } catch {
    return null;
  }
}

export function consumeAdminReturnLocation(storage, origin = window.location.origin) {
  const returnLocation = readAdminReturnLocation(storage, origin) || ADMIN_ROOT_PATH;
  try {
    const resolvedStorage = storage ?? window.sessionStorage;
    resolvedStorage.removeItem(ADMIN_RETURN_LOCATION_KEY);
  } catch {
    // Navigation still uses the validated path when storage cleanup is unavailable.
  }
  return returnLocation;
}
