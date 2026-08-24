import { useCallback, useState } from "react";

import { type CreatePreviewBody, type Preview, createPreview, getPreview } from "./api";
import { translate } from "./i18n";
import { useLang } from "./useT";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POLL_MS = 2000;
const MAX_POLLS = 120; // ~4 min — the gpt-image-2 edit composite can take 60-90s
const MIN_CEREMONY_MS = 2000;

async function waitForPreview(p: Preview): Promise<Preview> {
  let cur = p;
  let tries = 0;
  while ((cur.status === "queued" || cur.status === "processing") && tries < MAX_POLLS) {
    await sleep(POLL_MS);
    cur = await getPreview(cur.id);
    tries++;
  }
  return cur;
}

export type CompState = "idle" | "placing" | "done" | "error";

export function useComposite() {
  const lang = useLang();
  const [state, setState] = useState<CompState>("idle");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (body: CreatePreviewBody) => {
    setState("placing");
    setPreview(null);
    setError(null);
    const t0 = performance.now();
    try {
      const finished = await waitForPreview(await createPreview(body));
      const elapsed = performance.now() - t0;
      if (elapsed < MIN_CEREMONY_MS) await sleep(MIN_CEREMONY_MS - elapsed);
      if (finished.status !== "done" || !finished.output_url) {
        setError(finished.error ?? translate("errors.composite.timeout", lang));
        setState("error");
        return;
      }
      setPreview(finished);
      setState("done");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
    },
    [lang],
  );

  const reset = useCallback(() => {
    setState("idle");
    setPreview(null);
    setError(null);
  }, []);

  return { state, preview, error, start, reset };
}
