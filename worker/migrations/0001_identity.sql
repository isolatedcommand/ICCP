-- ICCP 0001 — identity & tenancy
-- Every tenant-owned table in later migrations carries org_id and is only
-- reachable through the org-scoped repository layer.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,                -- ulid
  email         TEXT NOT NULL UNIQUE,            -- from verified Access JWT
  name          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT
);

CREATE TABLE organisations (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE memberships (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisations(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  role          TEXT NOT NULL CHECK (role IN
                  ('owner','compliance_manager','security_engineer',
                   'auditor','contributor','viewer')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_org  ON memberships(org_id);

CREATE TABLE teams (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisations(id),
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  UNIQUE (org_id, name)
);

CREATE TABLE team_members (
  team_id       TEXT NOT NULL REFERENCES teams(id),
  membership_id TEXT NOT NULL REFERENCES memberships(id),
  PRIMARY KEY (team_id, membership_id)
);

-- Append-only audit trail. No UPDATE/DELETE path exists in the API.
CREATE TABLE activity_logs (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  actor_id      TEXT NOT NULL,                   -- user id
  action        TEXT NOT NULL,                   -- e.g. evidence.approve
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',        -- JSON
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_org_time ON activity_logs(org_id, created_at DESC);
