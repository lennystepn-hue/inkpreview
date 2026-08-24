import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Backend target for the dev proxy. Defaults to the conventional 8000; override
// with VITE_BACKEND_URL (e.g. if 8000 is occupied locally).
const BACKEND = process.env.VITE_BACKEND_URL || "http://localhost:8000";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon.png"],
      manifest: {
        name: "InkPreview — AI Tattoo Studio",
        short_name: "InkPreview",
        description:
          "InkPreview is an AI tattoo simulator. Describe a tattoo or pick a style, generate an artist-ready design, then preview it realistically on a photo of your own skin to choose the perfect placement and size before you ink. Free to try, no signup.",
        lang: "en",
        categories: ["lifestyle", "photo", "graphics"],
        theme_color: "#07070a",
        background_color: "#07070a",
        display: "standalone",
        orientation: "portrait",
        id: "/",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api/, /^\/media/] },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      // Two HTML entry points sharing one bundle: English at "/" and German at
      // "/de" — each ships its own localized <head> (title/meta/OG/JSON-LD/hreflang).
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        de: fileURLToPath(new URL("./de/index.html", import.meta.url)),
      },
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // dev: forward API + media to the FastAPI backend
      "/api": BACKEND,
      "/media": BACKEND,
    },
  },
});
