import { api } from "./api";

// Shared by AppHeader (prefetch, on every authenticated page) and Dashboard
// (read on mount) — same pattern as rightsCache.js, so the dashboard's
// progress/tasks are already cached by the time the user lands on it instead
// of showing the loading spinner first.
const CACHE_PREFIX = "dashboard_cache:";

export function dashboardCacheKey(destinationCity) {
  return destinationCity || "none";
}

export function readDashboardCache(cacheKey) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + cacheKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeDashboardCache(cacheKey, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(data));
  } catch {
    // Storage full/unavailable — caching is a nice-to-have, ignore.
  }
}

// Fired from AppHeader as soon as the user is on any authenticated page, so
// the dashboard is already cached by the time they navigate to it.
export function prefetchDashboard(destinationCity) {
  const cacheKey = dashboardCacheKey(destinationCity);
  return Promise.all([api.progress(), api.items({ type: "moving_task" })])
    .then(([progress, tasks]) => writeDashboardCache(cacheKey, { progress, tasks }))
    .catch(() => {});
}
