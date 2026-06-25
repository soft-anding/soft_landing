import { createClient } from "@supabase/supabase-js";

// supabase-js is used ONLY for Google OAuth + holding the session/token.
// All app data goes through the FastAPI backend (see api.js).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in frontend/.env");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
