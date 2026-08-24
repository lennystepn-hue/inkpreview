import { getToken, setToken } from "./session";

const BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Raw `detail` from the error body — an object for structured errors (e.g. 402 quota). */
    public detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 402 body shape from the quota meter (see backend designs.py `_quota_402`). */
export type QuotaError = {
  error: "quota_exceeded";
  plan: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  reset_at: string | null;
};

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (opts.body && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = res.statusText;
    let detail: unknown;
    try {
      const j = await res.json();
      detail = j.detail;
      if (typeof j.detail === "string") msg = j.detail;
      else if (j.detail && typeof j.detail === "object" && "error" in j.detail)
        msg = String((j.detail as { error: unknown }).error);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ───────────────────────── Session ─────────────────────────
export type Session = {
  token: string;
  user_id: string;
  credits: number;
  plan: string;
  is_anonymous: boolean;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  brand_name?: string | null;
};

/** Set the studio brand stamped on exports (Studio plan only). */
export const setBrand = (brand_name: string) =>
  api.post<Session>("/account/brand", { brand_name });

/** Idempotent: an existing token returns the same session; otherwise a new anon user. */
export async function ensureSession(): Promise<Session> {
  const s = await api.post<Session>("/session");
  setToken(s.token);
  return s;
}

// ───────────────────────── Quota / billing ─────────────────────────
export type Usage = {
  plan: string;
  period: "lifetime" | "month";
  limit: number | null;
  used: number;
  remaining: number | null;
  reset_at: string | null;
  promo?: boolean; // launch promo: everyone unlimited for a limited time
};

export const fetchUsage = () => api.get<Usage>("/usage");

export type BillingConfig = { enabled: boolean; publishable_key: string | null };

export const fetchBillingConfig = () => api.get<BillingConfig>("/billing/config");
/** Create a Stripe Checkout session and return its hosted URL to redirect to.
 *  `waiveWithdrawal` records the consumer's consent to immediate performance. */
export const startCheckout = (waiveWithdrawal: boolean) =>
  api.post<{ url: string }>("/billing/checkout", { waive_withdrawal: waiveWithdrawal });
/** Create a Customer Portal session (manage/cancel) and return its URL. */
export const openBillingPortal = () => api.post<{ url: string }>("/billing/portal");

// ───────────────────────── Account (GDPR) ─────────────────────────
/** Download a JSON copy of all the user's data (Art. 20). */
export async function exportAccountData(): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}/api/account/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, "export failed");
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = obj;
  a.download = "inkpreview-data.json";
  a.click();
  URL.revokeObjectURL(obj);
}

/** Permanently erase the account and all data (Art. 17). */
export const deleteAccount = () => api.post<void>("/account/delete");

// ───────────────────────── Styles ─────────────────────────
export type Style = {
  slug: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  default_modifiers: { color: boolean; line_weight: string; complexity: string };
};

export const fetchStyles = () => api.get<Style[]>("/styles");

// ───────────────────────── Designs ─────────────────────────
export type DesignStatus = "queued" | "processing" | "done" | "failed";

export type Design = {
  id: string;
  status: DesignStatus;
  prompt: string;
  styles: string[];
  clean_png_url: string | null;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  parent_design_id: string | null;
  error: string | null;
  created_at: string;
};

export type CreateDesignBody = {
  prompt: string;
  styles: string[];
  color?: boolean;
  line_weight?: string;
  complexity?: string;
};

export type FeedItem = { id: string; thumb_url: string | null; clean_png_url: string | null };
export const fetchFeed = (limit = 24) => api.get<FeedItem[]>(`/feed?limit=${limit}`);

export const createDesign = (body: CreateDesignBody) => api.post<Design>("/designs", body);
export const getDesign = (id: string) => api.get<Design>(`/designs/${id}`);
export const listDesigns = () => api.get<Design[]>("/designs");
export const createVariants = (id: string, count = 2) =>
  api.post<Design[]>(`/designs/${id}/variants?count=${count}`);
export const refineDesign = (id: string, prompt: string) =>
  api.post<Design>(`/designs/${id}/refine`, { prompt });
export const enhancePrompt = (prompt: string, styles: string[]) =>
  api.post<{ enhanced: string }>("/prompt/enhance", { prompt, styles });

/** Absolute URL for a stored media path returned by the API. */
export function mediaUrl(url: string | null): string | undefined {
  return url ?? undefined;
}

// ───────────────────────── Body photos + previews ─────────────────────────
export type BodyPhoto = { id: string; url: string; expires_at: string };

export type Preview = {
  id: string;
  status: DesignStatus;
  design_id: string;
  body_photo_id: string;
  x_pct: number;
  y_pct: number;
  scale: number;
  rotation: number;
  output_url: string | null;
  error: string | null;
  expires_at: string;
  created_at: string;
};

export type CreatePreviewBody = {
  design_id: string;
  body_photo_id: string;
  x_pct: number;
  y_pct: number;
  scale: number;
  rotation: number;
};

export async function uploadBodyPhoto(file: File): Promise<BodyPhoto> {
  const fd = new FormData();
  fd.append("file", file);
  return api.post<BodyPhoto>("/body-photos", fd);
}

export const createPreview = (body: CreatePreviewBody) => api.post<Preview>("/previews", body);
export const getPreview = (id: string) => api.get<Preview>(`/previews/${id}`);

// ───────────────────────── Capture handoff (desktop → phone) ─────────────────────────
export type Placement4 = { x_pct: number; y_pct: number; scale: number; rotation: number };
export type CaptureStatus = {
  status: string;
  body_photo_id: string | null;
  url: string | null;
} & Partial<Placement4>;
export type CaptureInfo = { status: string; design_thumb_url: string | null };

/** Desktop creates a session; pass the chosen design so the phone can overlay it live. */
export const createCapture = (designId?: string) =>
  api.post<{ token: string }>("/captures", designId ? { design_id: designId } : undefined);
export const getCapture = (token: string) => api.get<CaptureStatus>(`/captures/${token}`);
/** Public (token-authorized): what the phone should overlay on its live camera. */
export const getCaptureInfo = (token: string) =>
  api.get<CaptureInfo>(`/captures/${token}/info`);

export async function uploadCapturePhoto(
  token: string,
  file: File,
  placement?: Placement4,
): Promise<void> {
  const fd = new FormData();
  fd.append("file", file);
  if (placement) {
    fd.append("x_pct", String(placement.x_pct));
    fd.append("y_pct", String(placement.y_pct));
    fd.append("scale", String(placement.scale));
    fd.append("rotation", String(placement.rotation));
  }
  await api.post(`/captures/${token}/photo`, fd);
}

// ───────────────────────── Exports ─────────────────────────
export type Export = {
  id: string;
  hires_url: string | null;
  mockup_url: string | null;
  stencil_url: string | null;
  watermarked: boolean;
  created_at: string;
};

export const createExport = (body: { design_id: string; preview_id?: string | null }) =>
  api.post<Export>("/exports", body);
export const getExport = (id: string) => api.get<Export>(`/exports/${id}`);

// ───────────────────────── Saved mockups ─────────────────────────
export type Mockup = {
  id: string;
  design_id: string | null;
  output_url: string;
  created_at: string;
};

/** Persist an on-skin mockup to the account (logged-in only). */
export const saveMockup = (preview_id: string) => api.post<Mockup>("/mockups", { preview_id });
export const listMockups = () => api.get<Mockup[]>("/mockups");
export const deleteMockup = (id: string) => api.del<void>(`/mockups/${id}`);

/** Fetch a stored asset same-origin (via dev proxy / same-host prod) and download it. */
export async function downloadAsset(url: string, filename: string): Promise<void> {
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const res = await fetch(path);
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = obj;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(obj);
}

/** Try the native share sheet with the mockup image; resolves to false if unsupported. */
export async function shareAsset(url: string, text: string): Promise<boolean> {
  try {
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const res = await fetch(path);
    const blob = await res.blob();
    const file = new File([blob], "inkpreview.png", { type: blob.type || "image/png" });
    const nav = navigator as Navigator & {
      canShare?: (d: ShareData) => boolean;
      share?: (d: ShareData) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: "InkPreview", text });
      return true;
    }
    if (nav.share) {
      await nav.share({ title: "InkPreview", text });
      return true;
    }
  } catch {
    /* user cancelled or unsupported */
  }
  return false;
}
