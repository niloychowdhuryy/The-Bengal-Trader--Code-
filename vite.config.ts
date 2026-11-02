import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      manifest: {
        name: "The Bengal Trader",
        short_name: "Bengal Trader",
        description:
          "Trade Bengal's rivers, outfit your boat, and grow your family's fortune.",
        theme_color: "#244b3b",
        background_color: "#f5efdf",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/bengal-trader-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,ico,png,woff2}"],
        maximumFileSizeToCacheInBytes: 24 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [".localhost"],
  },
});
