import { Share2, Sparkles, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { trackEvent } from "@/lib/analytics";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { useLightbox } from "@/store/useLightbox";

/** Full-screen enlarge view for a design, opened from explore/gallery/result.
 *  Offers share (the public /d/{id} link) and either "try on" (own design) or
 *  "create your own" (a community design). */
export function DesignLightbox() {
  const item = useLightbox((s) => s.item);
  const close = useLightbox((s) => s.close);
  const t = useT();
  const lp = useLangPath();
  const navigate = useNavigate();
  const setDraft = useDraft((s) => s.setDesign);
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const share = async () => {
    const url = `${window.location.origin}/d/${item.id}`;
    trackEvent("share_design");
    try {
      if (navigator.share) {
        await navigator.share({ title: "InkPreview", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* dismissed */
    }
  };

  const tryOn = () => {
    if (item.design) {
      setDraft(item.design);
      close();
      navigate(lp("/studio"));
    } else {
      close();
      navigate(lp("/"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex flex-col bg-ink-950/92 p-4 backdrop-blur"
      onClick={close}
    >
      <div className="flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          aria-label={t("common.cancel")}
          className="p-2 text-white/70"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.img
          key={item.src}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          src={item.src}
          alt={item.prompt ?? t("explore.alt")}
          className="max-h-[60dvh] w-auto max-w-full rounded-2xl bg-white object-contain p-3"
        />
        {item.prompt && (
          <p className="max-w-md text-center text-sm text-white/55">„{item.prompt}"</p>
        )}

        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            onClick={tryOn}
            className="flex items-center justify-center gap-2 rounded-full bg-acid py-3 font-display text-sm font-bold text-ink-950 transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            {item.design ? t("result.tryOn") : t("explore.cta")}
          </button>
          <button
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-full border border-white/15 py-3 text-xs font-semibold text-white/75 transition-colors hover:text-white"
          >
            <Share2 className="h-4 w-4" />
            {copied ? t("result.share.copied") : t("result.share")}
          </button>
        </div>
      </div>
    </div>
  );
}
