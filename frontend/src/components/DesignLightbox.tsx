import { PersonStanding, PenTool, Share2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { FlashCard } from "@/components/ui/FlashCard";
import { trackEvent } from "@/lib/analytics";
import { flashNo, styleName } from "@/lib/flash";
import { useStyles } from "@/lib/useStyles";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { useLightbox } from "@/store/useLightbox";

/** Full-screen view of one flash, opened from explore/gallery/result.
 *  Offers share (the public /d/{id} link) and either "try on" (own design) or
 *  "create your own" (a community design). */
export function DesignLightbox() {
  const item = useLightbox((s) => s.item);
  const close = useLightbox((s) => s.close);
  const t = useT();
  const lp = useLangPath();
  const navigate = useNavigate();
  const setDraft = useDraft((s) => s.setDesign);
  const { data: styles = [] } = useStyles();
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!item) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, close]);

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

  const caption = styleName(item.design?.styles, styles);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.prompt ?? t("explore.alt")}
      className="fixed inset-0 z-[75] flex flex-col overflow-y-auto bg-ground px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onClick={close}
    >
      <div className="flex shrink-0 justify-end">
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label={t("common.cancel")}
          className="grid h-11 w-11 place-items-center rounded-full text-text-2 hover:bg-raised hover:text-text"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          key={item.src}
          initial={reduce ? false : { opacity: 0, scale: 0.97, rotate: -1.5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[min(100%,60dvh)]"
        >
          <FlashCard
            src={item.src}
            alt={item.prompt ?? t("explore.alt")}
            no={flashNo(item.id)}
            caption={caption}
            tape="lr"
            pad="md"
            loading="eager"
          />
        </motion.div>

        {item.prompt && (
          <p className="typewriter max-w-[40ch] text-center text-[0.9375rem] leading-relaxed text-text-2">
            “{item.prompt}”
          </p>
        )}

        <div className="flex w-full max-w-xs flex-col gap-2.5">
          <Button size="lg" onClick={tryOn}>
            {item.design ? <PersonStanding className="h-5 w-5" /> : <PenTool className="h-5 w-5" />}
            {item.design ? t("result.tryOn") : t("explore.cta")}
          </Button>
          <Button variant="outline" size="md" onClick={share}>
            <Share2 className="h-4 w-4" />
            {copied ? t("result.share.copied") : t("result.share")}
          </Button>
        </div>
      </div>
    </div>
  );
}
