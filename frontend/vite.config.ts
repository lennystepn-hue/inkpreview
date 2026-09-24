import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Backend target for the dev proxy: the Cloudflare Worker under `wrangler dev`
// (worker/, port 8787). Override with VITE_BACKEND_URL (e.g. the legacy FastAPI
// backend on :8000).
const BACKEND = process.env.VITE_BACKEND_URL || "http://localhost:8787";

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
        theme_color: "#0f0d0c",
        background_color: "#0f0d0c",
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
      // Backend-served routes must bypass the SPA navigate-fallback, or the SW
      // would serve index.html for them (→ react-router 404). Covers the API,
      // media, server-rendered share/SEO pages, and the sitemap.
      workbox: {
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/media/,
          /^\/d\//,
          /^\/style\//,
          /^\/tattoo\//,
          /^\/de\/style\//,
          /^\/de\/tattoo\//,
          /^\/sitemap\.xml$/,
        ],
      },
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
      // dev: forward API + media to the FastAPI backend. changeOrigin lets the
      // dev server proxy to a remote HTTPS backend (correct Host/SNI).
      "/api": { target: BACKEND, changeOrigin: true, secure: false },
      "/media": { target: BACKEND, changeOrigin: true, secure: false },
    },
  },
});
