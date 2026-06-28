import { api } from "./api";

// Shared by AppHeader (prefetch, on every authenticated page) and
// DocumentsForms (read on mount) — mirrors rightsCache.js so both sides
// agree on the exact cache key format.
const CACHE_PREFIX = "forms_cache:";

export function formsCacheKey(destinationCity) {
  return destinationCity || "none";
}

export function readFormsCache(cacheKey) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + cacheKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeFormsCache(cacheKey, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(data));
  } catch {
    // Storage full/unavailable — caching is a nice-to-have, ignore.
  }
}

// Fired from AppHeader as soon as the user is on any authenticated page, so
// the forms data is already cached by the time they click the tab.
export function prefetchForms(destinationCity) {
  const cacheKey = formsCacheKey(destinationCity);
  api.forms(destinationCity)
    .then((data) => writeFormsCache(cacheKey, { forms: data }))
    .catch(() => {
      // Best-effort — DocumentsForms will retry its own fetch on mount anyway.
    });
}
