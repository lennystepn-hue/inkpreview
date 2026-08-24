import { X } from "lucide-react";

import type { Design } from "@/lib/api";
import { useT } from "@/lib/useT";

type Props = {
  versions: Design[];
  onPick: (d: Design) => void;
  onClose: () => void;
};

/** Side-by-side comparison of a design's versions (its parent→refine lineage). */
export function CompareModal({ versions, onPick, onClose }: Props) {
  const t = useT();
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-ink-950/90 backdrop-blur"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4">
        <span className="font-display text-sm font-bold">
          {t("compare.title", { n: versions.length })}
        </span>
        <button onClick={onClose} aria-label={t("common.cancel")} className="text-white/60">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="flex-1 snap-x snap-mandatory overflow-x-auto px-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full gap-4">
          {versions.map((d, i) => (
            <div key={d.id} className="flex w-[85vw] max-w-sm shrink-0 snap-center flex-col sm:w-72">
              <div className="flex items-center justify-between pb-2">
                <span className="font-display text-xs font-bold text-acid">v{i + 1}</span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white">
                <img
                  src={d.clean_png_url ?? d.thumb_url ?? ""}
                  alt={d.prompt}
                  className="aspect-square w-full object-contain p-3"
                />
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-white/50">„{d.prompt}"</p>
              <button
                onClick={() => onPick(d)}
                className="mt-2 rounded-full bg-acid py-3 font-display text-xs font-bold text-ink-950"
              >
                {t("compare.pick")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
