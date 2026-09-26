import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/maskable.svg"],
      manifest: {
        name: "Ice Tap",
        short_name: "Ice Tap",
        description:
          "A 60-second ice-fishing reflex game. Tap the fish, dodge the hazards, play offline from your home screen.",
        theme_color: "#07131c",
        background_color: "#07131c",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        id: "/",
        categories: ["games"],
        icons: [
          {
            src: "/icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons/maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,webmanifest}"],
      },
    }),
  ],
  server: { port: 5174, strictPort: false },
  preview: { port: 4174, strictPort: false },
});
