import { api } from "./api";

// Shared by AppHeader (prefetch, on every authenticated page) and Dashboard
// (read on mount) — same pattern as rightsCache.js, so the daily board is
// already cached by the time the user lands on the dashboard.
const CACHE_KEY = "daily_board_cache";

export function readDailyBoardCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeDailyBoardCache(pinnedKeys) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(pinnedKeys));
  } catch {
    // Storage full/unavailable — caching is a nice-to-have, ignore.
  }
}

// Fired from AppHeader as soon as the user is on any authenticated page, so
// the daily board is already cached by the time Dashboard mounts.
export function prefetchDailyBoard() {
  api.getDailyBoard()
    .then((rows) => writeDailyBoardCache(rows.map((r) => `${r.item_type}:${r.item_id}`)))
    .catch(() => {
      // Best-effort — Dashboard will retry its own fetch on mount anyway.
    });
}
