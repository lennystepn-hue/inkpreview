import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { CreateScreen } from "@/features/generate/CreateScreen";

// The home/create screen stays eager (it's the LCP-critical landing route).
// Everything else is code-split via route.lazy so the initial bundle stays lean
// (Core Web Vitals → SEO). react-router awaits the chunk before rendering.
const appChildren = [
  { index: true, element: <CreateScreen /> },
  {
    path: "explore",
    lazy: async () => ({
      Component: (await import("@/features/explore/ExploreScreen")).ExploreScreen,
    }),
  },
  {
    path: "studio",
    lazy: async () => ({
      Component: (await import("@/features/place/StudioScreen")).StudioScreen,
    }),
  },
  {
    path: "export",
    lazy: async () => ({
      Component: (await import("@/features/export/ExportScreen")).ExportScreen,
    }),
  },
  {
    path: "gallery",
    lazy: async () => ({
      Component: (await import("@/features/gallery/GalleryScreen")).GalleryScreen,
    }),
  },
  {
    path: "account",
    lazy: async () => ({
      Component: (await import("@/features/account/AccountScreen")).AccountScreen,
    }),
  },
  {
    path: "pricing",
    lazy: async () => ({
      Component: (await import("@/features/pricing/PricingScreen")).PricingScreen,
    }),
  },
  {
    path: "impressum",
    lazy: async () => {
      const { LegalScreen } = await import("@/features/legal/LegalScreen");
      return { Component: () => <LegalScreen doc="impressum" /> };
    },
  },
  {
    path: "datenschutz",
    lazy: async () => {
      const { LegalScreen } = await import("@/features/legal/LegalScreen");
      return { Component: () => <LegalScreen doc="datenschutz" /> };
    },
  },
  {
    path: "agb",
    lazy: async () => {
      const { LegalScreen } = await import("@/features/legal/LegalScreen");
      return { Component: () => <LegalScreen doc="agb" /> };
    },
  },
  {
    path: "*",
    lazy: async () => ({
      Component: (await import("@/features/NotFoundScreen")).NotFoundScreen,
    }),
  },
];

export const router = createBrowserRouter(
  [
    { path: "/", element: <AppShell />, children: appChildren },
    { path: "/de", element: <AppShell />, children: appChildren },
    // Phone capture page (reached via QR using window.location.origin) stays at root.
    {
      path: "/scan/:token",
      lazy: async () => ({
        Component: (await import("@/features/place/CaptureScreen")).CaptureScreen,
      }),
    },
  ],
  { future: { v7_relativeSplatPath: true } },
);
