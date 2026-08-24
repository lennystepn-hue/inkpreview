import { Camera, RotateCcw, ScanFace, Video } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ChangeEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConjuringRitual } from "@/components/magic/ConjuringRitual";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Ornament";
import { type BodyPhoto, uploadBodyPhoto } from "@/lib/api";
import { useComposite } from "@/lib/useComposite";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { LiveCamera } from "./LiveCamera";
import { QrPanel } from "./QrPanel";
import { type Placement, usePlacementGestures } from "./usePlacementGestures";

export function StudioScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lp = useLangPath();
  const design = useDraft((s) => s.design);
  const setPreview = useDraft((s) => s.setPreview);
  const comp = useComposite();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState<BodyPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const onCameraCapture = async (file: File, placement: Placement) => {
    setCameraOn(false);
    setUploading(true);
    try {
      const bp = await uploadBodyPhoto(file);
      setBody(bp);
      setPos(placement.pos);
      setScale(placement.scale);
      setRotation(placement.rotation);
      comp.reset();
    } finally {
      setUploading(false);
    }
  };

  if (!design) {
    return (
      <div className="mx-auto flex min-h-[62dvh] max-w-md flex-col items-center justify-center text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-acid/20 blur-2xl" aria-hidden />
          <div className="relative grid h-20 w-20 place-items-center rounded-blob border border-acid/30 bg-white/5">
            <ScanFace className="h-9 w-9 text-acid/80" />
          </div>
        </div>
        <h2 className="mt-6 font-display text-2xl font-extrabold tracking-tight">
          {t("studio.empty.title")}
        </h2>
        <p className="mt-2 max-w-xs text-sm text-white/45">{t("studio.empty.body")}</p>
        <Button className="mt-7" size="lg" shine onClick={() => navigate(lp("/"))}>
          {t("studio.empty.cta")}
        </Button>
      </div>
    );
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const bp = await uploadBodyPhoto(file);
      setBody(bp);
      comp.reset();
    } finally {
      setUploading(false);
    }
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

  return (
    <>
      <AnimatePresence>
        {comp.state === "placing" && <ConjuringRitual label={t("studio.placing.label")} />}
      </AnimatePresence>

      <div className="mx-auto flex max-w-md flex-col gap-5">
        <header>
          <Eyebrow className="mb-3 max-w-[15rem]">{t("studio.eyebrow")}</Eyebrow>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            {t("studio.header.title")}
          </h1>
          <p className="mt-1 text-sm text-white/45">{t("studio.header.body")}</p>
        </header>

        {!body ? (
          <div className="md:grid md:grid-cols-2 md:gap-4">
            <div className="flex flex-col gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-blob border-2 border-dashed border-white/15 bg-white/[0.03] text-white/50 transition-colors hover:border-acid/50 hover:text-white md:aspect-auto md:min-h-[16rem]"
              >
                <Camera className="h-10 w-10" />
                <span className="font-display text-sm font-bold">
                  {uploading ? t("common.loading") : t("studio.upload.cta")}
                </span>
                <span className="text-xs text-white/30">{t("studio.upload.hint")}</span>
              </button>
              <button
                onClick={() => setCameraOn(true)}
                className="flex items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 font-display text-xs font-semibold text-white/70 transition-colors hover:border-acid/50 hover:text-white"
              >
                <Video className="h-4 w-4" /> {t("studio.camera.cta")}
              </button>
            </div>
            <QrPanel
              className="hidden md:block"
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
        ) : comp.state === "done" && comp.preview?.output_url ? (
          <div className="flex flex-col gap-4">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-center font-tattoo text-2xl text-acid drop-shadow-[0_0_18px_var(--color-acid)]"
            >
              {t("studio.done.banner")}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.88, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-blob border border-white/10 bg-ink-900 shadow-[var(--shadow-glow-cyan)]"
            >
              <img
                src={comp.preview.output_url}
                alt="Preview on your skin"
                className="block max-h-[56dvh] w-full object-contain"
              />
            </motion.div>
            <p className="text-center text-xs text-white/35">{t("studio.preview.disclaimer")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" shine onClick={onExport}>
                {t("studio.export")}
              </Button>
              <Button size="lg" variant="outline" onClick={comp.reset}>
                {t("studio.placeAgain")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <div
                {...gestures}
                className="relative mx-auto w-fit max-w-full cursor-grab touch-none overflow-hidden rounded-blob border border-white/10 bg-ink-900 select-none active:cursor-grabbing"
              >
                {/* The container shrink-wraps the photo so gesture/ghost percentages
                    map 1:1 onto the photo's pixels (no letterbox offset). */}
                <img
                  src={body.url}
                  alt="your photo"
                  draggable={false}
                  className="block max-h-[48dvh] w-auto max-w-full"
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
                    className="pointer-events-none absolute opacity-90 mix-blend-multiply"
                  />
                )}
                <span
                  style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                  className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-acid bg-acid/20 shadow-[0_0_14px] shadow-acid"
                />
              </div>
              <p className="mt-2 text-center text-xs text-white/35">{t("studio.tapHint")}</p>
            </div>

            {/* free size */}
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-xs text-white/45">
                <span className="tracking-wide uppercase">{t("studio.size")}</span>
                <span className="font-display text-acid">{Math.round(scale * 100)}%</span>
              </span>
              <input
                type="range"
                min={0.08}
                max={0.9}
                step={0.01}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="slider w-full"
              />
            </label>

            {/* free rotation */}
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-xs text-white/45">
                <span className="tracking-wide uppercase">{t("studio.rotation")}</span>
                <span className="flex items-center gap-2">
                  <span className="font-display text-acid">{rotation}°</span>
                  <button
                    type="button"
                    onClick={() => setRotation(0)}
                    className="text-white/40 hover:text-white"
                    aria-label="reset rotation"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </span>
              </span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="slider slider-cyan w-full"
              />
            </label>

            <Button size="lg" className="w-full" onClick={onPlace}>
              {t("studio.place")}
            </Button>
            <button
              onClick={() => {
                setBody(null);
                comp.reset();
              }}
              className="text-center text-xs text-white/40 hover:text-white/70"
            >
              {t("studio.differentPhoto")}
            </button>
          </>
        )}

        {comp.state === "error" && (
          <p className="rounded-2xl border border-magenta/40 bg-magenta/10 p-3 text-sm text-magenta">
            {comp.error}{" "}
            <button onClick={comp.reset} className="underline">
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
          onCapture={onCameraCapture}
          onClose={() => setCameraOn(false)}
        />
      )}
    </>
  );
}
