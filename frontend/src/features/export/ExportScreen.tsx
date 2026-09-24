import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, Download, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Dagger } from "@/components/brand/Dagger";
import { Button, buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { trackEvent } from "@/lib/analytics";
import { type Export, createExport, downloadAsset, saveMockup, shareAsset } from "@/lib/api";
import { googleLoginUrl } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { flashNo } from "@/lib/flash";
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
    <Button variant="outline" className="w-full" onClick={onSave} disabled={state !== "idle"}>
      {state === "saved" ? (
        <Check aria-hidden className="h-4 w-4 text-jade" />
      ) : (
        <Bookmark aria-hidden className="h-4 w-4" />
      )}
      {state === "saved" ? t("export.saveMockup.saved") : t("export.saveMockup")}
    </Button>
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
    <div className="rounded-[var(--radius-panel)] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-line)]">
      <p className="t-label flex items-center gap-2 text-gold">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
        {t("export.unlock.title")}
      </p>
      <p className="mt-2 text-[0.9375rem] text-text-2">{t("export.unlock.body")}</p>
      {billing?.enabled ? (
        loggedIn ? (
          <button
            type="button"
            onClick={openUpgrade}
            className={buttonClass("paper", "md", "mt-4 w-full")}
          >
            {t("billing.upgrade")}
          </button>
        ) : (
          <a href={googleLoginUrl(lang)} className={buttonClass("paper", "md", "mt-4 w-full")}>
            {t("export.unlock.signin")}
          </a>
        )
      ) : (
        <p className="mt-3 text-[0.8125rem] text-text-3">{t("export.watermark.notice")}</p>
      )}
    </div>
  );
}

/** One file on the ticket: preview, what it is, and its download. */
function TicketFile({
  title,
  meta,
  url,
  filename,
  kind,
  className,
}: {
  title: string;
  meta: string;
  url: string;
  filename: string;
  kind: "art" | "photo";
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-[3px]",
          kind === "photo" ? "bg-paper-ink" : "shadow-[inset_0_0_0_1px_var(--color-paper-line)]",
        )}
      >
        <img
          src={url}
          alt={title}
          className={cn(
            "mx-auto block w-full",
            kind === "art"
              ? "flash-art aspect-square object-contain p-[6%]"
              : "aspect-square object-cover",
          )}
        />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans cond text-[1rem] leading-tight font-extrabold tracking-[0.02em] text-paper-ink uppercase">
            {title}
          </p>
          <p className="t-label mt-1 text-[0.5625rem] text-paper-mute">{meta}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadAsset(url, filename)}
          className={buttonClass("ink", "sm", "shrink-0 px-3.5!")}
        >
          <Download aria-hidden className="h-4 w-4" />
          {t("common.download")}
        </button>
      </div>
    </div>
  );
}

export function ExportScreen() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const lp = useLangPath();
  const design = useDraft((s) => s.design);
  const preview = useDraft((s) => s.preview);
  const setDesign = useDraft((s) => s.setDesign);
  const [exp, setExp] = useState<Export | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
        .format(new Date())
        .toUpperCase(),
    [lang],
  );

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
  const no = flashNo(design.id);

  return (
    <div className="flex flex-col gap-9 md:gap-12">
      <PageHeader label={t("export.eyebrow")} title={t("export.title")}>
        {t("export.subtitle")}
      </PageHeader>

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-panel)] bg-surface p-4 text-[0.9375rem] text-text shadow-[inset_0_0_0_1.5px_var(--color-neon)]"
        >
          {error}
        </p>
      ) : (
        <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-12">
          {/* ── The artist ticket ── */}
          <article
            className="paper relative rounded-[var(--radius-paper)] shadow-[var(--shadow-paper)]"
            aria-label={t("export.ticket.title")}
          >
            <header className="flex flex-col gap-4 p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <Dagger className="h-6 w-auto text-paper-ink" />
                  <span className="font-sans cond text-[1.125rem] font-extrabold tracking-[0.04em] text-paper-ink uppercase">
                    {t("export.ticket.title")}
                  </span>
                </span>
                <span className="t-label text-paper-ink">{no}</span>
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t-[1.5px] border-dashed border-paper-line pt-4">
                <div>
                  <dt className="t-label text-[0.5625rem] text-paper-mute">
                    {t("export.ticket.date")}
                  </dt>
                  <dd className="typewriter mt-1 text-[0.9375rem] font-bold text-paper-ink">
                    {today}
                  </dd>
                </div>
                <div>
                  <dt className="t-label text-[0.5625rem] text-paper-mute">
                    {t("export.ticket.flash")}
                  </dt>
                  <dd className="typewriter mt-1 text-[0.9375rem] font-bold text-paper-ink">
                    {no}
                  </dd>
                </div>
              </dl>
              <p className="typewriter text-[0.9375rem] leading-snug text-paper-ink">
                “{design.prompt}”
              </p>
            </header>

            <div className="perforation" aria-hidden />

            <div className="p-5 md:p-6">
              <p className="t-label mb-4 text-paper-mute">{t("export.ticket.files")}</p>
              {!exp ? (
                <div className="flex flex-col gap-3">
                  <div className="aspect-square animate-pulse rounded-[3px] bg-paper-2" />
                  <p className="typewriter text-center text-[0.875rem] text-paper-mute">
                    {t("export.preparing")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-7">
                  {exp.hires_url && (
                    <TicketFile
                      kind="art"
                      title={t("export.asset.cleanDesign")}
                      meta={exp.watermarked ? t("export.asset.cleanMeta.free") : t("export.specs")}
                      url={exp.hires_url}
                      filename="inkpreview-design.png"
                    />
                  )}
                  {(exp.stencil_url || exp.mockup_url) && (
                    <div className="grid grid-cols-1 gap-7 border-t-[1.5px] border-dashed border-paper-line pt-6 sm:grid-cols-2 sm:gap-5">
                      {exp.stencil_url && (
                        <TicketFile
                          kind="art"
                          title={t("export.asset.stencil")}
                          meta={t("export.asset.stencilMeta")}
                          url={exp.stencil_url}
                          filename="inkpreview-stencil.png"
                        />
                      )}
                      {exp.mockup_url && (
                        <TicketFile
                          kind="photo"
                          title={t("export.asset.bodyMockup")}
                          meta={t("export.asset.mockupMeta")}
                          url={exp.mockup_url}
                          filename="inkpreview-mockup.png"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="perforation" aria-hidden />
            <p className="t-label px-5 pt-1 pb-5 text-center text-[0.5625rem] text-paper-mute md:px-6">
              {t("export.preview.disclaimer")}
            </p>
          </article>

          {/* ── Actions ── */}
          <div className="flex flex-col gap-4 md:sticky md:top-28">
            <Button
              size="lg"
              className="w-full"
              disabled={!exp}
              onClick={() =>
                exp && shareAsset(exp.mockup_url ?? exp.hires_url ?? "", t("export.shareText"))
              }
            >
              <Share2 aria-hidden className="h-5 w-5" /> {t("export.share")}
            </Button>
            {exp?.mockup_url && preview && <SaveMockupButton previewId={preview.id} />}
            {exp?.watermarked && <WatermarkUnlock />}
            <button
              type="button"
              onClick={() => {
                setDesign(null);
                navigate(lp("/"));
              }}
              className={buttonClass("quiet", "sm", "self-center")}
            >
              <RotateCcw aria-hidden className="h-4 w-4" />
              {t("export.newDesign")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
