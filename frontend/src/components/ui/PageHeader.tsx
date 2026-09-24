import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Label } from "./Label";

/** Consistent screen header: typewriter label, condensed-caps title, lead. */
export function PageHeader({
  label,
  dot = "neon",
  title,
  children,
  align = "left",
  className,
}: {
  label?: ReactNode;
  dot?: "neon" | "stencil" | "gold";
  title: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  const center = align === "center";
  return (
    <header className={cn("flex flex-col gap-3", center && "items-center text-center", className)}>
      {label && <Label dot={dot}>{label}</Label>}
      <h1 className="heading text-[2.5rem] text-text sm:text-5xl md:text-[3.75rem]">{title}</h1>
      {children && (
        <p
          className={cn(
            "max-w-[46ch] text-[0.96875rem] text-text-2 md:text-lg",
            center && "mx-auto",
          )}
        >
          {children}
        </p>
      )}
    </header>
  );
}
