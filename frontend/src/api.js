import { supabase } from "./supabaseClient";
import { DEMO } from "./demo";
import { demoApi } from "./demoData";

// Base URL of the FastAPI backend. Empty -> same origin (Vite proxy / prod static).
const API_BASE = import.meta.env.VITE_API_URL || "";

async function authHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { ...(await authHeader()) };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const realApi = {
  me: () => request("/me"),
  statuses: () => request("/statuses"),
  categories: () => request("/categories"),
  items: ({ category, type, city } = {}) => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (type) qs.set("type", type);
    if (city) qs.set("city", city);
    const q = qs.toString();
    return request(`/items${q ? `?${q}` : ""}`);
  },
  progress: () => request("/progress"),
  setStatus: (itemType, itemId, payload) =>
    request(`/items/${itemType}/${itemId}/status`, { method: "PUT", body: payload }),

  createCustomTask: (payload) =>
    request("/custom-tasks", { method: "POST", body: payload }),

  setCustomTaskContent: (itemId, payload) =>
    request(`/custom-tasks/${itemId}/content`, { method: "PUT", body: payload }),

  setDeadline: (itemType, itemId, payload) =>
    request(`/items/${itemType}/${itemId}/deadline`, { method: "PUT", body: payload }),

  ask: (payload) =>
    request("/ask", { method: "POST", body: payload }),

  taskAgentChat: (messages) =>
    request("/task-agent/chat", { method: "POST", body: { messages } }),
};

// In demo mode, serve mock data with no backend (see demo.js / demoData.js).
export const api = DEMO ? demoApi : realApi;
