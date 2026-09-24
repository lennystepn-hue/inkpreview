/**
 * SQLite schema for the Database Durable Object — the same tables and columns
 * as the former Postgres schema (backend/alembic), so a pg dump of the old
 * server can be imported later without reshaping data.
 *
 * Conventions: ids are 32-char hex (uuid4().hex), timestamps are ISO-8601 UTC
 * strings, booleans are 0/1, JSON columns are TEXT.
 *
 * Append-only: add a new entry to MIGRATIONS for every schema change; never
 * edit one that has shipped.
 */

export const MIGRATIONS: string[][] = [
  // v1 — baseline (== alembic head 25ee7e4b5d11)
  [
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      google_sub TEXT UNIQUE,
      name TEXT,
      avatar_url TEXT,
      is_anonymous INTEGER NOT NULL DEFAULT 1,
      credits INTEGER NOT NULL DEFAULT 0,
      plan TEXT NOT NULL DEFAULT 'free',
      locale TEXT NOT NULL DEFAULT 'de',
      stripe_customer_id TEXT UNIQUE,
      stripe_subscription_id TEXT,
      pro_period_end TEXT,
      referred_by TEXT,
      brand_name TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_users_referred_by ON users (referred_by)`,
    `CREATE TABLE designs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      enhanced_prompt TEXT,
      styles TEXT NOT NULL DEFAULT '[]',
      modifiers TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'queued',
      error TEXT,
      clean_png_url TEXT,
      thumb_url TEXT,
      width INTEGER,
      height INTEGER,
      parent_design_id TEXT REFERENCES designs (id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_designs_user_id ON designs (user_id)`,
    `CREATE INDEX ix_designs_parent_design_id ON designs (parent_design_id)`,
    `CREATE INDEX ix_designs_status_created ON designs (status, created_at)`,
    `CREATE INDEX ix_designs_created_at ON designs (created_at)`,
    `CREATE TABLE body_photos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      storage_ref TEXT NOT NULL,
      content_hash TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_body_photos_user_id ON body_photos (user_id)`,
    `CREATE INDEX ix_body_photos_expires_at ON body_photos (expires_at)`,
    `CREATE TABLE previews (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
      body_photo_id TEXT NOT NULL REFERENCES body_photos (id) ON DELETE CASCADE,
      x_pct REAL NOT NULL,
      y_pct REAL NOT NULL,
      scale REAL NOT NULL DEFAULT 0.3,
      rotation REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      error TEXT,
      output_url TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_previews_design_id ON previews (design_id)`,
    `CREATE INDEX ix_previews_body_photo_id ON previews (body_photo_id)`,
    `CREATE INDEX ix_previews_status ON previews (status)`,
    `CREATE INDEX ix_previews_expires_at ON previews (expires_at)`,
    `CREATE TABLE mockups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      design_id TEXT REFERENCES designs (id) ON DELETE SET NULL,
      output_url TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_mockups_user_created ON mockups (user_id, created_at)`,
    `CREATE INDEX ix_mockups_design_id ON mockups (design_id)`,
    `CREATE TABLE exports (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
      preview_id TEXT REFERENCES previews (id) ON DELETE SET NULL,
      hires_url TEXT,
      mockup_url TEXT,
      stencil_url TEXT,
      watermarked INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_exports_design_id ON exports (design_id)`,
    `CREATE TABLE events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_events_user_id ON events (user_id)`,
    `CREATE INDEX ix_events_action ON events (action)`,
    `CREATE TABLE usage_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT 'generation',
      design_id TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_usage_ledger_user_created ON usage_ledger (user_id, created_at)`,
    `CREATE INDEX ix_usage_ledger_design_id ON usage_ledger (design_id)`,
    `CREATE TABLE capture_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      body_photo_id TEXT REFERENCES body_photos (id) ON DELETE SET NULL,
      design_id TEXT,
      x_pct REAL,
      y_pct REAL,
      scale REAL,
      rotation REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX ix_capture_sessions_user_id ON capture_sessions (user_id)`,
    `CREATE INDEX ix_capture_sessions_expires_at ON capture_sessions (expires_at)`,
    // Sliding-window rate limiter (replaces the in-memory limiter of the single
    // Python process — Workers have no shared memory between requests).
    `CREATE TABLE rate_hits (
      key TEXT NOT NULL,
      at INTEGER NOT NULL
    )`,
    `CREATE INDEX ix_rate_hits_key_at ON rate_hits (key, at)`,
  ],
];
