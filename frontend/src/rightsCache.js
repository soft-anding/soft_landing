import { api } from "./api";

// Shared by AppHeader (prefetch, on every authenticated page) and
// RightsBenefits (read on mount) — both must agree on the exact cache key
// format, so it lives in one place instead of two copies that could drift.
const CACHE_PREFIX = "rights_cache:";

export function rightsCacheKey(destinationCity) {
  return destinationCity || "none";
}

export function readRightsCache(cacheKey) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + cacheKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeRightsCache(cacheKey, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(data));
  } catch {
    // Storage full/unavailable — caching is a nice-to-have, ignore.
  }
}

// Fired from AppHeader as soon as the user is on any authenticated page, so
// the rights/benefits data is already cached by the time they click the tab.
export function prefetchRights(destinationCity) {
  const cacheKey = rightsCacheKey(destinationCity);
  api.items({ type: "rights_item", city: destinationCity })
    .then((data) => writeRightsCache(cacheKey, { items: data }))
    .catch(() => {
      // Best-effort — RightsBenefits will retry its own fetch on mount anyway.
    });
}
