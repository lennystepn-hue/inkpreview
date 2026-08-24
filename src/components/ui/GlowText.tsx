import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Acid-rave gradient text. */
export function GlowText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-to-r from-acid via-cyan to-magenta bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
