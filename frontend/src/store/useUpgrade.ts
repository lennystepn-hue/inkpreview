import { create } from "zustand";

/** Controls the global Pro upgrade modal (opened from every "go Pro" entry point). */
type UpgradeState = {
  open: boolean;
  openUpgrade: () => void;
  closeUpgrade: () => void;
};

export const useUpgrade = create<UpgradeState>((set) => ({
  open: false,
  openUpgrade: () => set({ open: true }),
  closeUpgrade: () => set({ open: false }),
}));
