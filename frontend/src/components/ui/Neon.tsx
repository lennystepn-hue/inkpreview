import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** A blackletter word lit like the neon sign in the shop window. Flickers on
 *  once when mounted (disabled by prefers-reduced-motion). */
export function NeonWord({
  children,
  className,
  flicker = true,
}: {
  children: ReactNode;
  className?: string;
  flicker?: boolean;
}) {
  return (
    <span className={cn("gothic neon-text inline-block", flicker && "animate-tube-on", className)}>
      {children}
    </span>
  );
}
