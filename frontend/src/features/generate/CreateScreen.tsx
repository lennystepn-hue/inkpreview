import { ArrowRight, Dices, Plus, WandSparkles, X, Zap } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ConjuringRitual, preloadRitual } from "@/components/magic/ConjuringRitual";
import { FreshWall, HeroFan, HeroWall } from "@/components/magic/FlashWall";
import { Paywall, QuotaMeter } from "@/components/Quota";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Label } from "@/components/ui/Label";
import { NeonWord } from "@/components/ui/Neon";
import { Segmented } from "@/components/ui/Segmented";
import { trackEvent } from "@/lib/analytics";
import { enhancePrompt } from "@/lib/api";
import { cn } from "@/lib/cn";
import { MAGIC } from "@/lib/magicPrompts";
import { useGeneration } from "@/lib/useGeneration";
import { useStyles } from "@/lib/useStyles";
import { useLang, useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { HowItWorks } from "./HowItWorks";
import { ResultView } from "./ResultView";
import { StyleSheet } from "./StyleSheet";

/** Today's date as a shop would stamp it on a consultation slip. */
function useStampDate() {
  const lang = useLang();
  return useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
        .format(new Date())
        .toUpperCase(),
    [lang],
  );
}

function SlipLabel({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return htmlFor ? (
    <label htmlFor={htmlFor} className="t-label block text-paper-mute">
      {children}
    </label>
  ) : (
    <p className="t-label text-paper-mute">{children}</p>
  );
}

export function CreateScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lp = useLangPath();
  const stamp = useStampDate();
  const { data: styles = [] } = useStyles();
  const gen = useGeneration();
  const setDraft = useDraft((s) => s.setDesign);

  const [prompt, setPrompt] = useState("");
  const [slugs, setSlugs] = useState<string[]>([]);
  const [color, setColor] = useState(false);
  const [complexity, setComplexity] = useState("medium");
  const [lineWeight, setLineWeight] = useState("medium");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Warm the first flash of the wait screen once the page is idle, the rest
  // as soon as someone starts typing an idea.
  useEffect(() => {
    const id = window.setTimeout(() => preloadRitual(false), 2500);
    return () => window.clearTimeout(id);
  }, []);
  const typed = prompt.length > 0;
  useEffect(() => {
    if (typed) preloadRitual(true);
  }, [typed]);

  const selected = styles.filter((s) => slugs.includes(s.slug));
  const toggle = (slug: string) =>
    setSlugs((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));
  const ready = Boolean(prompt.trim());

  const onEnhance = async () => {
    if (!ready) return;
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
    if (ready) gen.start({ prompt, styles: slugs, color, complexity, line_weight: lineWeight });
  };

  const onTryOn = () => {
    if (gen.design) {
      trackEvent("try_on");
      setDraft(gen.design);
      navigate(lp("/studio"));
    }
  };

  const styleSheet = (
    <StyleSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      styles={styles}
      selected={slugs}
      onToggle={toggle}
    />
  );

  if (gen.state === "done" && gen.design) {
    return (
      <>
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
        {styleSheet}
      </>
    );
  }

  return (
    <>
      <AnimatePresence>{gen.state === "conjuring" && <ConjuringRitual />}</AnimatePresence>

      <h1 className="sr-only">{t("create.srHeading")}</h1>

      <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12 lg:gap-20">
        {/* ── Hero + consultation slip ── */}
        <div className="flex flex-col gap-7 md:gap-9 md:pt-4">
          <HeroFan className="-mt-1 md:hidden" />

          <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
            <Label dot="neon">{t("create.hero.eyebrow")}</Label>
            <h2 className="heading text-[2.6rem] text-text sm:text-6xl lg:text-[4.625rem]">
              <span className="block">{t("create.hero.titlePre")}</span>
              {/* the neon sign in the shop window */}
              <span className="mt-2 block">
                <NeonWord className="text-[1em] leading-[1.05] lg:text-[0.92em]">
                  {t("create.hero.titleGlow")}
                  {t("create.hero.titlePost")}
                </NeonWord>
              </span>
            </h2>
            <p className="max-w-[36ch] text-base text-text-2 md:max-w-none md:text-lg">
              {/* break between sentences, never inside one */}
              {t("create.hero.tagline")
                .split(/(?<=\.)\s+/)
                .map((sentence, i) => (
                  <Fragment key={i}>
                    {i > 0 && " "}
                    <span className="inline-block">{sentence}</span>
                  </Fragment>
                ))}
            </p>
          </div>

          {/* The consultation slip — the idea goes on paper */}
          <form
            className="paper flex flex-col gap-5 rounded-[var(--radius-paper)] p-5 shadow-[var(--shadow-paper)] md:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <div className="flex items-center justify-between border-b-[1.5px] border-dashed border-paper-line pb-3">
              <span className="t-label text-paper-ink">{t("create.form.title")}</span>
              <span className="t-label text-paper-mute">{stamp}</span>
            </div>

            <div>
              <SlipLabel htmlFor="idea">{t("create.prompt.label")}</SlipLabel>
              <textarea
                id="idea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
                }}
                rows={3}
                placeholder={t("create.prompt.placeholder")}
                className="ruled typewriter mt-1 block w-full resize-none bg-transparent text-[1.0625rem] text-paper-ink outline-none [--rule:1.9rem] placeholder:text-paper-mute placeholder:opacity-100"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onEnhance}
                  disabled={enhancing || !ready}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-1 font-sans cond text-[0.8125rem] font-bold tracking-[0.05em] text-paper-ink uppercase transition-opacity hover:opacity-70 disabled:opacity-35"
                >
                  <WandSparkles aria-hidden className="h-4 w-4" />
                  {enhancing ? t("create.enhance.loading") : t("create.enhance")}
                </button>
                <button
                  type="button"
                  onClick={onMagic}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-1 font-sans cond text-[0.8125rem] font-bold tracking-[0.05em] text-paper-ink uppercase transition-opacity hover:opacity-70"
                >
                  <Dices aria-hidden className="h-4 w-4" />
                  {t("create.magic")}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <SlipLabel>{t("create.style.label")}</SlipLabel>
              <div className="flex flex-wrap gap-2">
                {selected.map((s) => (
                  <Chip
                    key={s.slug}
                    tone="paper"
                    selected
                    onClick={() => toggle(s.slug)}
                    aria-label={`${s.name} ✕`}
                  >
                    {s.name}
                    <X aria-hidden className="h-3.5 w-3.5" />
                  </Chip>
                ))}
                <Chip tone="paper" onClick={() => setSheetOpen(true)}>
                  <Plus aria-hidden className="h-3.5 w-3.5" />
                  {t("create.style.pick")}
                </Chip>
              </div>
              {selected.length === 0 && (
                <p className="typewriter text-[0.8125rem] text-paper-mute">
                  {t("create.style.empty")}
                </p>
              )}
            </div>

            <div className="grid gap-4 border-t-[1.5px] border-dashed border-paper-line pt-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <SlipLabel>{t("create.detail.label")}</SlipLabel>
                <Segmented
                  label={t("create.detail.label")}
                  value={complexity}
                  onChange={setComplexity}
                  options={[
                    { v: "simple", label: t("create.detail.minimal") },
                    { v: "medium", label: t("create.detail.balanced") },
                    { v: "detailed", label: t("create.detail.detailed") },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <SlipLabel>{t("create.lines.label")}</SlipLabel>
                {/* needle groupings — how a tattooer names line weight */}
                <Segmented
                  label={t("create.lines.label")}
                  value={lineWeight}
                  onChange={setLineWeight}
                  options={[
                    { v: "thin", label: t("create.lines.fine"), sub: "3RL" },
                    { v: "medium", label: t("create.lines.medium"), sub: "7RL" },
                    { v: "bold", label: t("create.lines.bold"), sub: "11RL" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <SlipLabel>{t("create.ink.label")}</SlipLabel>
                <Segmented
                  label={t("create.ink.label")}
                  value={color ? "color" : "bng"}
                  onChange={(v) => setColor(v === "color")}
                  options={[
                    { v: "bng", label: t("create.color.off") },
                    { v: "color", label: t("create.color.on") },
                  ]}
                />
              </div>
            </div>
          </form>

          <Paywall />

          <div className="flex flex-col items-center gap-3">
            <Button size="lg" className="w-full" onClick={onSubmit} disabled={!ready}>
              <Zap aria-hidden className="h-5 w-5" />
              {t("create.submit")}
            </Button>
            <QuotaMeter className="text-center" />
          </div>

          {gen.state === "error" && (
            <p
              role="alert"
              className="rounded-[var(--radius-panel)] bg-surface p-4 text-[0.9375rem] text-text shadow-[inset_0_0_0_1.5px_var(--color-neon)]"
            >
              {gen.error}{" "}
              <button
                type="button"
                onClick={gen.reset}
                className="font-bold text-neon-hi underline underline-offset-4"
              >
                {t("common.retry")}
              </button>
            </p>
          )}
        </div>

        {/* ── Desktop: the house flash wall ── */}
        <div className="hidden self-start md:sticky md:top-28 md:block md:pt-6">
          <HeroWall />
        </div>
      </div>

      <HowItWorks className="mt-24 md:mt-32" />

      <section className="mt-24 md:mt-32" aria-labelledby="fresh-title">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Label dot="neon">{t("explore.eyebrow")}</Label>
            <h2 id="fresh-title" className="heading text-[2rem] text-text md:text-5xl">
              {t("create.gallery.label")}
            </h2>
          </div>
          <Link
            to={lp("/explore")}
            className={cn(
              "hidden shrink-0 items-center gap-2 font-sans cond text-[0.875rem] font-bold tracking-[0.06em] text-text-2 uppercase transition-colors hover:text-text sm:inline-flex",
            )}
          >
            {t("create.fresh.all")} <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
        <FreshWall />
        <Link
          to={lp("/explore")}
          className="mt-8 flex items-center justify-center gap-2 font-sans cond text-[0.875rem] font-bold tracking-[0.06em] text-text-2 uppercase sm:hidden"
        >
          {t("create.fresh.all")} <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </section>

      {styleSheet}
    </>
  );
}
