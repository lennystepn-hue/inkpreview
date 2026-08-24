import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { ExportScreen } from "@/features/export/ExportScreen";
import { CreateScreen } from "@/features/generate/CreateScreen";
import { GalleryScreen } from "@/features/gallery/GalleryScreen";
import { CaptureScreen } from "@/features/place/CaptureScreen";
import { StudioScreen } from "@/features/place/StudioScreen";

// Shared screen tree, mounted once at "/" (English) and once at "/de" (German).
// Language is derived from the URL prefix — see lib/useT.ts.
const appChildren = [
  { index: true, element: <CreateScreen /> },
  { path: "studio", element: <StudioScreen /> },
  { path: "export", element: <ExportScreen /> },
  { path: "gallery", element: <GalleryScreen /> },
];

export const router = createBrowserRouter(
  [
    { path: "/", element: <AppShell />, children: appChildren },
    { path: "/de", element: <AppShell />, children: appChildren },
    // Phone capture page (reached via QR using window.location.origin) stays at root.
    { path: "/scan/:token", element: <CaptureScreen /> },
  ],
  { future: { v7_relativeSplatPath: true } },
);
