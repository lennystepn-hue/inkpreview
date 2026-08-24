import { motion } from "motion/react";
import { useState } from "react";

import { ConjuringRitual } from "@/components/magic/ConjuringRitual";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import type { Design } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/useT";
import { useLightbox } from "@/store/useLightbox";

type Props = {
  design: Design;
  variants: Design[];
  variantsLoading: boolean;
  refining: boolean;
  error: string | null;
  onVariants: () => void;
  onRefine: (instruction: string) => void;
  onReset: () => void;
  onTryOn: () => void;
  onChoose: (d: Design) => void;
};

export function ResultView({
  design,
  variants,
  variantsLoading,
  refining,
  error,
  onVariants,
  onRefine,
  onReset,
  onTryOn,
  onChoose,
}: Props) {
  const t = useT();
  const openLightbox = useLightbox((s) => s.open);
  const [refineText, setRefineText] = useState("");
  const [copied, setCopied] = useState(false);
  const all = [design, ...variants.filter((v) => v.id !== design.id)];

  const shareLink = async () => {
    const url = `${window.location.origin}/d/${design.id}`;
    trackEvent("share_design");
    try {
      if (navigator.share) {
        await navigator.share({ title: "InkPreview", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const submitRefine = () => {
    const v = refineText.trim();
    if (!v || refining) return;
    onRefine(v);
    setRefineText("");
  };

  return (
    <div className="flex flex-col gap-5">
      {refining && <ConjuringRitual label={t("result.refine.label")} />}

      <motion.div
        key={design.id}
        initial={{ opacity: 0, scale: 0.94, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-blob border border-white/10 bg-white shadow-[var(--shadow-glow-acid)]"
      >
        {/* flash-sheet corner stamp */}
        <span className="absolute top-3 left-3 z-10 rounded-full bg-ink-950/85 px-2.5 py-1 font-display text-[9px] font-bold tracking-[0.2em] text-acid uppercase">
          ✦ Flash № {design.id.slice(0, 4)}
        </span>
        {design.clean_png_url && (
          <img
            src={design.clean_png_url}
            alt={design.prompt}
            onClick={() =>
              openLightbox({
                id: design.id,
                src: design.clean_png_url ?? "",
                prompt: design.prompt,
                design,
              })
            }
            className="mx-auto max-h-[44dvh] w-full cursor-zoom-in object-contain p-5"
          />
        )}
      </motion.div>

      <div className="text-center">
        <p className="font-display text-base font-semibold text-white/80">
          <span className="mr-1 text-acid">„</span>
          {design.prompt}
          <span className="ml-1 text-acid">"</span>
        </p>
        <p className="mt-1 text-xs text-white/35">{t("result.artistNote")}</p>
      </div>

      {/* Refine via a follow-up prompt */}
      <div className="flex items-center gap-2 rounded-blob border border-white/10 bg-white/5 p-2 pl-4">
        <input
          value={refineText}
          onChange={(e) => setRefineText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRefine();
          }}
          placeholder={t("result.refine.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
        />
        <button
          onClick={submitRefine}
          disabled={refining || !refineText.trim()}
          className="shrink-0 rounded-full bg-cyan/15 px-3.5 py-1.5 font-display text-xs font-semibold text-cyan transition-opacity disabled:opacity-40"
        >
          {t("result.refine.button")}
        </button>
      </div>

      {error && (
        <p className="rounded-2xl border border-magenta/40 bg-magenta/10 p-3 text-sm text-magenta">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" shine onClick={onTryOn}>
          {t("result.tryOn")}
        </Button>
        <Button size="lg" variant="outline" onClick={onVariants} disabled={variantsLoading}>
          {variantsLoading ? t("result.variants.loading") : t("result.variants")}
        </Button>
      </div>

      {(all.length > 1 || variantsLoading) && (
        <div className="grid grid-cols-3 gap-2.5">
          {all.map((v) => (
            <motion.button
              key={v.id}
              onClick={() => onChoose(v)}
              whileTap={{ scale: 0.93 }}
              className={cn(
                "aspect-square overflow-hidden rounded-2xl border bg-white transition-all",
                v.id === design.id
                  ? "scale-[1.04] border-acid shadow-[0_0_24px_-6px_var(--color-acid)]"
                  : "border-white/10 opacity-65 hover:border-white/30 hover:opacity-100",
              )}
            >
              {(v.thumb_url || v.clean_png_url) && (
                <img
                  src={v.thumb_url ?? v.clean_png_url ?? ""}
                  alt=""
                  className="h-full w-full object-contain p-1.5"
                />
              )}
            </motion.button>
          ))}
          {variantsLoading &&
            [0, 1].map((i) => (
              <div key={`sk-${i}`} className="aspect-square animate-pulse rounded-2xl bg-white/5" />
            ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 text-xs text-white/40">
        <button onClick={shareLink} className="hover:text-white/70">
          {copied ? t("result.share.copied") : t("result.share")}
        </button>
        <span className="text-white/15">·</span>
        <button onClick={onReset} className="hover:text-white/70">
          {t("result.newDesign")}
        </button>
      </div>
    </div>
  );
}
