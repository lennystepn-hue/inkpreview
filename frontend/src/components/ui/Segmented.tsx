import { cn } from "@/lib/cn";

export type SegmentOption = { v: string; label: string; sub?: string };

/** Inked segmented control for paper surfaces (consultation slip). */
export function Segmented({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SegmentOption[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-full p-[3px] shadow-[inset_0_0_0_1.5px_var(--color-paper-ink)]"
    >
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.v)}
            className={cn(
              "flex min-h-10 flex-1 flex-col items-center justify-center rounded-full px-2 py-1 leading-none transition-colors duration-150",
              on ? "bg-paper-ink text-paper" : "text-paper-ink hover:bg-paper-ink/[0.07]",
            )}
          >
            <span className="font-sans cond text-[0.8125rem] font-bold tracking-[0.03em] uppercase">
              {o.label}
            </span>
            {o.sub && (
              <span
                className={cn(
                  "t-label mt-1 text-[0.5625rem]",
                  on ? "text-paper/70" : "text-paper-mute",
                )}
              >
                {o.sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
