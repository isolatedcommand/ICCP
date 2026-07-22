-- ICCP 0002 — compliance graph
-- LIBRARY tables (frameworks, requirements, requirement_concepts) are global,
-- versioned reference data. Everything else is tenant-owned (org_id).

-- ── Library ────────────────────────────────────────────────────────────────

CREATE TABLE frameworks (
  id            TEXT PRIMARY KEY,                -- 'iso27001-2022'
  name          TEXT NOT NULL,                   -- 'ISO/IEC 27001:2022'
  short_name    TEXT NOT NULL,                   -- 'ISO 27001'
  version       TEXT NOT NULL,
  publisher     TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  structure     TEXT NOT NULL DEFAULT 'flat'     -- flat | function | tier | principle
);

CREATE TABLE requirements (
  id            TEXT PRIMARY KEY,                -- 'iso27001-2022/A.5.15'
  framework_id  TEXT NOT NULL REFERENCES frameworks(id),
  code          TEXT NOT NULL,                   -- 'A.5.15'
  title         TEXT NOT NULL,
  grouping      TEXT NOT NULL DEFAULT '',        -- clause / TSC / function / IG / tier / obligation
  objective     TEXT NOT NULL DEFAULT '',        -- control objective / purpose
  guidance      TEXT NOT NULL DEFAULT '',        -- implementation guidance
  evidence_hints TEXT NOT NULL DEFAULT '[]',     -- JSON array of expected evidence names
  UNIQUE (framework_id, code)
);
CREATE INDEX idx_requirements_fw ON requirements(framework_id);

-- Cross-framework mapping: requirements that share a concept satisfy each other.
CREATE TABLE requirement_concepts (
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  concept        TEXT NOT NULL,                  -- 'access-control', 'mfa', 'asset-inventory'
  PRIMARY KEY (requirement_id, concept)
);
CREATE INDEX idx_concepts ON requirement_concepts(concept);

-- ── Tenant compliance state ────────────────────────────────────────────────

CREATE TABLE framework_adoptions (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  framework_id  TEXT NOT NULL REFERENCES frameworks(id),
  target_date   TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','achieved')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, framework_id)
);

CREATE TABLE controls (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL,
  code           TEXT NOT NULL,                  -- org's own id, e.g. 'CTL-014'
  title          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  owner_id       TEXT,                           -- membership id
  status         TEXT NOT NULL DEFAULT 'not_implemented' CHECK (status IN
                   ('not_implemented','in_progress','implemented','attention','not_applicable')),
  review_freq_days INTEGER NOT NULL DEFAULT 365,
  last_review    TEXT,
  next_review    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, code)
);
CREATE INDEX idx_controls_org ON controls(org_id);

-- Control ↔ library requirement (the multi-framework fan-out).
CREATE TABLE control_mappings (
  control_id     TEXT NOT NULL REFERENCES controls(id),
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  PRIMARY KEY (control_id, requirement_id)
);
CREATE INDEX idx_mappings_req ON control_mappings(requirement_id);

CREATE TABLE evidence (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  r2_key        TEXT NOT NULL DEFAULT '',        -- org/<org>/evidence/<id>/<ver>/<file>
  file_name     TEXT NOT NULL DEFAULT '',
  content_type  TEXT NOT NULL DEFAULT '',
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  version       INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                  ('draft','pending_review','approved','rejected','expired')),
  valid_days    INTEGER NOT NULL DEFAULT 365,    -- expiry policy
  approved_at   TEXT,
  expires_at    TEXT,
  created_by    TEXT NOT NULL,                   -- membership id
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_evidence_org_status ON evidence(org_id, status);
CREATE INDEX idx_evidence_expiry ON evidence(org_id, expires_at);

CREATE TABLE evidence_controls (
  evidence_id   TEXT NOT NULL REFERENCES evidence(id),
  control_id    TEXT NOT NULL REFERENCES controls(id),
  PRIMARY KEY (evidence_id, control_id)
);

CREATE TABLE evidence_reviews (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  evidence_id   TEXT NOT NULL REFERENCES evidence(id),
  reviewer_id   TEXT NOT NULL,                   -- membership id
  decision      TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  comment       TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-adoption requirement assessment (rolled up into framework %).
CREATE TABLE assessments (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL,
  adoption_id    TEXT NOT NULL REFERENCES framework_adoptions(id),
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  status         TEXT NOT NULL DEFAULT 'unassessed' CHECK (status IN
                   ('unassessed','not_met','partially_met','met','not_applicable')),
  maturity       INTEGER NOT NULL DEFAULT 0 CHECK (maturity BETWEEN 0 AND 5),
  note           TEXT NOT NULL DEFAULT '',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (adoption_id, requirement_id)
);
CREATE INDEX idx_assessments_adoption ON assessments(adoption_id);
