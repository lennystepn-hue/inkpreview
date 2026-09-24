import { motion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Props = {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** "paper" = on a paper surface (ink chips); "wall" = on the dark UI. */
  tone?: "paper" | "wall";
  className?: string;
  "aria-label"?: string;
};

const TONES = {
  paper: {
    on: "bg-paper-ink text-paper shadow-[inset_0_0_0_1.5px_var(--color-paper-ink)]",
    off: "text-paper-ink shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-paper-ink)_35%,transparent)] hover:shadow-[inset_0_0_0_1.5px_var(--color-paper-ink)]",
  },
  wall: {
    on: "bg-neon text-neon-ink",
    off: "text-text-2 shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] hover:text-text hover:shadow-[inset_0_0_0_1.5px_var(--color-text-3)]",
  },
};

export function Chip({
  selected = false,
  onClick,
  children,
  tone = "wall",
  className,
  ...rest
}: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-sans cond text-[0.8125rem] font-bold tracking-[0.03em] uppercase transition-[background-color,color,box-shadow] duration-150",
        selected ? TONES[tone].on : TONES[tone].off,
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
