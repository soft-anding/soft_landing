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

  forms: (city) => request(`/forms${city ? `?city=${city}` : ""}`),
  setFormChecked: (formId, checked) =>
    request(`/forms/${formId}/checked`, { method: "PUT", body: { checked } }),

  createCustomTask: (payload) =>
    request("/custom-tasks", { method: "POST", body: payload }),

  setCustomTaskContent: (itemId, payload) =>
    request(`/custom-tasks/${itemId}/content`, { method: "PUT", body: payload }),

  setDeadline: (itemType, itemId, payload) =>
    request(`/items/${itemType}/${itemId}/deadline`, { method: "PUT", body: payload }),

  ask: (payload) =>
    request("/ask", { method: "POST", body: payload }),

  // The agent's reply streams in as plain text chunks (not JSON) — onChunk is
  // called with (chunk, fullTextSoFar) as each piece arrives, so the caller
  // can paint the message incrementally instead of waiting for it to finish.
  streamTaskAgentChat: async (messages, onChunk) => {
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    const res = await fetch(`${API_BASE}/api/task-agent/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages }),
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

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        onChunk(chunk, full);
      }
    }
    return full;
  },

  streamDocumentsAgentChat: async (messages, category, forms, onChunk) => {
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    const res = await fetch(`${API_BASE}/api/documents-agent/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, category, forms }),
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

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        onChunk(chunk, full);
      }
    }
    return full;
  },
};

// In demo mode, serve mock data with no backend (see demo.js / demoData.js).
export const api = DEMO ? demoApi : realApi;
