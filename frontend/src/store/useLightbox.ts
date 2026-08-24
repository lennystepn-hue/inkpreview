import { create } from "zustand";

import type { Design } from "@/lib/api";

/** An enlargeable design image. `design` (when present) is the user's own design
 *  and enables "try on"; feed items omit it and only offer share + create. */
export type LightboxItem = {
  id: string;
  src: string;
  prompt?: string;
  design?: Design;
};

type LightboxState = {
  item: LightboxItem | null;
  open: (item: LightboxItem) => void;
  close: () => void;
};

export const useLightbox = create<LightboxState>((set) => ({
  item: null,
  open: (item) => set({ item }),
  close: () => set({ item: null }),
}));
