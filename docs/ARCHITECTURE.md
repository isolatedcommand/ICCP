# ICCP — Platform Architecture

Isolated Command Compliance Platform. A continuous-compliance operating system:
frameworks, controls, evidence, risks, policies and audits managed as one
connected graph, not a checklist.

## 1. Architecture decision record

### ADR-001 — Edge-native, serverless, single Worker API
One Cloudflare Worker serves the JSON API; the front end is a pre-built static
site served by the Worker's assets binding. No origin servers.

- **Why:** matches every other Isolated Command product (Go, File, VMS), keeps
  the attack surface static-plus-API, deploys atomically with `wrangler deploy`,
  and scales per-request at the edge.

### ADR-002 — Hugo + Publisher for the shell, not Next.js
The brief prefers React/Next.js. Decision: Publisher (Hugo module) renders the
application shell, layouts and design system; each module page mounts a focused
vanilla-JS view that talks to the API.

- **Why:** Publisher *is* a Hugo module — using it natively gives the exact
  design language for free and inherits every platform improvement on rebuild.
  Next-on-Workers adds a second build system and SSR complexity the product
  does not need (every view is API-driven and behind auth, so SEO/SSR is moot).
- **Reversible:** the API is a clean JSON contract; a React/Next front end can
  replace the shell later without touching the backend.

### ADR-003 — Single D1 database, strict tenant scoping
One D1 database; every tenant-owned row carries `org_id`. All queries go
through a repository layer that requires an org context — there is no query
path that skips it. R2 objects are keyed `org/<org_id>/evidence/<id>/<version>`.

- **Scale path:** D1 read replication first; per-tenant database sharding
  (Workers can bind D1 databases dynamically via the platforms API) when a
  tenant outgrows shared storage. The schema is shard-ready because nothing
  joins across organisations.

### ADR-004 — Framework library is global, compliance state is tenant-owned
Framework definitions (ISO 27001, SOC 2, NIST CSF, CIS v8, CSA Cyber Trust
Mark, PDPA) are versioned **library data**, not tenant data. Organisations
*adopt* a framework; their controls, evidence, risks and assessments reference
library requirement IDs. Cross-framework mapping lives in the library
(requirement-to-concept), so one control satisfies many frameworks.

### ADR-005 — Cloudflare Access is the identity plane
Access (Google, Microsoft, email OTP IdPs) authenticates at the edge; the
Worker verifies the RS256 JWT (signature via team JWKS, iss, aud, exp/nbf) on
every request — the same hardened module already proven in the Go product.
Authorisation (RBAC, org membership) is the Worker's job, never Access's.

## 2. System diagram

```
Browser (Publisher-styled app shell + module views)
   │  HTTPS
   ▼
Cloudflare Access (Google / Microsoft / email OTP)
   │  Cf-Access-Jwt-Assertion
   ▼
ICCP Worker ──────────────────────────────────────────────
   │  static assets (frontend/public via ASSETS binding)
   │  /api/v1/* JSON API
   │    auth.js   verify Access JWT → user
   │    rbac.js   membership + role → permission gate
   │    db.js     org-scoped repository layer
   ▼            ▼             ▼
  D1 (relational graph)   R2 (evidence objects)   Queues* (integration runs)
                                                   *future
```

## 3. Compliance knowledge model

```
LIBRARY (global, versioned)                TENANT (org-scoped)
frameworks                                 framework_adoptions
  └── requirements ── concepts ──┐         controls ── control_mappings ─→ requirements
        (A.5.15, CC6.1, PR.AC-1) │         evidence ── evidence_controls ─→ controls
                                 │         evidence_reviews (lifecycle)
     cross-framework mapping ────┘         assessments (requirement status per adoption)
                                           risks ── risk_treatments
                                           policies ── policy_versions ── acknowledgements
                                           audits ── audit_findings ── evidence_requests
```

Key inference: a control mapped to requirement A.5.15 also advances SOC 2
CC6.1 and NIST PR.AC-1 because those requirements share the `access-control`
concept. Compliance scores roll up: evidence state → control state →
requirement assessment → framework percentage → org score.

## 4. Evidence lifecycle

`draft → pending_review → approved → (expiring soon) → expired → renewed`

Every evidence item has an expiry policy (e.g. quarterly access review = 90
days). Approval writes an `evidence_reviews` row; expiry is computed, surfaced
on the dashboard, and flips dependent controls to `attention`.

## 5. RBAC

| Permission                | Owner | Compliance Mgr | Sec Engineer | Auditor | Contributor | Viewer |
|---------------------------|:-----:|:--------------:|:------------:|:-------:|:-----------:|:------:|
| Manage org & members      |   ✓   |                |              |         |             |        |
| Adopt frameworks          |   ✓   |       ✓        |              |         |             |        |
| Manage controls           |   ✓   |       ✓        |      ✓       |         |             |        |
| Upload evidence           |   ✓   |       ✓        |      ✓       |         |      ✓      |        |
| Approve evidence          |   ✓   |       ✓        |              |         |             |        |
| Manage risks              |   ✓   |       ✓        |      ✓       |         |             |        |
| Manage policies           |   ✓   |       ✓        |              |         |             |        |
| Acknowledge policies      |   ✓   |       ✓        |      ✓       |         |      ✓      |   ✓    |
| Run audits / findings     |   ✓   |       ✓        |              |    ✓    |             |        |
| Read everything           |   ✓   |       ✓        |      ✓       |    ✓    |      ✓      |   ✓    |

Auditor is read-mostly plus findings/evidence-requests inside audits they are
assigned to. Enforced in `rbac.js` as a permission matrix, checked per route.

## 6. Module map (information architecture)

| Route        | View                                                              |
|--------------|-------------------------------------------------------------------|
| /dashboard   | org score, per-framework rings, evidence + risk counters, upcoming |
| /frameworks  | library + adoption state, requirement browser, maturity            |
| /controls    | control register, status, owner, review cadence, mappings          |
| /evidence    | evidence timeline, upload, approval queue, expiry monitor          |
| /risks       | register, 5×5 scoring, treatment plans, acceptance                 |
| /policies    | policy list, versions, approval, acknowledgement tracking          |
| /audits      | audit workspaces, findings, corrective actions, requests           |

## 7. Security requirements → implementation

- **Tenant isolation** — repository layer; org_id on every tenant table; R2 key prefix per org.
- **RBAC** — permission matrix, deny-by-default, route-level gates.
- **Audit logging** — append-only `activity_logs` written by every mutation.
- **Secure upload** — type/size allow-list, R2 keys never client-controlled, content-disposition forced on download.
- **API security** — Access JWT verified per request; CORS restricted to product origins; JSON schema validation on input (`lib/validate.js`); prepared statements only.
- **Least privilege** — Worker bindings scoped to this product's D1/R2; Access service tokens for integrations only.
