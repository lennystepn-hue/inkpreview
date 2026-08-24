import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  type CreateDesignBody,
  type Design,
  createDesign,
  createVariants,
  getDesign,
  refineDesign,
} from "./api";
import { translate } from "./i18n";
import { useLang } from "./useT";

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
      const t0 = performance.now();
      try {
        const finished = await waitForDesign(await createDesign(body));
        const elapsed = performance.now() - t0;
        if (elapsed < MIN_CEREMONY_MS) await sleep(MIN_CEREMONY_MS - elapsed);
        if (finished.status !== "done" || !finished.clean_png_url) {
          setError(finished.error ?? translate("errors.generation.timeout", lang));
          setState("error");
          return;
        }
        setDesign(finished);
        setState("done");
        qc.invalidateQueries({ queryKey: ["designs"] });
      } catch (e) {
        setError((e as Error).message);
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
    } catch (e) {
      setError((e as Error).message);
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
          setError(finished.error ?? translate("errors.generation.timeout", lang));
          return;
        }
        // keep the previous design in the strip so nothing is lost
        setVariants((prev) => [design, ...prev.filter((v) => v.id !== design.id)]);
        setDesign(finished);
        qc.invalidateQueries({ queryKey: ["designs"] });
      } catch (e) {
        setError((e as Error).message);
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
