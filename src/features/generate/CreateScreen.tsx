import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConjuringRitual } from "@/components/magic/ConjuringRitual";
import { FlashGallery, FlashStrip } from "@/components/magic/FlashWall";
import { InkMargins } from "@/components/magic/InkMargins";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { GlowText } from "@/components/ui/GlowText";
import { enhancePrompt } from "@/lib/api";
import { MAGIC } from "@/lib/magicPrompts";
import { useGeneration } from "@/lib/useGeneration";
import { useStyles } from "@/lib/useStyles";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { ResultView } from "./ResultView";
import { StyleSheet } from "./StyleSheet";

export function CreateScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lp = useLangPath();
  const { data: styles = [] } = useStyles();
  const gen = useGeneration();
  const setDraft = useDraft((s) => s.setDesign);

  const [prompt, setPrompt] = useState("");
  const [slugs, setSlugs] = useState<string[]>([]);
  const [color, setColor] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const selected = styles.filter((s) => slugs.includes(s.slug));
  const toggle = (slug: string) =>
    setSlugs((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  const onEnhance = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    try {
      const r = await enhancePrompt(prompt, slugs);
      setPrompt(r.enhanced);
    } finally {
      setEnhancing(false);
    }
  };

  const onMagic = () => {
    const m = MAGIC[Math.floor(Math.random() * MAGIC.length)];
    setPrompt(m.prompt);
    setSlugs([m.slug]);
  };

  const onSubmit = () => {
    if (prompt.trim()) gen.start({ prompt, styles: slugs, color });
  };

  const onTryOn = () => {
    if (gen.design) {
      setDraft(gen.design);
      navigate(lp("/studio"));
    }
  };

  if (gen.state === "done" && gen.design) {
    return (
      <>
        <div className="mx-auto max-w-md md:max-w-lg md:pt-6">
          <ResultView
            design={gen.design}
            variants={gen.variants}
            variantsLoading={gen.variantsLoading}
            refining={gen.refining}
            error={gen.error}
            onVariants={gen.makeVariants}
            onRefine={gen.refine}
            onReset={gen.reset}
            onTryOn={onTryOn}
            onChoose={gen.choose}
          />
        </div>
        <StyleSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          styles={styles}
          selected={slugs}
          onToggle={toggle}
        />
      </>
    );
  }

  return (
    <>
      <AnimatePresence>{gen.state === "conjuring" && <ConjuringRitual />}</AnimatePresence>

      <InkMargins />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <h1 className="sr-only">{t("create.srHeading")}</h1>
        <FlashStrip className="mb-7 md:hidden" />

        {/* Editorial hero */}
        <div className="md:mx-auto md:max-w-2xl md:pt-8 md:text-center">
          <h2 className="font-display text-3xl leading-[1.02] font-extrabold tracking-tight md:text-6xl">
            {t("create.hero.titlePre")}
            <GlowText>{t("create.hero.titleGlow")}</GlowText>
            {t("create.hero.titlePost")}
          </h2>
          <p className="mt-3 text-sm text-white/50 md:mt-5 md:text-lg">{t("create.hero.tagline")}</p>
        </div>

        {/* Generator — refined card on desktop */}
        <div className="mx-auto mt-7 flex w-full max-w-md flex-col gap-5 md:mt-10 md:max-w-xl md:gap-6 md:rounded-[2rem] md:border md:border-white/10 md:bg-white/[0.02] md:p-8">
          <div className="rounded-blob border border-white/10 bg-white/5 p-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={t("create.prompt.placeholder")}
              className="w-full resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none md:text-base"
            />
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={onEnhance}
                disabled={enhancing || !prompt.trim()}
                className="font-display text-xs font-semibold text-cyan disabled:opacity-40"
              >
                {enhancing ? t("create.enhance.loading") : t("create.enhance")}
              </button>
              <button onClick={onMagic} className="text-xs text-white/40 hover:text-white/70">
                {t("create.magic")}
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-xs tracking-wide text-white/35 uppercase">{t("create.style.label")}</p>
              <button
                onClick={() => setSheetOpen(true)}
                className="font-display text-xs font-semibold text-acid"
              >
                {t("create.style.pick")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.length === 0 ? (
                <span className="text-xs text-white/30">{t("create.style.empty")}</span>
              ) : (
                selected.map((s, i) => (
                  <Chip key={s.slug} tilt={(i % 3) - 1} selected onClick={() => toggle(s.slug)}>
                    {s.name} ✕
                  </Chip>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => setColor((c) => !c)}
            className="flex items-center gap-2 text-xs text-white/45"
          >
            <span
              className={`h-4 w-7 rounded-full p-0.5 transition-colors ${color ? "bg-acid" : "bg-white/15"}`}
            >
              <span
                className={`block h-3 w-3 rounded-full bg-ink-950 transition-transform ${color ? "translate-x-3" : ""}`}
              />
            </span>
            {color ? t("create.color.on") : t("create.color.off")}
          </button>

          <Button className="w-full" size="lg" onClick={onSubmit} disabled={!prompt.trim()}>
            {t("create.submit")}
          </Button>

          {gen.state === "error" && (
            <p className="rounded-2xl border border-magenta/40 bg-magenta/10 p-3 text-sm text-magenta">
              {gen.error}{" "}
              <button onClick={gen.reset} className="underline">
                {t("common.retry")}
              </button>
            </p>
          )}
        </div>

        {/* Curated gallery (desktop) */}
        <section className="mt-20 hidden md:block">
          <p className="mb-7 text-center font-display text-xs tracking-[0.25em] text-white/30 uppercase">
            {t("create.gallery.label")}
          </p>
          <FlashGallery />
        </section>
      </div>

      <StyleSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        styles={styles}
        selected={slugs}
        onToggle={toggle}
      />
    </>
  );
}
