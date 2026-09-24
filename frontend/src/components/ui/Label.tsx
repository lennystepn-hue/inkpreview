import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const DOTS = {
  neon: "bg-neon shadow-[0_0_8px_var(--color-neon)]",
  stencil: "bg-stencil shadow-[0_0_8px_var(--color-stencil)]",
  gold: "bg-gold",
} as const;

/** Typewriter label (section eyebrow, meta). Optional status dot. */
export function Label({
  children,
  className,
  dot,
  as: Tag = "p",
}: {
  children: ReactNode;
  className?: string;
  dot?: keyof typeof DOTS;
  as?: "p" | "span" | "h2" | "h3" | "div";
}) {
  return (
    <Tag className={cn("t-label flex items-center gap-2 text-text-3", className)}>
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOTS[dot])} />}
      {children}
    </Tag>
  );
}
