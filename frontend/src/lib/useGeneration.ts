import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  ApiError,
  type CreateDesignBody,
  type Design,
  type QuotaError,
  createDesign,
  createVariants,
  getDesign,
  refineDesign,
} from "./api";
import { trackEvent } from "./analytics";
import { type Lang, translate } from "./i18n";
import { useLang } from "./useT";

/** Turn a thrown error into a user-facing message — 402 quota gets a friendly,
 *  localized line (guest vs monthly) instead of the raw "[object Object]". */
function genErrorMessage(e: unknown, lang: Lang): string {
  if (e instanceof ApiError && e.status === 402) {
    const d = e.detail as QuotaError | undefined;
    // Guest cap is lifetime (reset_at null); the free plan resets monthly.
    const key = d && d.reset_at ? "errors.quota.month" : "errors.quota.guest";
    return translate(key, lang);
  }
  return (e as Error).message;
}

/** Map a finished-but-failed design's typed error to a localized message. */
function designError(finished: Design, lang: Lang): string {
  if (finished.error === "moderation_blocked") return translate("errors.moderation", lang);
  return finished.error ?? translate("errors.generation.timeout", lang);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_MS = 2000;
const MAX_POLLS = 120; // ~4 min — gpt-image-2 can take 45-90s per design
/** Even when the mock finishes instantly, hold the ritual this long so the reveal feels earned. */
const MIN_CEREMONY_MS = 1800;

export type GenState = "idle" | "conjuring" | "done" | "error";

async function waitForDesign(d: Design): Promise<Design> {
  let cur = d;
  let tries = 0;
  while ((cur.status === "queued" || cur.status === "processing") && tries < MAX_POLLS) {
    await sleep(POLL_MS);
    cur = await getDesign(cur.id);
    tries++;
  }
  return cur;
}

export function useGeneration() {
  const qc = useQueryClient();
  const lang = useLang();
  const [state, setState] = useState<GenState>("idle");
  const [design, setDesign] = useState<Design | null>(null);
  const [variants, setVariants] = useState<Design[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (body: CreateDesignBody) => {
      setState("conjuring");
      setDesign(null);
      setVariants([]);
      setError(null);
      trackEvent("generate_start", { styles: body.styles?.length ?? 0, color: body.color });
      const t0 = performance.now();
      try {
        const finished = await waitForDesign(await createDesign(body));
        const elapsed = performance.now() - t0;
        if (elapsed < MIN_CEREMONY_MS) await sleep(MIN_CEREMONY_MS - elapsed);
        if (finished.status !== "done" || !finished.clean_png_url) {
          setError(designError(finished, lang));
          setState("error");
          return;
        }
        setDesign(finished);
        setState("done");
        trackEvent("generate_complete");
        qc.invalidateQueries({ queryKey: ["designs"] });
        qc.invalidateQueries({ queryKey: ["usage"] });
      } catch (e) {
        setError(genErrorMessage(e, lang));
        setState("error");
      }
    },
    [qc, lang],
  );

  const makeVariants = useCallback(async () => {
    if (!design || variantsLoading) return;
    setVariantsLoading(true);
    setError(null);
    try {
      const created = await createVariants(design.id, 2);
      const done = await Promise.all(created.map(waitForDesign));
      const ok = done.filter((d) => d.status === "done" && d.clean_png_url);
      if (ok.length === 0) {
        setError(translate("errors.generation.timeout", lang));
      } else {
        setVariants((prev) => [...prev, ...ok]);
      }
      qc.invalidateQueries({ queryKey: ["designs"] });
      qc.invalidateQueries({ queryKey: ["usage"] });
    } catch (e) {
      setError(genErrorMessage(e, lang));
    } finally {
      setVariantsLoading(false);
    }
  }, [design, variantsLoading, qc, lang]);

  /** Re-generate from the current design + a free-text adjustment. */
  const refine = useCallback(
    async (instruction: string) => {
      if (!design || refining || !instruction.trim()) return;
      setRefining(true);
      setError(null);
      try {
        const finished = await waitForDesign(await refineDesign(design.id, instruction.trim()));
        if (finished.status !== "done" || !finished.clean_png_url) {
          setError(designError(finished, lang));
          return;
        }
        // keep the previous design in the strip so nothing is lost
        setVariants((prev) => [design, ...prev.filter((v) => v.id !== design.id)]);
        setDesign(finished);
        qc.invalidateQueries({ queryKey: ["designs"] });
        qc.invalidateQueries({ queryKey: ["usage"] });
      } catch (e) {
        setError(genErrorMessage(e, lang));
      } finally {
        setRefining(false);
      }
    },
    [design, refining, qc, lang],
  );

  const choose = useCallback((d: Design) => setDesign(d), []);
  const reset = useCallback(() => {
    setState("idle");
    setDesign(null);
    setVariants([]);
    setVariantsLoading(false);
    setRefining(false);
    setError(null);
  }, []);

  return {
    state,
    design,
    variants,
    variantsLoading,
    refining,
    error,
    start,
    makeVariants,
    refine,
    choose,
    reset,
  };
}
