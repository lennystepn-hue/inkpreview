import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Flash-sheet section eyebrow: ✦──── TEXT ────✦ (hairline rules via .eyebrow). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("eyebrow", className)} aria-hidden>
      <span className="text-acid/70">✦</span>
      <span>{children}</span>
      <span className="text-acid/70">✦</span>
    </p>
  );
}

/** Hand-drawn acid underline stroke — sits under the hero's accent word. */
export function InkStroke({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 14"
      aria-hidden
      className={cn("pointer-events-none", className)}
      preserveAspectRatio="none"
    >
      <path
        d="M4 9 C 50 3, 95 11, 138 7 C 168 4.5, 196 8, 216 5.5"
        fill="none"
        stroke="var(--color-acid)"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M30 12 C 80 8.5, 150 12.5, 200 9.5"
        fill="none"
        stroke="var(--color-acid)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
