import { Camera, Check, Upload, Video } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { Wordmark } from "@/components/brand/Wordmark";
import { StencilDefs } from "@/components/StencilDefs";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { getCaptureInfo, uploadCapturePhoto } from "@/lib/api";
import { useT } from "@/lib/useT";
import { LiveCamera } from "./LiveCamera";
import type { Placement } from "./usePlacementGestures";

/** Standalone phone page reached by scanning the desktop QR (/scan/:token).
 *  No login needed — the token authorizes the upload. If the desktop bound a
 *  design to the session, the phone can position it on the LIVE camera and the
 *  placement flows back so the desktop composites automatically. */
export function CaptureScreen() {
  const { token = "" } = useParams();
  const t = useT();
  const reduce = useReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [designThumb, setDesignThumb] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCaptureInfo(token)
      .then((info) => {
        if (!cancelled) setDesignThumb(info.design_thumb_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const send = async (file: File, p?: Placement) => {
    setState("uploading");
    setError(null);
    try {
      await uploadCapturePhoto(
        token,
        file,
        p ? { x_pct: p.pos.x, y_pct: p.pos.y, scale: p.scale, rotation: p.rotation } : undefined,
      );
      setState("done");
    } catch (err) {
      setError((err as Error).message || t("errors.uploadFailed"));
      setState("error");
    }
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void send(file);
  };

  if (cameraOn && designThumb) {
    return (
      <>
        <StencilDefs />
        <LiveCamera
          designGhost={designThumb}
          onCapture={(file, p) => {
            setCameraOn(false);
            void send(file, p);
          }}
          onClose={() => setCameraOn(false)}
        />
      </>
    );
  }

  const busy = state === "uploading";

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-text">
      <StencilDefs />
      <header className="flex justify-center text-[0.9375rem]">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 text-center">
        {state === "done" ? (
          <>
            <motion.div
              initial={reduce ? false : { scale: 0.6, rotate: -12 }}
              animate={{ scale: 1, rotate: -3 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="paper grid h-32 w-32 place-items-center rounded-[var(--radius-paper)] shadow-[var(--shadow-paper)]"
            >
              <Check aria-hidden className="h-14 w-14 text-stencil-ink" strokeWidth={2.5} />
            </motion.div>
            <div className="flex flex-col gap-3">
              <h1 className="heading text-[2.75rem] text-text">{t("capture.done.title")}</h1>
              <p className="text-[0.9375rem] text-text-2">{t("capture.done.body")}</p>
            </div>
          </>
        ) : (
          <>
            {designThumb && (
              <div className="w-32">
                <div className="flash-card aspect-square rotate-[-3deg] bg-[#f4f1fb]!">
                  <span aria-hidden className="tape tape-t" />
                  <img
                    src={designThumb}
                    alt=""
                    className="stencil-ghost h-full w-full object-contain p-[12%]"
                  />
                </div>
              </div>
            )}
            <div className="flex flex-col items-center gap-3">
              <Label dot="stencil">{t("studio.eyebrow")}</Label>
              <h1 className="heading text-[2.75rem] text-text">{t("capture.title")}</h1>
              <p className="text-[0.9375rem] text-text-2">{t("capture.body")}</p>
            </div>

            <div className="flex w-full flex-col gap-3">
              {designThumb ? (
                <>
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={busy}
                    onClick={() => setCameraOn(true)}
                  >
                    <Video aria-hidden className="h-5 w-5" />
                    {t("capture.live")}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload aria-hidden className="h-4 w-4" />
                    {busy ? t("common.loading") : t("capture.uploadInstead")}
                  </Button>
                </>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera aria-hidden className="h-5 w-5" />
                  {busy ? t("common.loading") : t("capture.camera")}
                </Button>
              )}
            </div>

            {state === "error" && (
              <p role="alert" className="text-[0.9375rem] text-neon-hi">
                {error} {t("capture.errorSuffix")}
              </p>
            )}
          </>
        )}
      </main>

      <p className="t-label text-center text-text-3">{t("capture.privacy")}</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
