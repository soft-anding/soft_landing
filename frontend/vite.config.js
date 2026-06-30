import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy /api to the FastAPI server so the frontend can use same-origin URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: ["frontend-staging-d554.up.railway.app"],
  },
});
