import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PORT = process.env.PORT ?? "3000";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/web",
    emptyOutDir: true,
  },
  resolve: {
    // rbac-react is linked from the monorepo, so it resolves React from the
    // repository root while the app resolves its own copy. Two Reacts break
    // hooks and context, which is exactly what the provider relies on.
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    // The dev server only serves the UI; everything under /api is the Express app.
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
    fs: {
      // The rbac packages live outside this directory, as symlinks into the monorepo.
      allow: [".", "../.."],
    },
  },
});
