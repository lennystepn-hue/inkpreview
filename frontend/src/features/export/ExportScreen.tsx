import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Download, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Ornament";
import { trackEvent } from "@/lib/analytics";
import { type Export, createExport, downloadAsset, saveMockup, shareAsset } from "@/lib/api";
import { googleLoginUrl } from "@/lib/auth";
import { useBillingConfig } from "@/lib/useBilling";
import { useSession } from "@/lib/useSession";
import { useLang, useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";
import { useUpgrade } from "@/store/useUpgrade";

/** Save the on-skin mockup to the account — logged-in only (opt-in). */
function SaveMockupButton({ previewId }: { previewId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  if (!session || session.is_anonymous) return null;

  const onSave = async () => {
    setState("saving");
    try {
      await saveMockup(previewId);
      setState("saved");
      qc.invalidateQueries({ queryKey: ["mockups"] });
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      onClick={onSave}
      disabled={state !== "idle"}
      className="flex w-full items-center justify-center gap-1.5 rounded-full border border-acid/30 bg-acid/5 py-2.5 text-xs font-semibold text-acid transition-colors hover:bg-acid/10 disabled:opacity-60"
    >
      <Bookmark className="h-3.5 w-3.5" />
      {state === "saved" ? t("export.saveMockup.saved") : t("export.saveMockup")}
    </button>
  );
}

/** Upgrade moment shown on a watermarked (free) export — convert to Pro for the clean file. */
function WatermarkUnlock() {
  const t = useT();
  const lang = useLang();
  const { data: session } = useSession();
  const { data: billing } = useBillingConfig();
  const openUpgrade = useUpgrade((s) => s.openUpgrade);
  const loggedIn = Boolean(session && !session.is_anonymous);

  return (
    <div className="rounded-blob border border-acid/50 p-4 text-center shadow-[var(--shadow-glow-acid)]">
      <p className="font-display text-sm font-bold text-acid">{t("export.unlock.title")}</p>
      <p className="mt-1 text-xs text-white/55">{t("export.unlock.body")}</p>
      {billing?.enabled ? (
        loggedIn ? (
          <button
            onClick={openUpgrade}
            className="mt-3 w-full rounded-full bg-acid py-2.5 font-display text-sm font-bold text-ink-950 transition-opacity hover:opacity-90"
          >
            {t("billing.upgrade")}
          </button>
        ) : (
          <a
            href={googleLoginUrl(lang)}
            className="mt-3 block w-full rounded-full bg-acid py-2.5 font-display text-sm font-bold text-ink-950 transition-opacity hover:opacity-90"
          >
            {t("export.unlock.signin")}
          </a>
        )
      ) : (
        <p className="mt-2 text-xs text-cyan">{t("export.watermark.notice")}</p>
      )}
    </div>
  );
}

function AssetCard({
  title,
  url,
  filename,
  light = false,
  badge,
}: {
  title: string;
  url: string;
  filename: string;
  light?: boolean;
  badge?: string;
}) {
  const t = useT();
  return (
    <div
      className={`relative overflow-hidden rounded-blob border border-white/10 ${light ? "bg-white" : "bg-ink-850"}`}
    >
      {badge && (
        <span className="absolute top-3 left-3 z-10 rounded-full bg-ink-950/85 px-2.5 py-1 font-display text-[9px] font-bold tracking-[0.2em] text-acid uppercase">
          ✦ {badge}
        </span>
      )}
      <img src={url} alt={title} className="mx-auto max-h-[34dvh] w-full object-contain p-3" />
      <div
        className={`flex items-center justify-between px-4 py-3 ${light ? "border-t border-ink-950/10 bg-ink-950" : "border-t border-white/5"}`}
      >
        <span className="font-display text-sm font-bold text-white">{title}</span>
        <button
          onClick={() => downloadAsset(url, filename)}
          className="flex items-center gap-1.5 rounded-full bg-acid px-3.5 py-1.5 text-xs font-bold text-ink-950"
        >
          <Download className="h-3.5 w-3.5" /> {t("common.download")}
        </button>
      </div>
    </div>
  );
}

export function ExportScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lp = useLangPath();
  const design = useDraft((s) => s.design);
  const preview = useDraft((s) => s.preview);
  const setDesign = useDraft((s) => s.setDesign);
  const [exp, setExp] = useState<Export | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!design) {
      navigate(lp("/"));
      return;
    }
    if (ran.current) return;
    ran.current = true;
    createExport({ design_id: design.id, preview_id: preview?.id ?? null })
      .then((e) => {
        setExp(e);
        trackEvent("export_created", { watermarked: e.watermarked });
      })
      .catch((e) => setError((e as Error).message));
  }, [design, preview, navigate, lp]);

  if (!design) return null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header>
        <Eyebrow className="mb-3 max-w-[15rem]">{t("export.eyebrow")}</Eyebrow>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{t("export.title")}</h1>
        <p className="mt-1 text-sm text-white/45">{t("export.subtitle")}</p>
      </header>

      {error ? (
        <p className="rounded-2xl border border-magenta/40 bg-magenta/10 p-3 text-sm text-magenta">
          {error}
        </p>
      ) : !exp ? (
        <div className="space-y-3">
          <div className="aspect-square animate-pulse rounded-blob bg-white/5" />
          <p className="text-center text-xs text-white/40">{t("export.preparing")}</p>
        </div>
      ) : (
        <>
          {exp.hires_url && (
            <div>
              <AssetCard
                title={t("export.asset.cleanDesign")}
                url={exp.hires_url}
                filename="inkpreview-design.png"
                badge={t("export.asset.badge")}
                light
              />
              {!exp.watermarked && (
                <p className="mt-1.5 text-center font-display text-[10px] tracking-[0.18em] text-white/35 uppercase">
                  {t("export.specs")}
                </p>
              )}
            </div>
          )}
          {exp.stencil_url && (
            <AssetCard
              title={t("export.asset.stencil")}
              url={exp.stencil_url}
              filename="inkpreview-stencil.png"
              badge={t("export.asset.stencilBadge")}
              light
            />
          )}
          {exp.mockup_url && (
            <AssetCard
              title={t("export.asset.bodyMockup")}
              url={exp.mockup_url}
              filename="inkpreview-mockup.png"
            />
          )}
          {exp.mockup_url && preview && <SaveMockupButton previewId={preview.id} />}

          <Button
            size="lg"
            className="w-full"
            onClick={() =>
              shareAsset(exp.mockup_url ?? exp.hires_url ?? "", t("export.shareText"))
            }
          >
            <Share2 className="h-4 w-4" /> {t("export.share")}
          </Button>

          {exp.watermarked && <WatermarkUnlock />}

          <p className="text-center text-xs text-white/35">{t("export.preview.disclaimer")}</p>

          <button
            onClick={() => {
              setDesign(null);
              navigate(lp("/"));
            }}
            className="text-center text-xs text-white/40 hover:text-white/70"
          >
            {t("export.newDesign")}
          </button>
        </>
      )}
    </div>
  );
}
