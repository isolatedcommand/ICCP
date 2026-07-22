/**
 * ICCP — Isolated Command Compliance Platform.
 * Single Worker: static Publisher front end (ASSETS) + /api/v1 JSON API.
 *
 * Request pipeline: CORS → Access JWT verify → user upsert → (org routes:
 * membership + RBAC) → org-scoped repository → handler → audit log.
 * Cron: daily evidence-expiry sweep.
 */

import { json, ApiError, errorResponse } from "./lib/util.js";
import { authenticate } from "./access.js";
import { withOrg, upsertUser, requireMembership } from "./db.js";
import { isDemoRequest, demoContext, resetDemo, DEMO_ORG_ID } from "./demo.js";
import * as orgs from "./api/orgs.js";
import * as compliance from "./api/compliance.js";
import * as evidence from "./api/evidence.js";
import * as grc from "./api/grc.js";
import * as audits from "./api/audits.js";
import { dashboard } from "./api/dashboard.js";

const ORIGINS = [
  "https://compliance.isolatedcommand.com",
  "https://compliance-demo.isolatedcommand.com",
  "http://localhost:1320", "http://127.0.0.1:1320", "http://localhost:8789",
];

function cors(request) {
  const origin = request.headers.get("origin") || "";
  const allow = ORIGINS.includes(origin) ? origin : ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-file-name,cf-access-jwt-assertion",
    "vary": "origin",
  };
}

/* Route table for org-scoped endpoints: [method, regex, handler(ctx, m, request, url)] */
const ORG_ROUTES = [
  ["GET",   /^\/dashboard$/,                       (c) => dashboard(c)],
  ["GET",   /^\/members$/,                         (c) => orgs.listMembers(c)],
  ["POST",  /^\/members$/,                         (c, m, r) => orgs.addMember(c, r)],
  ["GET",   /^\/activity$/,                        (c) => orgs.activity(c)],
  ["GET",   /^\/frameworks$/,                      (c) => compliance.frameworks(c)],
  ["GET",   /^\/frameworks\/([^/]+)\/requirements$/, (c, m) => compliance.requirements(c, m[1])],
  ["GET",   /^\/requirements\/(.+)\/related$/,     (c, m) => compliance.related(c, m[1])],
  ["POST",  /^\/adoptions$/,                       (c, m, r) => compliance.adopt(c, r)],
  ["GET",   /^\/adoptions\/([^/]+)\/assessments$/, (c, m) => compliance.assessments(c, m[1])],
  ["PATCH", /^\/assessments\/([^/]+)$/,            (c, m, r) => compliance.updateAssessment(c, m[1], r)],
  ["GET",   /^\/controls$/,                        (c) => compliance.listControls(c)],
  ["POST",  /^\/controls$/,                        (c, m, r) => compliance.createControl(c, r)],
  ["PATCH", /^\/controls\/([^/]+)$/,               (c, m, r) => compliance.updateControl(c, m[1], r)],
  ["GET",   /^\/evidence$/,                        (c, m, r, u) => evidence.list(c, u)],
  ["POST",  /^\/evidence$/,                        (c, m, r) => evidence.create(c, r)],
  ["PUT",   /^\/evidence\/([^/]+)\/file$/,         (c, m, r) => evidence.upload(c, m[1], r)],
  ["GET",   /^\/evidence\/([^/]+)\/file$/,         (c, m) => evidence.download(c, m[1])],
  ["POST",  /^\/evidence\/([^/]+)\/review$/,       (c, m, r) => evidence.review(c, m[1], r)],
  ["GET",   /^\/risks$/,                           (c) => grc.listRisks(c)],
  ["POST",  /^\/risks$/,                           (c, m, r) => grc.createRisk(c, r)],
  ["PATCH", /^\/risks\/([^/]+)$/,                  (c, m, r) => grc.updateRisk(c, m[1], r)],
  ["GET",   /^\/risks\/([^/]+)\/treatments$/,      (c, m) => grc.treatments(c, m[1])],
  ["POST",  /^\/risks\/([^/]+)\/treatments$/,      (c, m, r) => grc.addTreatment(c, m[1], r)],
  ["GET",   /^\/policies$/,                        (c) => grc.listPolicies(c)],
  ["POST",  /^\/policies$/,                        (c, m, r) => grc.createPolicy(c, r)],
  ["GET",   /^\/policies\/([^/]+)\/versions$/,     (c, m) => grc.policyVersions(c, m[1])],
  ["POST",  /^\/policies\/([^/]+)\/versions$/,     (c, m, r) => grc.newVersion(c, m[1], r)],
  ["POST",  /^\/policy-versions\/([^/]+)\/approve$/,     (c, m) => grc.approveVersion(c, m[1])],
  ["POST",  /^\/policy-versions\/([^/]+)\/acknowledge$/, (c, m) => grc.acknowledge(c, m[1])],
  ["GET",   /^\/audits$/,                          (c) => audits.list(c)],
  ["POST",  /^\/audits$/,                          (c, m, r) => audits.create(c, r)],
  ["PATCH", /^\/audits\/([^/]+)$/,                 (c, m, r) => audits.update(c, m[1], r)],
  ["GET",   /^\/audits\/([^/]+)\/findings$/,       (c, m) => audits.findings(c, m[1])],
  ["POST",  /^\/audits\/([^/]+)\/findings$/,       (c, m, r) => audits.addFinding(c, m[1], r)],
  ["PATCH", /^\/findings\/([^/]+)$/,               (c, m, r) => audits.updateFinding(c, m[1], r)],
  ["GET",   /^\/audits\/([^/]+)\/requests$/,       (c, m) => audits.evidenceRequests(c, m[1])],
  ["POST",  /^\/audits\/([^/]+)\/requests$/,       (c, m, r) => audits.requestEvidence(c, m[1], r)],
  ["POST",  /^\/requests\/([^/]+)\/fulfil$/,       (c, m, r) => audits.fulfilRequest(c, m[1], r)],
];

async function handleApi(request, env, url) {
  const demo = isDemoRequest(url, env);
  let user, demoMembership = null;
  if (demo) {
    const d = await demoContext(env);
    user = d.user;
    demoMembership = d.membership;
  } else {
    const identity = await authenticate(request, env);
    user = await upsertUser(env, identity.email);
  }
  const path = url.pathname.replace(/^\/api\/v1/, "");

  if (path === "/me" && request.method === "GET") return orgs.me(env, user);
  if (path === "/orgs" && request.method === "POST") {
    if (demo) throw new ApiError(403, "The demo is limited to the demo organisation");
    return orgs.createOrg(env, user, request);
  }

  const orgMatch = path.match(/^\/orgs\/([^/]+)(\/.*)$/);
  if (!orgMatch) throw new ApiError(404, "Unknown endpoint");
  const [, orgId, sub] = orgMatch;
  // Demo sessions are pinned to the demo organisation — nothing else exists.
  if (demo && orgId !== DEMO_ORG_ID) throw new ApiError(403, "The demo is limited to the demo organisation");
  const membership = demo ? demoMembership : await requireMembership(env, user.id, orgId);
  const ctx = { env, user, membership, repo: withOrg(env, orgId) };

  for (const [method, re, handler] of ORG_ROUTES) {
    if (request.method !== method) continue;
    const m = sub.match(re);
    if (m) return handler(ctx, m, request, url);
  }
  throw new ApiError(404, "Unknown endpoint");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
      try {
        const res = await handleApi(request, env, url);
        for (const [k, v] of Object.entries(cors(request))) res.headers.set(k, v);
        return res;
      } catch (err) {
        const res = errorResponse(err);
        for (const [k, v] of Object.entries(cors(request))) res.headers.set(k, v);
        return res;
      }
    }

    // Static Publisher front end; SPA-ish fallback to the app shell.
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(request);
      if (res.status !== 404) return res;
      return env.ASSETS.fetch(new URL("/404.html", url.origin));
    }
    return json({ error: "Assets not configured" }, 500);
  },

  // Daily: expire stale evidence, flag dependent controls, reset the demo org.
  async scheduled(_event, env, _ctx) {
    await evidence.sweepExpiry(env);
    await resetDemo(env);
  },
};
