import { motion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Props = {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** subtle sticker tilt, deterministic by index */
  tilt?: number;
  className?: string;
};

export function Chip({ selected = false, onClick, children, tilt = 0, className }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      style={{ rotate: `${tilt}deg` }}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 font-display text-xs font-semibold tracking-tight transition-all",
        selected
          ? "border-acid bg-acid/15 text-acid shadow-[var(--shadow-glow-acid)]"
          : "border-white/12 bg-white/5 text-white/70 hover:border-white/30 hover:text-white",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
