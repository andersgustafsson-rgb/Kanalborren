import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon-v2.ico",
        "favicon-16.png",
        "favicon-32.png",
        "favicon-48.png",
        "apple-touch-icon-v2.png",
        "icon-192-v2.png",
        "icon-512-v2.png",
        "brand/kanalhugget-logo.png",
      ],
      manifest: {
        id: "/kanalhugget-v3",
        name: "KanalHugget",
        short_name: "KanalHugget",
        description: "Social fiskekarta för Malmö kanal",
        theme_color: "#05080d",
        background_color: "#05080d",
        display: "standalone",
        start_url: "/?source=pwa&v=3",
        lang: "sv",
        icons: [
          {
            src: "/icon-192-v2.png?v=3",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512-v2.png?v=3",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512-v2.png?v=3",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,webp,geojson}"],
      },
    }),
  ],
});
