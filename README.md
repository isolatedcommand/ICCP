# ICCP — Isolated Command Compliance Platform

`compliance.isolatedcommand.com` — a continuous-compliance operating system on
Cloudflare Workers: frameworks, controls, evidence, risks, policies and audits
as one connected, cross-mapped graph. Design docs live in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Layout

```
ICCP/
├── docs/ARCHITECTURE.md   # ADRs, compliance knowledge model, RBAC matrix
├── build.sh               # builds the Publisher-themed Hugo front end
├── frontend/              # Hugo child site (app shell + module views)
│   ├── layouts/_default/app.html     # generic app page (view per front matter)
│   └── static/js/iccp-*.js           # API client + module views
└── worker/
    ├── wrangler.toml      # Worker + assets + D1 + R2 + Access vars + cron
    ├── migrations/        # 0001 identity · 0002 compliance · 0003 grc · 0004 platform
    ├── seed/              # framework library starter pack (6 frameworks, cross-mapped)
    └── src/
        ├── index.js       # router: assets + /api/v1 (Access-verified)
        ├── access.js      # Cloudflare Access JWT verification (RS256/JWKS)
        ├── rbac.js        # deny-by-default permission matrix
        ├── db.js          # org-scoped repository layer (tenant isolation)
        └── api/           # orgs, compliance, evidence, grc, audits, dashboard
```

## One-time setup

```bash
cd worker
npm install

# 1. Create the database + bucket, then paste the D1 id into wrangler.toml
npx wrangler d1 create iccp
npx wrangler r2 bucket create iccp-evidence

# 2. Apply schema + framework library
npm run migrate:remote
npm run seed:remote

# 3. Protect the app with Cloudflare Access
#    Zero Trust → Access → Applications → Add self-hosted app for
#    compliance.isolatedcommand.com (add Google / Microsoft / email-OTP IdPs).
#    Copy the AUD tag + team domain into wrangler.toml [vars].

# 4. Deploy (build command compiles the Hugo front end first)
npm run deploy
```

Then add `compliance.isolatedcommand.com` as the Worker's custom domain.

## Local development

```bash
cd worker
npm run migrate:local && npm run seed:local
# uncomment DEV_BYPASS_EMAIL in wrangler.toml, then:
npm run dev            # http://localhost:8787 (API + built assets)
# front end with live theme:
cd ../frontend && hugo server --port 1320
```

## API sketch

All endpoints under `/api/v1`, authenticated by Cloudflare Access, org-scoped
under `/orgs/:orgId/…`, RBAC-gated per the matrix in `rbac.js`:

`/me` · `/orgs` · `/dashboard` · `/members` · `/activity` · `/frameworks` ·
`/frameworks/:id/requirements` · `/requirements/:id/related` · `/adoptions` ·
`/adoptions/:id/assessments` · `/assessments/:id` · `/controls` ·
`/evidence` (+ `/file` upload/download, `/review`) · `/risks` (+ `/treatments`) ·
`/policies` (+ `/versions`, approve, acknowledge) · `/audits` (+ findings,
evidence requests).

## Integration framework (connector roadmap)

`integrations` + `integration_checks` tables are live; connectors (Entra ID,
AWS, Google Workspace, GitHub, Defender, Sentinel, CrowdStrike, Cloudflare)
run as scheduled jobs that write check results and materialise auto-generated
evidence rows against mapped controls. The Entra ID connector contract:
checks `mfa-enabled`, `privileged-accounts`, `inactive-users`,
`conditional-access`; each run yields pass/fail + JSON detail + evidence.
