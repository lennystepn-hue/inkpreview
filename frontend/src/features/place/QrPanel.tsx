import { Smartphone } from "lucide-react";
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
    })().catch(() => {});

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [designId]);

  return (
    <div className={className}>
      <div className="paper flex items-center gap-5 rounded-[var(--radius-paper)] p-5 shadow-[var(--shadow-paper)]">
        <div className="shrink-0 rounded-[4px] bg-white p-2.5 shadow-[inset_0_0_0_1px_var(--color-paper-line)]">
          {url ? (
            <QRCodeSVG value={url} size={124} fgColor="#1c1714" bgColor="#ffffff" />
          ) : (
            <div className="h-[124px] w-[124px] rounded-[2px] bg-paper-2" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex items-center gap-2 font-sans cond text-[1.125rem] font-extrabold tracking-[0.02em] text-paper-ink uppercase">
            <Smartphone aria-hidden className="h-5 w-5" />
            {t("qr.title")}
          </p>
          <p className="text-[0.875rem] leading-snug text-paper-mute">{t("qr.body")}</p>
          <p className="t-label mt-1 flex items-center gap-2 text-stencil-ink">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-stencil-ink motion-safe:animate-pulse"
            />
            {t("qr.waiting")}
          </p>
        </div>
      </div>
    </div>
  );
}
