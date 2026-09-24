import { ArrowRight, Camera, Check, PenTool, RotateCcw, Video } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ChangeEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConjuringRitual } from "@/components/magic/ConjuringRitual";
import { Button, buttonClass } from "@/components/ui/Button";
import { FlashCard } from "@/components/ui/FlashCard";
import { NeonWord } from "@/components/ui/Neon";
import { PageHeader } from "@/components/ui/PageHeader";
import { type BodyPhoto, type Design, uploadBodyPhoto } from "@/lib/api";
import { cn } from "@/lib/cn";
import { flashNo } from "@/lib/flash";
import type { DictKey } from "@/lib/i18n";
import { useComposite } from "@/lib/useComposite";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { LiveCamera } from "./LiveCamera";
import { QrPanel } from "./QrPanel";
import { type Placement, usePlacementGestures } from "./usePlacementGestures";

const STEPS: DictKey[] = ["studio.step.photo", "studio.step.stencil", "studio.step.ink"];

/** The shop's order of work: photo → stencil → ink. */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const t = useT();
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Progress">
      {STEPS.map((key, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "now" : "next";
        return (
          <li
            key={key}
            className="flex items-center gap-2 sm:gap-3"
            aria-current={state === "now" ? "step" : undefined}
          >
            {i > 0 && <span aria-hidden className="h-px w-5 bg-line-strong sm:w-8" />}
            <span
              className={cn(
                "t-label flex items-center gap-2",
                state === "now" ? "text-text" : state === "done" ? "text-text-2" : "text-text-3",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full text-[0.625rem]",
                  state === "now" &&
                    "bg-stencil text-ground shadow-[0_0_12px_var(--color-stencil)]",
                  state === "done" && "bg-raised text-text-2",
                  state === "next" && "shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                )}
              >
                {state === "done" ? <Check className="h-3 w-3" /> : n}
              </span>
              {t(key)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The design being placed — a small reminder card. */
function DesignStrip({ design, src }: { design: Design; src: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-16 shrink-0">
        <FlashCard src={src} alt="" tilt={-2} pad="sm" />
      </div>
      <div className="min-w-0">
        <p className="t-label text-text-3">{flashNo(design.id)}</p>
        <p className="typewriter mt-1 line-clamp-2 text-[0.875rem] text-text-2">
          “{design.prompt}”
        </p>
      </div>
    </div>
  );
}

export function StudioScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lp = useLangPath();
  const reduce = useReducedMotion();
  const design = useDraft((s) => s.design);
  const setPreview = useDraft((s) => s.setPreview);
  const comp = useComposite();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState<BodyPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.4 });
  const [scale, setScale] = useState(0.3); // fraction of body width
  const [rotation, setRotation] = useState(0); // degrees
  const [cameraOn, setCameraOn] = useState(false);

  const gestures = usePlacementGestures(
    () => ({ pos, scale, rotation }),
    (patch) => {
      if (patch.pos) setPos(patch.pos);
      if (patch.scale !== undefined) setScale(patch.scale);
      if (patch.rotation !== undefined) setRotation(patch.rotation);
    },
  );

  const upload = async (file: File, placement?: Placement) => {
    setUploading(true);
    setUploadError(null);
    try {
      const bp = await uploadBodyPhoto(file);
      setBody(bp);
      if (placement) {
        setPos(placement.pos);
        setScale(placement.scale);
        setRotation(placement.rotation);
      }
      comp.reset();
    } catch (e) {
      setUploadError((e as Error).message || t("errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  if (!design) {
    return (
      <div className="mx-auto flex min-h-[58dvh] max-w-md flex-col items-center justify-center gap-6 text-center">
        <div className="relative w-36">
          <div className="flash-card aspect-[4/5] rotate-[-3deg] bg-[#f4f1fb]!">
            <span aria-hidden className="tape tape-t" />
            <img
              src="/ink/rose.png"
              alt=""
              className="stencil-ghost h-full w-full object-contain p-[18%]"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="heading text-[2.5rem] text-text">{t("studio.empty.title")}</h1>
          <p className="mx-auto max-w-[30ch] text-[0.9375rem] text-text-2">
            {t("studio.empty.body")}
          </p>
        </div>
        <Button size="lg" onClick={() => navigate(lp("/"))}>
          <PenTool aria-hidden className="h-5 w-5" />
          {t("studio.empty.cta")}
        </Button>
      </div>
    );
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void upload(file);
  };

  const onPlace = () => {
    if (body)
      comp.start({
        design_id: design.id,
        body_photo_id: body.id,
        x_pct: pos.x,
        y_pct: pos.y,
        scale,
        rotation,
      });
  };

  const onExport = () => {
    if (comp.preview) {
      setPreview(comp.preview);
      navigate(lp("/export"));
    }
  };

  const designGhost = design.thumb_url ?? design.clean_png_url ?? "";
  const done = comp.state === "done" && Boolean(comp.preview?.output_url);
  const step: 1 | 2 | 3 = !body ? 1 : done ? 3 : 2;

  return (
    <>
      <AnimatePresence>
        {comp.state === "placing" && (
          <ConjuringRitual
            mode="place"
            motif={designGhost}
            photo={body ? { url: body.url, pos, scale, rotation } : null}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-8 md:gap-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <PageHeader
            label={t("studio.eyebrow")}
            dot="stencil"
            title={t("studio.header.title")}
            className={step > 1 ? "[&>p]:max-md:hidden" : undefined}
          >
            {t("studio.header.body")}
          </PageHeader>
          <div className="md:pb-2">
            <Stepper step={step} />
          </div>
        </div>

        {!body ? (
          /* ── 01 · photo ── */
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-10">
            <div className="flex flex-col gap-4">
              <div className="md:hidden">
                <DesignStrip design={design} src={designGhost} />
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-[18px] bg-surface text-center transition-colors hover:bg-raised md:aspect-[5/4]"
              >
                {/* stencil registration corners */}
                {[
                  "top-4 left-4 border-t-2 border-l-2",
                  "top-4 right-4 border-t-2 border-r-2",
                  "bottom-4 left-4 border-b-2 border-l-2",
                  "right-4 bottom-4 border-r-2 border-b-2",
                ].map((c) => (
                  <span
                    key={c}
                    aria-hidden
                    className={cn("absolute h-7 w-7 rounded-[3px] border-stencil", c)}
                  />
                ))}
                <span className="grid h-16 w-16 place-items-center rounded-full bg-stencil/15 text-stencil transition-transform group-hover:scale-105">
                  <Camera aria-hidden className="h-8 w-8" />
                </span>
                <span className="heading text-[1.75rem] text-text">
                  {uploading ? t("common.loading") : t("studio.upload.cta")}
                </span>
                <span className="max-w-[26ch] text-[0.875rem] text-text-2">
                  {t("studio.upload.hint")}
                </span>
              </button>
              <div className="flex items-center gap-4 md:hidden">
                <span className="h-px flex-1 bg-line" />
                <span className="t-label text-text-3">{t("studio.upload.or")}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="outline" className="md:self-start" onClick={() => setCameraOn(true)}>
                <Video aria-hidden className="h-4 w-4" /> {t("studio.camera.cta")}
              </Button>
              {uploadError && (
                <p role="alert" className="text-[0.9375rem] text-neon-hi">
                  {uploadError}
                </p>
              )}
            </div>

            <div className="hidden flex-col gap-6 md:flex">
              <DesignStrip design={design} src={designGhost} />
              <QrPanel
                designId={design.id}
                onPhoto={(bp, placement) => {
                  comp.reset();
                  setBody(bp);
                  if (placement) {
                    // The phone already positioned it live → composite straight away.
                    setPos({ x: placement.x_pct, y: placement.y_pct });
                    setScale(placement.scale);
                    setRotation(placement.rotation);
                    comp.start({
                      design_id: design.id,
                      body_photo_id: bp.id,
                      x_pct: placement.x_pct,
                      y_pct: placement.y_pct,
                      scale: placement.scale,
                      rotation: placement.rotation,
                    });
                  }
                }}
              />
            </div>
          </div>
        ) : done && comp.preview?.output_url ? (
          /* ── 03 · ink ── */
          <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-12">
            <motion.figure
              initial={reduce ? false : { y: 16, rotate: -2 }}
              animate={{ y: 0, rotate: -0.6 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-fit max-w-full rounded-[6px] bg-paper p-2.5 pb-3 shadow-[var(--shadow-paper-lift)]"
            >
              <img
                src={comp.preview.output_url}
                alt={t("gallery.mockups.badge")}
                className="block max-h-[62dvh] w-auto max-w-full rounded-[3px]"
              />
              <figcaption className="t-label mt-2.5 px-1 text-paper-mute">
                {flashNo(design.id)} · {t("gallery.mockups.badge")}
              </figcaption>
            </motion.figure>

            <div className="flex flex-col gap-6 md:pt-6">
              <NeonWord className="text-[3.25rem] md:text-[4.25rem]">
                {t("studio.done.banner")}
              </NeonWord>
              <p className="text-[0.9375rem] text-text-2">{t("studio.preview.disclaimer")}</p>
              <div className="flex flex-col gap-3">
                <Button size="lg" className="w-full" onClick={onExport}>
                  {t("studio.export")} <ArrowRight aria-hidden className="h-5 w-5" />
                </Button>
                <Button variant="outline" className="w-full" onClick={comp.reset}>
                  <RotateCcw aria-hidden className="h-4 w-4" /> {t("studio.placeAgain")}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ── 02 · stencil ── */
          <div className="grid items-start gap-7 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-12">
            <div className="flex flex-col items-center gap-3">
              <div
                {...gestures}
                className="relative w-fit max-w-full cursor-grab touch-none overflow-hidden rounded-[14px] bg-surface shadow-[inset_0_0_0_1px_var(--color-line)] select-none active:cursor-grabbing"
              >
                {/* The container shrink-wraps the photo so gesture/ghost percentages
                    map 1:1 onto the photo's pixels (no letterbox offset). */}
                <img
                  src={body.url}
                  alt={t("studio.step.photo")}
                  draggable={false}
                  className="block max-h-[52dvh] w-auto max-w-full md:max-h-[62dvh]"
                />
                {designGhost && (
                  <img
                    src={designGhost}
                    alt=""
                    draggable={false}
                    style={{
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      width: `${scale * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    }}
                    className="stencil-ghost pointer-events-none absolute"
                  />
                )}
                {/* registration mark at the placement center */}
                <span
                  aria-hidden
                  style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                  className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white/85 shadow-[0_0_0_1px_rgb(0_0_0/0.25)] before:absolute before:top-1/2 before:left-1/2 before:h-[1.5px] before:w-3.5 before:-translate-1/2 before:bg-white/85 after:absolute after:top-1/2 after:left-1/2 after:h-3.5 after:w-[1.5px] after:-translate-1/2 after:bg-white/85"
                />
              </div>
              <p className="t-label text-center text-text-3">{t("studio.tapHint")}</p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="hidden md:block">
                <DesignStrip design={design} src={designGhost} />
              </div>

              <div className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <label className="flex flex-col gap-1">
                  <span className="flex items-center justify-between">
                    <span className="t-label text-text-2">{t("studio.size")}</span>
                    <span className="typewriter text-[0.9375rem] font-bold text-stencil tabular-nums">
                      {Math.round(scale * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0.08}
                    max={0.9}
                    step={0.01}
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="ruler"
                  />
                </label>

                <div className="flex flex-col gap-1">
                  <span className="flex items-center justify-between">
                    <label htmlFor="rotation" className="t-label text-text-2">
                      {t("studio.rotation")}
                    </label>
                    <span className="flex items-center gap-2">
                      <span className="typewriter text-[0.9375rem] font-bold text-stencil tabular-nums">
                        {rotation}°
                      </span>
                      <button
                        type="button"
                        onClick={() => setRotation(0)}
                        className="grid h-8 w-8 place-items-center rounded-full text-text-3 hover:bg-raised hover:text-text"
                        aria-label="0°"
                      >
                        <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </span>
                  <input
                    id="rotation"
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="ruler"
                  />
                </div>

                <p className="flex items-start gap-2 border-t border-line pt-4 text-[0.8125rem] text-text-2">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stencil"
                  />
                  {t("studio.stencil.note")}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button size="lg" className="w-full" onClick={onPlace}>
                  {t("studio.place")} <ArrowRight aria-hidden className="h-5 w-5" />
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setBody(null);
                    comp.reset();
                  }}
                  className={buttonClass("quiet", "sm", "self-center")}
                >
                  <RotateCcw aria-hidden className="h-4 w-4" /> {t("studio.differentPhoto")}
                </button>
              </div>
            </div>
          </div>
        )}

        {comp.state === "error" && (
          <p
            role="alert"
            className="rounded-[var(--radius-panel)] bg-surface p-4 text-[0.9375rem] text-text shadow-[inset_0_0_0_1.5px_var(--color-neon)]"
          >
            {comp.error}{" "}
            <button
              type="button"
              onClick={comp.reset}
              className="font-bold text-neon-hi underline underline-offset-4"
            >
              {t("common.retry")}
            </button>
          </p>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      {cameraOn && (
        <LiveCamera
          designGhost={designGhost}
          onCapture={(file, placement) => {
            setCameraOn(false);
            void upload(file, placement);
          }}
          onClose={() => setCameraOn(false)}
        />
      )}
    </>
  );
}
