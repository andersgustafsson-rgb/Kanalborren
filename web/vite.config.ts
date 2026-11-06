import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "brand/kanalhugget-logo.png"],
      manifest: {
        name: "KanalHugget",
        short_name: "KanalHugget",
        description: "Social fiskekarta för Malmö kanal",
        theme_color: "#05080d",
        background_color: "#05080d",
        display: "standalone",
        start_url: "/",
        lang: "sv",
        icons: [
          {
            src: "/brand/kanalhugget-logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
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
