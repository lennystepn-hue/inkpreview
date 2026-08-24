import { Camera, Check, Video } from "lucide-react";
import { motion } from "motion/react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

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

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("uploading");
    setError(null);
    try {
      await uploadCapturePhoto(token, file);
      setState("done");
    } catch (err) {
      setError((err as Error).message || t("errors.uploadFailed"));
      setState("error");
    }
  };

  const onLiveCapture = async (file: File, p: Placement) => {
    setCameraOn(false);
    setState("uploading");
    setError(null);
    try {
      await uploadCapturePhoto(token, file, {
        x_pct: p.pos.x,
        y_pct: p.pos.y,
        scale: p.scale,
        rotation: p.rotation,
      });
      setState("done");
    } catch (err) {
      setError((err as Error).message || t("errors.uploadFailed"));
      setState("error");
    }
  };

  if (cameraOn && designThumb) {
    return (
      <LiveCamera
        designGhost={designThumb}
        onCapture={onLiveCapture}
        onClose={() => setCameraOn(false)}
      />
    );
  }

  return (
    <div className="grain relative flex min-h-[100dvh] flex-col items-center justify-center bg-ink-950 px-6 text-center text-white">
      <div className="pointer-events-none fixed -top-24 left-1/4 h-72 w-72 rounded-full bg-acid/15 blur-[110px]" />
      <div className="pointer-events-none fixed right-1/4 bottom-0 h-72 w-72 rounded-full bg-magenta/15 blur-[110px]" />

      <div className="relative">
        <p className="font-display text-sm font-extrabold tracking-tight">
          INK<span className="text-acid">PREVIEW</span>
        </p>

        {state === "done" ? (
          <>
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="mx-auto mt-10 grid h-28 w-28 place-items-center rounded-blob bg-acid text-ink-950 shadow-[var(--shadow-glow-acid)]"
            >
              <Check className="h-14 w-14" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-6 font-display text-2xl font-extrabold tracking-tight"
            >
              {t("capture.done.title")}
            </motion.h1>
            <p className="mt-2 text-sm text-white/55">{t("capture.done.body")}</p>
            <p className="mt-5 font-tattoo text-xl text-white/30">✦ ✦ ✦</p>
          </>
        ) : (
          <>
            <h1 className="mt-10 font-display text-3xl leading-tight font-extrabold tracking-tight">
              {t("capture.title")}
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-sm text-white/55">{t("capture.body")}</p>

            <div className="mt-8 flex flex-col items-center gap-3">
              {designThumb && (
                <button
                  onClick={() => setCameraOn(true)}
                  disabled={state === "uploading"}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-blob bg-acid text-ink-950 shadow-[var(--shadow-glow-acid)] disabled:opacity-50"
                >
                  <Video className="h-9 w-9" />
                  <span className="text-[11px] font-bold">{t("capture.live")}</span>
                </button>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={state === "uploading"}
                className={
                  designThumb
                    ? "text-xs font-semibold text-white/55 underline"
                    : "flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-blob bg-acid text-ink-950 shadow-[var(--shadow-glow-acid)] disabled:opacity-50"
                }
              >
                {designThumb ? (
                  t("capture.uploadInstead")
                ) : (
                  <>
                    <Camera className="h-9 w-9" />
                    <span className="text-[11px] font-bold">
                      {state === "uploading" ? "…" : t("capture.camera")}
                    </span>
                  </>
                )}
              </button>
            </div>

            {state === "error" && (
              <p className="mt-5 text-sm text-magenta">
                {error} {t("capture.errorSuffix")}
              </p>
            )}
            <p className="mt-8 text-xs text-white/30">{t("capture.privacy")}</p>
          </>
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
    </div>
  );
}
