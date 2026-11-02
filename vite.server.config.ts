import { defineConfig } from "vite";

// Bundles the game rules and sync logic for Supabase Edge Functions. The browser
// game doesn't import any of this.
export default defineConfig({
  publicDir: false,
  build: {
    lib: { entry: "src/server/index.ts", formats: ["es"], fileName: () => "game-server.js" },
    outDir: "supabase/functions/_shared",
    emptyOutDir: true,
    minify: false,
    target: "es2022",
  },
});
