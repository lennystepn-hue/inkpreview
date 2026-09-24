/**
 * Real image engine backed by OpenAI's Images API (GPT Image 2.5), called with
 * plain fetch (no SDK):
 * - generateDesign: images/generations on a clean solid-white background → the
 *   canonical artist file (black-on-white flash/stencil convention).
 * - compositeOnBody: images/edits with [placement guide, design, original photo].
 * - enhancePrompt: a chat model expands a terse idea into a rich tattoo prompt.
 */

import { type Settings } from "../config";
import {
  type EncodedImage,
  type GenSpec,
  type ImageEngine,
  ModerationError,
  type Placement,
} from "./engine";
import { isJpeg } from "./jpeg";
import { pngSize } from "./png";
import { overlayDesignGuide } from "./processing";
import { buildCompositePrompt, buildGenerationPrompt } from "./prompts";

const API = "https://api.openai.com/v1";
/** Image calls usually take 10-40 s; never hang forever. */
const IMAGE_TIMEOUT_MS = 5 * 60 * 1000;

const ENHANCE_SYSTEM =
  "You are a professional tattoo prompt engineer. Expand the user's idea into a single " +
  "rich, vivid tattoo-design prompt (one paragraph, no preamble, no quotes). Honor the given " +
  "styles. Focus on the motif, composition, and linework suitable for an image model. Do NOT " +
  "mention skin, body placement, mockups, or backgrounds.";

const WHITE_BG =
  " Render the design on a plain solid white background — no checkerboard, no transparency " +
  "pattern, no shadows, no border, no frame.";

export class OpenAIError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
  }
}

/** Did the provider reject this on safety/content-policy grounds? */
export function isModeration(err: unknown): boolean {
  const code = err instanceof OpenAIError ? (err.code ?? "") : "";
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  return (
    code === "moderation_blocked" ||
    code === "content_policy_violation" ||
    ["moderation", "safety system", "content policy", "content_policy"].some((k) => msg.includes(k))
  );
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class OpenAIImageEngine implements ImageEngine {
  constructor(
    private readonly settings: Settings,
    // Never store the bare global `fetch`: calling it as `this.fetcher(...)` throws
    // "Illegal invocation" in the Workers runtime.
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private async call(path: string, body: BodyInit, json: boolean, timeoutMs: number): Promise<any> {
    const key = this.settings.openaiApiKey;
    if (!key) throw new Error("OpenAI is not configured (OPENAI_API_KEY missing)");
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
    if (json) headers["Content-Type"] = "application/json";
    const res = await this.fetcher(`${API}${path}`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) {
      const err = data?.error ?? {};
      throw new OpenAIError(
        `OpenAI ${res.status}: ${err.message ?? text.slice(0, 300)}`,
        res.status,
        err.code ?? null,
      );
    }
    return data;
  }

  async generateDesign(spec: GenSpec): Promise<EncodedImage[]> {
    const s = this.settings;
    let resp: any;
    try {
      resp = await this.call(
        "/images/generations",
        JSON.stringify({
          model: s.openaiImageModel,
          prompt: buildGenerationPrompt(spec) + WHITE_BG,
          size: s.openaiImageSize,
          quality: s.openaiImageQuality,
          n: Math.max(1, spec.n),
          output_format: "png",
        }),
        true,
        IMAGE_TIMEOUT_MS,
      );
    } catch (err) {
      if (isModeration(err)) throw new ModerationError("Generation blocked by content moderation");
      throw err;
    }
    return (resp.data as { b64_json: string }[]).map((item) => {
      const png = b64decode(item.b64_json);
      const { width, height } = pngSize(png);
      return { png, width, height };
    });
  }

  async compositeOnBody(body: Uint8Array, design: Uint8Array, placement: Placement): Promise<EncodedImage> {
    // Pre-overlay the design at the tapped spot/size so the model knows WHERE and
    // HOW BIG (image 1 = geometry authority); the untouched original (image 3) is
    // the occlusion + lighting ground truth.
    const guide = await overlayDesignGuide(body, design, placement);
    const s = this.settings;
    const form = new FormData();
    form.append("model", s.openaiCompositeModel);
    form.append("prompt", buildCompositePrompt(placement));
    form.append("size", s.openaiImageSize);
    form.append("quality", s.openaiCompositeQuality);
    form.append("image[]", new File([guide], "placement.png", { type: "image/png" }));
    form.append("image[]", new File([design], "design.png", { type: "image/png" }));
    const original = isJpeg(body)
      ? new File([body], "original.jpg", { type: "image/jpeg" })
      : new File([body], "original.png", { type: "image/png" });
    form.append("image[]", original);
    let resp: any;
    try {
      resp = await this.call("/images/edits", form, false, IMAGE_TIMEOUT_MS);
    } catch (err) {
      if (isModeration(err)) throw new ModerationError("Composite blocked by content moderation");
      throw err;
    }
    const png = b64decode(resp.data[0].b64_json);
    const { width, height } = pngSize(png);
    return { png, width, height };
  }

  async enhancePrompt(prompt: string, styleSlugs: string[]): Promise<string> {
    const styles = styleSlugs.length ? styleSlugs.join(", ") : "any tattoo style";
    const resp = await this.call(
      "/chat/completions",
      JSON.stringify({
        model: this.settings.openaiTextModel,
        messages: [
          { role: "system", content: ENHANCE_SYSTEM },
          { role: "user", content: `Idea: ${prompt}\nStyles: ${styles}` },
        ],
        temperature: 0.8,
        max_tokens: 220,
      }),
      true,
      60_000,
    );
    return String(resp.choices?.[0]?.message?.content || prompt).trim();
  }
}
