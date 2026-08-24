import { Camera, Check } from "lucide-react";
import { type ChangeEvent, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { uploadCapturePhoto } from "@/lib/api";
import { useT } from "@/lib/useT";

/** Standalone phone page reached by scanning the desktop QR (/scan/:token).
 *  No login needed — the token authorizes the upload. */
export function CaptureScreen() {
  const { token = "" } = useParams();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
            <div className="mx-auto mt-10 grid h-20 w-20 place-items-center rounded-blob bg-acid text-ink-950 shadow-[var(--shadow-glow-acid)]">
              <Check className="h-10 w-10" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight">
              {t("capture.done.title")}
            </h1>
            <p className="mt-2 text-sm text-white/55">{t("capture.done.body")}</p>
          </>
        ) : (
          <>
            <h1 className="mt-10 font-display text-3xl leading-tight font-extrabold tracking-tight">
              {t("capture.title")}
            </h1>
            <p className="mx-auto mt-2 max-w-xs text-sm text-white/55">{t("capture.body")}</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={state === "uploading"}
              className="mx-auto mt-8 flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-blob bg-acid text-ink-950 shadow-[var(--shadow-glow-acid)] disabled:opacity-50"
            >
              <Camera className="h-9 w-9" />
              <span className="text-[11px] font-bold">
                {state === "uploading" ? "…" : t("capture.camera")}
              </span>
            </button>
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
