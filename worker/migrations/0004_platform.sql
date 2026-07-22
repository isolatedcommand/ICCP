-- ICCP 0004 — integration framework
-- Connectors run checks against external systems and materialise results as
-- evidence + findings. Runs are queued (cron / Queues later); results land in
-- integration_checks with a link to auto-generated evidence.

CREATE TABLE integrations (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  connector     TEXT NOT NULL,                   -- 'entra-id' | 'aws' | 'github' | 'cloudflare' | ...
  name          TEXT NOT NULL,
  config        TEXT NOT NULL DEFAULT '{}',      -- JSON (non-secret config)
  secret_ref    TEXT NOT NULL DEFAULT '',        -- name of Worker secret holding credentials
  status        TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN
                  ('disconnected','connected','error')),
  last_run_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE integration_checks (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  check_key     TEXT NOT NULL,                   -- 'mfa-enabled' | 'inactive-users' | ...
  title         TEXT NOT NULL,
  result        TEXT NOT NULL DEFAULT 'unknown' CHECK (result IN
                  ('pass','fail','warn','unknown')),
  detail        TEXT NOT NULL DEFAULT '{}',      -- JSON payload of the run
  evidence_id   TEXT,                            -- auto-generated evidence row
  control_id    TEXT,                            -- control it substantiates
  run_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_checks_org ON integration_checks(org_id, run_at DESC);
