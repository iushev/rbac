import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The Start plugin has to run before the React one: it generates the route
  // tree and splits the server functions out of the client bundle.
  plugins: [tanstackStart(), react()],
  resolve: {
    // rbac-react is linked from the monorepo, so it resolves React from the
    // repository root while the app resolves its own copy. Two Reacts break
    // hooks and context, which is exactly what the provider relies on.
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: {
      // The rbac packages live outside this directory, as symlinks into the monorepo.
      allow: [".", "../.."],
    },
  },
});
