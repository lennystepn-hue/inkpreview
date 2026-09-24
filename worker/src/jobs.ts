/**
 * Image jobs — generation and on-skin composite. Created by the API (202 +
 * polling, as before) and executed by the Queue consumer, one job per
 * invocation. ``JOB_MODE=inline`` runs them inside the request instead (tests).
 *
 * The clean design is canonical: stored once, never round-tripped through the
 * composite.
 */

import { type Settings, getSettings } from "./config";
import { dbStub } from "./context";
import { type ImageEngine, ModerationError, type Placement } from "./imaging/engine";
import { MockImageEngine } from "./imaging/mock";
import { OpenAIImageEngine } from "./imaging/openai";
import { cropAroundPlacement, makeThumbnail } from "./imaging/processing";
import { getMedia, putMedia } from "./storage";

export type Job = { kind: "generate"; id: string } | { kind: "composite"; id: string };

export function getEngine(settings: Settings): ImageEngine {
  return settings.imageEngine === "openai" ? new OpenAIImageEngine(settings) : new MockImageEngine();
}

const errorText = (err: unknown) => String((err as Error)?.message ?? err).slice(0, 500);

export async function runGeneration(env: Env, designId: string, engine = getEngine(getSettings(env))): Promise<void> {
  const db = dbStub(env);
  const design = await db.startDesignJob(designId);
  if (!design) return;
  try {
    const mods = design.modifiers ?? {};
    const [clean] = await engine.generateDesign({
      prompt: design.prompt,
      style_slugs: design.styles ?? [],
      color: Boolean(mods.color ?? true),
      line_weight: typeof mods.line_weight === "string" ? mods.line_weight : "medium",
      complexity: typeof mods.complexity === "string" ? mods.complexity : "medium",
      n: 1,
    });
    const url = await putMedia(env, `designs/${design.id}.png`, clean.png, "image/png");
    const thumb = await putMedia(env, `designs/${design.id}_thumb.png`, await makeThumbnail(clean.png), "image/png");
    await db.completeDesign(design.id, { clean_png_url: url, thumb_url: thumb, width: clean.width, height: clean.height });
  } catch (err) {
    // A typed moderation error maps to a clear client message; quota is refunded.
    if (!(err instanceof ModerationError)) console.error("generation failed", designId, err);
    await db.failDesign(design.id, err instanceof ModerationError ? "moderation_blocked" : errorText(err));
  }
}

export async function runComposite(env: Env, previewId: string, engine = getEngine(getSettings(env))): Promise<void> {
  const db = dbStub(env);
  const job = await db.startPreviewJob(previewId);
  if (!job) return;
  const { preview, design, body } = job;
  try {
    if (!design || !body) throw new Error("design or body photo missing");
    // The CANONICAL clean design is fetched untouched and composited onto the body.
    const designPng = await getMedia(env, `designs/${design.id}.png`);
    const bodyBytes = await getMedia(env, body.storage_ref);
    const placement: Placement = {
      x_pct: preview.x_pct,
      y_pct: preview.y_pct,
      scale: preview.scale,
      rotation: preview.rotation,
    };
    let result;
    try {
      result = await engine.compositeOnBody(bodyBytes, designPng, placement);
    } catch (err) {
      if (!(err instanceof ModerationError)) throw err;
      // Auto-crop-retry once: a tighter crop around the tapped spot often excludes
      // whatever the safety system flagged.
      const cropped = await cropAroundPlacement(bodyBytes, placement);
      result = await engine.compositeOnBody(cropped.image, designPng, cropped.placement);
    }
    const url = await putMedia(env, `ephemeral/preview/${preview.id}.png`, result.png, "image/png");
    await db.completePreview(preview.id, url);
  } catch (err) {
    if (!(err instanceof ModerationError)) console.error("composite failed", previewId, err);
    await db.failPreview(preview.id, err instanceof ModerationError ? "moderation_blocked" : errorText(err));
  }
}

export async function runJob(env: Env, job: Job): Promise<void> {
  if (job.kind === "generate") await runGeneration(env, job.id);
  else if (job.kind === "composite") await runComposite(env, job.id);
}

/** Dispatch a job: to the queue (prod) or inline (tests / JOB_MODE=inline). */
export async function enqueue(env: Env, job: Job): Promise<void> {
  if (env.JOB_MODE === "inline") {
    await runJob(env, job);
    return;
  }
  await env.JOBS.send(job);
}
