import { cn } from "@/lib/cn";

/** "Ink" in blackletter + "PREVIEW" in condensed caps, with the neon pilot light. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-[0.3em] leading-none", className)}>
      <span className="gothic text-[1.6em] text-paper">Ink</span>
      <span className="heading text-[0.95em] tracking-[0.16em] text-text">Preview</span>
      <span
        aria-hidden
        className="h-[0.36em] w-[0.36em] self-center rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]"
      />
    </span>
  );
}
