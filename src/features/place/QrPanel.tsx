import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import { type BodyPhoto, createCapture, getCapture } from "@/lib/api";
import { useT } from "@/lib/useT";

/** Desktop affordance: shows a QR to {origin}/scan/{token}; when the phone
 *  uploads a photo, calls onPhoto with the resulting body photo. */
export function QrPanel({
  onPhoto,
  className,
}: {
  onPhoto: (bp: BodyPhoto) => void;
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
      const { token } = await createCapture();
      if (stopped) return;
      setUrl(`${window.location.origin}/scan/${token}`);

      const poll = async () => {
        if (stopped) return;
        try {
          const st = await getCapture(token);
          if (st.status === "uploaded" && st.body_photo_id && st.url) {
            cb.current({ id: st.body_photo_id, url: st.url, expires_at: "" });
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
  }, []);

  return (
    <div className={className}>
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-blob border border-white/10 bg-white/[0.02] p-6 text-center">
        <div className="rounded-2xl bg-white p-3">
          {url ? (
            <QRCodeSVG value={url} size={132} />
          ) : (
            <div className="h-[132px] w-[132px] animate-pulse rounded bg-white/10" />
          )}
        </div>
        <p className="font-display text-sm font-bold">{t("qr.title")}</p>
        <p className="max-w-[16rem] text-xs text-white/45">{t("qr.body")}</p>
      </div>
    </div>
  );
}
