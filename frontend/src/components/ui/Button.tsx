import { type HTMLMotionProps, motion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "ghost" | "magenta";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-acid text-ink-950 shadow-[var(--shadow-glow-acid)]",
  magenta: "bg-magenta text-white shadow-[var(--shadow-glow-magenta)]",
  outline: "border border-white/15 text-white hover:border-acid/60 hover:text-acid",
  ghost: "text-white/70 hover:text-white",
};

const SIZES: Record<Size, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-3.5 text-sm",
  lg: "px-6 py-4 text-base",
};

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  /** Hero CTA treatment: breathing glow + a periodic light sweep. */
  shine?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  shine = false,
  className,
  children,
  ...rest
}: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-blob font-display font-extrabold tracking-tight transition-colors disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        shine && "motion-safe:animate-[breatheGlow_3.2s_ease-in-out_infinite]",
        className,
      )}
      {...rest}
    >
      {children}
      {shine && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/35 blur-md motion-safe:animate-[shine_4.5s_ease-in-out_infinite]"
        />
      )}
    </motion.button>
  );
}
