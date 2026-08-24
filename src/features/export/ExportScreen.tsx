import { Download, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { type Export, createExport, downloadAsset, shareAsset } from "@/lib/api";
import { useLangPath, useT } from "@/lib/useT";
import { useDraft } from "@/store/useDraft";

function AssetCard({
  title,
  url,
  filename,
  light = false,
}: {
  title: string;
  url: string;
  filename: string;
  light?: boolean;
}) {
  const t = useT();
  return (
    <div className="rounded-blob border border-white/10 bg-ink-900 p-3">
      <div className={`overflow-hidden rounded-2xl ${light ? "bg-white" : "bg-ink-850"}`}>
        <img src={url} alt={title} className="mx-auto max-h-[34dvh] w-full object-contain p-3" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-sm font-bold">{title}</span>
        <button
          onClick={() => downloadAsset(url, filename)}
          className="flex items-center gap-1.5 rounded-full bg-acid/15 px-3 py-1.5 text-xs font-semibold text-acid"
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
      .then(setExp)
      .catch((e) => setError((e as Error).message));
  }, [design, preview, navigate, lp]);

  if (!design) return null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header>
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
            <AssetCard
              title={t("export.asset.cleanDesign")}
              url={exp.hires_url}
              filename="inkpreview-design.png"
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

          <Button
            size="lg"
            className="w-full"
            onClick={() =>
              shareAsset(exp.mockup_url ?? exp.hires_url ?? "", t("export.shareText"))
            }
          >
            <Share2 className="h-4 w-4" /> {t("export.share")}
          </Button>

          {exp.watermarked && (
            <p className="rounded-2xl border border-cyan/30 bg-cyan/5 p-3 text-xs text-cyan">
              {t("export.watermark.notice")}
            </p>
          )}

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
