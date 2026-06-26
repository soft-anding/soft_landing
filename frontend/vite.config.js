import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy /api to the FastAPI server so the frontend can use same-origin URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The project lives inside a OneDrive-synced folder, and OneDrive's background
    // sync touches file timestamps even without real content changes. That trips
    // Vite's file watcher into doing a full page reload every time — wiping React
    // state and refetching everything — most noticeably right after switching back
    // to this tab/window. Disabling the watcher trades away auto-reload-on-save:
    // after editing a file, refresh the browser manually to see the change.
    watch: null,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
