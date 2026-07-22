-- ICCP 0003 — risks, policies, audits (all tenant-owned)

CREATE TABLE risks (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  code          TEXT NOT NULL,                   -- 'RSK-007'
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'security',
  likelihood    INTEGER NOT NULL DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact        INTEGER NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  -- score = likelihood * impact; severity derived: >=20 critical, >=12 high,
  -- >=6 medium, else low
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN
                  ('open','treating','accepted','transferred','closed')),
  owner_id      TEXT,
  control_id    TEXT,                            -- mitigating control (optional)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, code)
);
CREATE INDEX idx_risks_org_status ON risks(org_id, status);

CREATE TABLE risk_treatments (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  risk_id       TEXT NOT NULL REFERENCES risks(id),
  strategy      TEXT NOT NULL CHECK (strategy IN ('mitigate','accept','transfer','avoid')),
  plan          TEXT NOT NULL DEFAULT '',
  due_date      TEXT,
  status        TEXT NOT NULL DEFAULT 'planned' CHECK (status IN
                  ('planned','in_progress','done','overdue')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE policies (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  title         TEXT NOT NULL,                   -- 'Access Control Policy'
  owner_id      TEXT,
  review_freq_days INTEGER NOT NULL DEFAULT 365,
  next_review   TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                  ('draft','in_review','approved','retired')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, title)
);

CREATE TABLE policy_versions (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  policy_id     TEXT NOT NULL REFERENCES policies(id),
  version       INTEGER NOT NULL,
  body_md       TEXT NOT NULL DEFAULT '',        -- markdown content
  changelog     TEXT NOT NULL DEFAULT '',
  approved_by   TEXT,                            -- membership id
  approved_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (policy_id, version)
);

CREATE TABLE policy_acknowledgements (
  policy_version_id TEXT NOT NULL REFERENCES policy_versions(id),
  membership_id     TEXT NOT NULL,
  acknowledged_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (policy_version_id, membership_id)
);

CREATE TABLE audits (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  name          TEXT NOT NULL,                   -- 'ISO 27001 Stage 2 — 2026'
  framework_id  TEXT,                            -- optional library link
  auditor_id    TEXT,                            -- membership id (auditor role)
  starts_on     TEXT,
  ends_on       TEXT,
  status        TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN
                  ('preparing','fieldwork','reporting','closed')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_findings (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  audit_id      TEXT NOT NULL REFERENCES audits(id),
  requirement_id TEXT,                           -- library ref (optional)
  control_id    TEXT,                            -- org control (optional)
  severity      TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN
                  ('observation','minor','major','critical')),
  title         TEXT NOT NULL,
  detail        TEXT NOT NULL DEFAULT '',
  corrective_action TEXT NOT NULL DEFAULT '',
  due_date      TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN
                  ('open','in_progress','resolved','verified')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_evidence_requests (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  audit_id      TEXT NOT NULL REFERENCES audits(id),
  requirement_id TEXT,
  request       TEXT NOT NULL,
  evidence_id   TEXT,                            -- fulfilled by
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','provided','accepted')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
