/** Row shapes returned by the Database Durable Object (plain, structured-cloneable). */

export type JobStatus = "queued" | "processing" | "done" | "failed";

export interface User {
  id: string;
  email: string | null;
  google_sub: string | null;
  name: string | null;
  avatar_url: string | null;
  is_anonymous: boolean;
  credits: number;
  plan: string;
  locale: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  pro_period_end: string | null;
  referred_by: string | null;
  brand_name: string | null;
  created_at: string;
}

export interface Design {
  id: string;
  user_id: string;
  prompt: string;
  enhanced_prompt: string | null;
  styles: string[];
  modifiers: Record<string, unknown>;
  status: JobStatus;
  error: string | null;
  clean_png_url: string | null;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  parent_design_id: string | null;
  created_at: string;
}

export interface BodyPhoto {
  id: string;
  user_id: string;
  storage_ref: string;
  content_hash: string | null;
  expires_at: string;
  created_at: string;
}

export interface Preview {
  id: string;
  design_id: string;
  body_photo_id: string;
  x_pct: number;
  y_pct: number;
  scale: number;
  rotation: number;
  status: JobStatus;
  error: string | null;
  output_url: string | null;
  expires_at: string;
  created_at: string;
}

export interface Mockup {
  id: string;
  user_id: string;
  design_id: string | null;
  output_url: string;
  created_at: string;
}

export interface Export {
  id: string;
  design_id: string;
  preview_id: string | null;
  hires_url: string | null;
  mockup_url: string | null;
  stencil_url: string | null;
  watermarked: boolean;
  created_at: string;
}

export interface CaptureSession {
  id: string;
  user_id: string;
  body_photo_id: string | null;
  design_id: string | null;
  x_pct: number | null;
  y_pct: number | null;
  scale: number | null;
  rotation: number | null;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface QuotaStatus {
  plan: string;
  period: "lifetime" | "month";
  limit: number | null; // null == unlimited
  used: number;
  remaining: number | null; // null == unlimited
  reset_at: string | null; // start of next month; null for lifetime/unlimited
}

export interface Placement4 {
  x_pct: number;
  y_pct: number;
  scale: number;
  rotation: number;
}

export interface NewDesign {
  prompt: string;
  styles: string[];
  modifiers: Record<string, unknown>;
}

export interface RateLimit {
  key: string;
  limit: number;
  windowS: number;
}

export interface GoogleProfile {
  sub: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
}
