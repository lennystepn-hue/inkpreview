import { Layers, PersonStanding, RotateCcw, Share2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { ConjuringRitual } from "@/components/magic/ConjuringRitual";
import { Button } from "@/components/ui/Button";
import { FlashCard } from "@/components/ui/FlashCard";
import { Label } from "@/components/ui/Label";
import { trackEvent } from "@/lib/analytics";
import type { Design } from "@/lib/api";
import { cn } from "@/lib/cn";
import { flashNo, styleName } from "@/lib/flash";
import { useStyles } from "@/lib/useStyles";
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
  const reduce = useReducedMotion();
  const { data: styles = [] } = useStyles();
  const openLightbox = useLightbox((s) => s.open);
  const [refineText, setRefineText] = useState("");
  const [copied, setCopied] = useState(false);
  const all = [design, ...variants.filter((v) => v.id !== design.id)];
  const no = flashNo(design.id);
  const caption = styleName(design.styles, styles);

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
    <div className="mx-auto grid max-w-md items-start gap-9 md:max-w-5xl md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14 md:pt-4">
      <AnimatePresence>{refining && <ConjuringRitual mode="refine" />}</AnimatePresence>

      {/* The fresh flash, pinned */}
      <motion.div
        key={design.id}
        initial={reduce ? false : { y: 18, rotate: -4, scale: 0.98 }}
        animate={{ y: 0, rotate: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="px-2 pt-2"
      >
        {design.clean_png_url && (
          <FlashCard
            src={design.clean_png_url}
            alt={design.prompt}
            no={no}
            caption={caption}
            tilt={-1}
            tape="lr"
            loading="eager"
            label={design.prompt}
            onClick={() =>
              openLightbox({
                id: design.id,
                src: design.clean_png_url ?? "",
                prompt: design.prompt,
                design,
              })
            }
          />
        )}
      </motion.div>

      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <Label dot="neon">
            {t("result.label")} · {no}
          </Label>
          <p className="typewriter text-[1.1875rem] leading-snug text-text">“{design.prompt}”</p>
          <p className="text-[0.9375rem] text-text-2">{t("result.artistNote")}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={onTryOn}>
            <PersonStanding aria-hidden className="h-5 w-5" />
            {t("result.tryOn")}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onVariants} disabled={variantsLoading}>
              <Layers aria-hidden className="h-4 w-4" />
              {variantsLoading ? t("result.variants.loading") : t("result.variants")}
            </Button>
            <Button variant="outline" onClick={shareLink}>
              <Share2 aria-hidden className="h-4 w-4" />
              {copied ? t("result.share.copied") : t("result.share")}
            </Button>
          </div>
        </div>

        {(all.length > 1 || variantsLoading) && (
          <div className="flex flex-col gap-3">
            <Label>{t("result.variants.label")}</Label>
            <div className="grid grid-cols-3 gap-3">
              {all.map((v) => {
                const on = v.id === design.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onChoose(v)}
                    aria-pressed={on}
                    aria-label={flashNo(v.id)}
                    className={cn(
                      "flash-card aspect-square transition-[box-shadow,translate] duration-200",
                      on
                        ? "shadow-[0_0_0_2px_var(--color-ground),0_0_0_4px_var(--color-neon),var(--shadow-paper)]"
                        : "opacity-80 hover:-translate-y-0.5 hover:opacity-100",
                    )}
                  >
                    {(v.thumb_url || v.clean_png_url) && (
                      <img
                        src={v.thumb_url ?? v.clean_png_url ?? ""}
                        alt=""
                        className="flash-art h-full w-full object-contain p-[10%]"
                      />
                    )}
                  </button>
                );
              })}
              {variantsLoading &&
                [0, 1].map((i) => <div key={`sk-${i}`} className="skeleton-paper aspect-square" />)}
            </div>
          </div>
        )}

        {/* Refine via a note for the artist */}
        <div className="flex flex-col gap-3">
          <Label>{t("result.refine.title")}</Label>
          <form
            className="flex items-center gap-2 rounded-full bg-surface p-1.5 pl-5 shadow-[inset_0_0_0_1px_var(--color-line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-text-3)]"
            onSubmit={(e) => {
              e.preventDefault();
              submitRefine();
            }}
          >
            <label htmlFor="refine" className="sr-only">
              {t("result.refine.placeholder")}
            </label>
            <input
              id="refine"
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder={t("result.refine.placeholder")}
              className="typewriter min-w-0 flex-1 bg-transparent text-[0.9375rem] text-text outline-none"
            />
            <Button
              type="submit"
              variant="paper"
              size="sm"
              disabled={refining || !refineText.trim()}
            >
              {t("result.refine.button")}
            </Button>
          </form>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius-panel)] bg-surface p-4 text-[0.9375rem] text-text shadow-[inset_0_0_0_1.5px_var(--color-neon)]"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 self-start font-sans cond text-[0.875rem] font-bold tracking-[0.06em] text-text-3 uppercase transition-colors hover:text-text"
        >
          <RotateCcw aria-hidden className="h-4 w-4" />
          {t("result.newDesign")}
        </button>
      </div>
    </div>
  );
}
