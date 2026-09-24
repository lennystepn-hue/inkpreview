import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/useT";
import { type Placement, usePlacementGestures } from "./usePlacementGestures";

type Props = {
  designGhost: string;
  onCapture: (file: File, placement: Placement) => void;
  onClose: () => void;
};

/** Live-camera AR-lite: position the stencil on the live feed, then snap a frame.
 *  The captured photo is the CLEAN camera frame (no baked-in ghost) — the design
 *  is composited server-side using the placement chosen here. */
export function LiveCamera({ designGhost, onCapture, onClose }: Props) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState(false);
  const [p, setP] = useState<Placement>({ pos: { x: 0.5, y: 0.5 }, scale: 0.3, rotation: 0 });

  const gestures = usePlacementGestures(
    () => p,
    (patch) => setP((cur) => ({ ...cur, ...patch })),
  );

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError(true));
    if (!navigator.mediaDevices) setError(true);
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // WYSIWYG: the on-screen preview is object-cover (cropped). Capture EXACTLY
    // the visible region — otherwise the photo shows more than the screen did
    // and the placement (percent of the screen view) lands too large.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = video.clientWidth;
    const ch = video.clientHeight;
    const cover = Math.max(cw / vw, ch / vh);
    const sw = Math.min(vw, Math.round(cw / cover));
    const sh = Math.min(vh, Math.round(ch / cover));
    const sx = Math.round((vw - sw) / 2);
    const sy = Math.round((vh - sh) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob((blob) => {
      if (!blob) return;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      onCapture(new File([blob], "capture.png", { type: "image/png" }), p);
    }, "image/png");
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex flex-col bg-ground">
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.cancel")}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-ground/70 text-text backdrop-blur"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative flex-1 overflow-hidden" {...gestures}>
        {error ? (
          <div className="grid h-full place-items-center px-8 text-center text-[0.9375rem] text-text-2">
            {t("studio.camera.error")}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {designGhost && (
              <img
                src={designGhost}
                alt=""
                draggable={false}
                style={{
                  left: `${p.pos.x * 100}%`,
                  top: `${p.pos.y * 100}%`,
                  width: `${p.scale * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
                }}
                className="stencil-ghost pointer-events-none absolute"
              />
            )}
          </>
        )}
      </div>

      {!error && (
        <div className="flex flex-col items-center gap-3 bg-ground px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="t-label text-text-2">{t("studio.camera.hint")}</p>
          <button
            type="button"
            onClick={capture}
            aria-label={t("studio.camera.capture")}
            className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-neon text-neon-ink shadow-[0_0_0_4px_var(--color-ground),0_0_0_6px_var(--color-paper),var(--shadow-neon)] transition-transform active:scale-95"
          >
            <Camera className="h-7 w-7" />
          </button>
        </div>
      )}
    </div>
  );
}
