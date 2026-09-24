import { PersonStanding, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { FlashCard } from "@/components/ui/FlashCard";
import type { Design } from "@/lib/api";
import { flashNo } from "@/lib/flash";
import { useT } from "@/lib/useT";

type Props = {
  versions: Design[];
  onPick: (d: Design) => void;
  onClose: () => void;
};

/** Side-by-side comparison of a design's versions (its parent→refine lineage). */
export function CompareModal({ versions, onPick, onClose }: Props) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-title"
      className="fixed inset-0 z-[70] flex flex-col bg-ground"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <h2 id="compare-title" className="heading text-[1.75rem] text-text">
          {t("compare.title", { n: versions.length })}
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("common.cancel")}
          className="grid h-11 w-11 place-items-center rounded-full text-text-2 hover:bg-raised hover:text-text"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div
        className="flex-1 snap-x snap-mandatory overflow-x-auto px-5 pt-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <ol className="mx-auto flex w-max items-start gap-6">
          {versions.map((d, i) => (
            <li
              key={d.id}
              className="flex w-[78vw] max-w-[20rem] shrink-0 snap-center flex-col gap-4"
            >
              <span className="t-label text-text-3">
                v{i + 1} · {flashNo(d.id)}
              </span>
              <FlashCard
                src={d.clean_png_url ?? d.thumb_url ?? ""}
                alt={d.prompt}
                tilt={i % 2 ? 1 : -1}
                tape="t"
              />
              <p className="typewriter line-clamp-3 text-[0.875rem] text-text-2">“{d.prompt}”</p>
              <Button variant="paper" onClick={() => onPick(d)}>
                <PersonStanding aria-hidden className="h-4 w-4" />
                {t("compare.pick")}
              </Button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
