import { type HTMLMotionProps, motion } from "motion/react";

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

type Props = HTMLMotionProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant = "primary", size = "md", className, children, ...rest }: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-blob font-display font-extrabold tracking-tight transition-colors disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
