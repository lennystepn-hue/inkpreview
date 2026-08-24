import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import { type BodyPhoto, type Placement4, createCapture, getCapture } from "@/lib/api";
import { useT } from "@/lib/useT";

/** Desktop affordance: shows a QR to {origin}/scan/{token}; when the phone
 *  uploads a photo, calls onPhoto with the body photo (and the live placement,
 *  if the phone used the live-camera flow, so the desktop can auto-composite). */
export function QrPanel({
  onPhoto,
  designId,
  className,
}: {
  onPhoto: (bp: BodyPhoto, placement?: Placement4) => void;
  designId?: string;
  className?: string;
}) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const cb = useRef(onPhoto);
  cb.current = onPhoto;

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    (async () => {
      const { token } = await createCapture(designId);
      if (stopped) return;
      setUrl(`${window.location.origin}/scan/${token}`);

      const poll = async () => {
        if (stopped) return;
        try {
          const st = await getCapture(token);
          if (st.status === "uploaded" && st.body_photo_id && st.url) {
            const placement =
              st.x_pct != null && st.y_pct != null && st.scale != null && st.rotation != null
                ? { x_pct: st.x_pct, y_pct: st.y_pct, scale: st.scale, rotation: st.rotation }
                : undefined;
            cb.current({ id: st.body_photo_id, url: st.url, expires_at: "" }, placement);
            return;
          }
        } catch {
          /* keep polling */
        }
        timer = window.setTimeout(poll, 2500);
      };
      timer = window.setTimeout(poll, 2500);
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [designId]);

  return (
    <div className={className}>
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-blob border border-white/10 bg-white/[0.02] p-6 text-center">
        <div className="rounded-2xl border border-acid/30 bg-white p-3 shadow-[var(--shadow-glow-acid)]">
          {url ? (
            <QRCodeSVG value={url} size={132} />
          ) : (
            <div className="h-[132px] w-[132px] animate-pulse rounded bg-white/10" />
          )}
        </div>
        <p className="font-display text-sm font-bold">{t("qr.title")}</p>
        <p className="max-w-[16rem] text-xs text-white/45">{t("qr.body")}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-acid/70">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-acid" />
          {t("qr.waiting")}
        </p>
      </div>
    </div>
  );
}
