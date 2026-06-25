// Frontend-only preview mode. When VITE_DEMO=true the app fakes a logged-in
// session and serves mock data (see demoData.js) so the full screen flow can be
// previewed without a backend or Google sign-in. Set VITE_DEMO=false (or remove
// it) to use the real auth + API.
export const DEMO = import.meta.env.VITE_DEMO === "true";
