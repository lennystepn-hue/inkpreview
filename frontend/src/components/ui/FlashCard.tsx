import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tape = "l" | "r" | "lr" | "t" | "none";

type Props = {
  src: string;
  alt: string;
  /** Flash number ("№ 417"), bottom-left. */
  no?: string;
  /** Style / caption, bottom-right. */
  caption?: string | null;
  tilt?: number;
  tape?: Tape;
  onClick?: () => void;
  /** Extra overlay content (badges, buttons) inside the card. */
  children?: ReactNode;
  className?: string;
  /** Padding around the art, as a fraction of the card (flash sheets breathe). */
  pad?: "sm" | "md" | "lg";
  loading?: "lazy" | "eager";
  label?: string;
};

const PAD = { sm: "p-[6%]", md: "p-[9%]", lg: "p-[12%]" };

/** A design on flash paper, taped to the wall. The art multiplies into the
 *  paper, so the generated white background reads as paper. */
export function FlashCard({
  src,
  alt,
  no,
  caption,
  tilt = 0,
  tape = "none",
  onClick,
  children,
  className,
  pad = "md",
  loading = "lazy",
  label,
}: Props) {
  const interactive = Boolean(onClick);
  const style = { "--tilt": `${tilt}deg` } as CSSProperties;
  const body = (
    <>
      {(tape === "l" || tape === "lr") && <span aria-hidden className="tape tape-l" />}
      {(tape === "r" || tape === "lr") && <span aria-hidden className="tape tape-r" />}
      {tape === "t" && <span aria-hidden className="tape tape-t" />}
      <span className="block aspect-square w-full">
        <img
          src={src}
          alt={alt}
          loading={loading}
          draggable={false}
          className={cn("flash-art h-full w-full object-contain", PAD[pad])}
        />
      </span>
      {(no || caption) && (
        <span className="t-label flex items-center justify-between gap-2 px-[7%] pb-[max(0.625rem,3cqw)] text-[clamp(0.5625rem,3.1cqw,0.8125rem)] text-paper-mute">
          <span>{no}</span>
          {caption && <span className="truncate">{caption}</span>}
        </span>
      )}
      {children}
    </>
  );

  const cls = cn(
    "flash-card @container block w-full rotate-[var(--tilt)] text-left",
    interactive &&
      "cursor-zoom-in transition-[rotate,translate,box-shadow] duration-300 ease-out-quint hover:-translate-y-1 hover:rotate-0 hover:shadow-[var(--shadow-paper-lift)] focus-visible:rotate-0 active:translate-y-0",
    className,
  );

  return interactive ? (
    <button type="button" onClick={onClick} style={style} className={cls} aria-label={label}>
      {body}
    </button>
  ) : (
    <div style={style} className={cls}>
      {body}
    </div>
  );
}
