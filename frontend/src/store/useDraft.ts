import { create } from "zustand";

import type { Design, Preview } from "@/lib/api";

/** Carries the design (and resulting preview) through the Studio + Export flow. */
type DraftState = {
  design: Design | null;
  preview: Preview | null;
  setDesign: (d: Design | null) => void;
  setPreview: (p: Preview | null) => void;
};

export const useDraft = create<DraftState>((set) => ({
  design: null,
  preview: null,
  setDesign: (design) => set({ design }),
  setPreview: (preview) => set({ preview }),
}));
