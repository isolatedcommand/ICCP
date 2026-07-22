/* Risks (register, scoring, treatment), policies (versions, approval, acks). */

import { json, ApiError, daysFromNow } from "../lib/util.js";
import { readJson, validate } from "../lib/validate.js";
import { require } from "../rbac.js";

export function severity(likelihood, impact) {
  const s = likelihood * impact;
  return s >= 20 ? "critical" : s >= 12 ? "high" : s >= 6 ? "medium" : "low";
}

/* ── Risks ── */

export async function listRisks(ctx) {
  const rows = await ctx.repo.list("risks", { order: "created_at DESC" });
  return json({ risks: rows.map((r) => ({ ...r, score: r.likelihood * r.impact, severity: severity(r.likelihood, r.impact) })) });
}

const RISK_SPEC = {
  code: { type: "string", max: 30 }, title: { type: "string", max: 200 },
  description: { type: "string", max: 4000 }, category: { type: "string", max: 60 },
  likelihood: { type: "number", int: true, min: 1, max: 5 },
  impact: { type: "number", int: true, min: 1, max: 5 },
  status: { type: "string", enum: ["open", "treating", "accepted", "transferred", "closed"] },
  owner_id: { type: "string", max: 40 }, control_id: { type: "string", max: 40 },
};

export async function createRisk(ctx, request) {
  require(ctx, "risk.write");
  const input = validate(await readJson(request), { ...RISK_SPEC,
    code: { ...RISK_SPEC.code, required: true }, title: { ...RISK_SPEC.title, required: true } });
  if (input.control_id) await ctx.repo.get("controls", input.control_id);
  const id = await ctx.repo.insert("risks", input)
    .catch((e) => { throw String(e).includes("UNIQUE") ? new ApiError(409, "Risk code exists") : e; });
  await ctx.repo.log(ctx.user.id, "risk.create", "risk", id, { code: input.code });
  return json({ id }, 201);
}

export async function updateRisk(ctx, id, request) {
  require(ctx, "risk.write");
  const input = validate(await readJson(request), RISK_SPEC);
  if (input.control_id) await ctx.repo.get("controls", input.control_id);
  await ctx.repo.update("risks", id, input);
  await ctx.repo.log(ctx.user.id, "risk.update", "risk", id, input);
  return json({ ok: true });
}

export async function addTreatment(ctx, riskId, request) {
  require(ctx, "risk.write");
  await ctx.repo.get("risks", riskId);
  const input = validate(await readJson(request), {
    strategy: { type: "string", required: true, enum: ["mitigate", "accept", "transfer", "avoid"] },
    plan: { type: "string", max: 4000 }, due_date: { type: "date" },
    status: { type: "string", enum: ["planned", "in_progress", "done", "overdue"] },
  });
  const id = await ctx.repo.insert("risk_treatments", { risk_id: riskId, ...input });
  const riskStatus = input.strategy === "accept" ? "accepted" : input.strategy === "transfer" ? "transferred" : "treating";
  await ctx.repo.update("risks", riskId, { status: riskStatus });
  await ctx.repo.log(ctx.user.id, "risk.treat", "risk_treatment", id, input);
  return json({ id }, 201);
}

export async function treatments(ctx, riskId) {
  await ctx.repo.get("risks", riskId);
  const rows = await ctx.repo.list("risk_treatments", { where: "risk_id = ?", params: [riskId] });
  return json({ treatments: rows });
}

/* ── Policies ── */

export async function listPolicies(ctx) {
  const policies = await ctx.repo.list("policies", { order: "title" });
  const counts = await ctx.repo.raw(
    `SELECT pv.policy_id, pv.version, COUNT(pa.membership_id) AS acks
     FROM policy_versions pv LEFT JOIN policy_acknowledgements pa ON pa.policy_version_id = pv.id
     WHERE pv.org_id = ? GROUP BY pv.id`
  ).bind(ctx.repo.orgId).all();
  const latest = {};
  for (const c of counts.results || []) {
    if (!latest[c.policy_id] || c.version > latest[c.policy_id].version) latest[c.policy_id] = c;
  }
  return json({ policies: policies.map((p) => ({ ...p, latest: latest[p.id] || null })) });
}

export async function createPolicy(ctx, request) {
  require(ctx, "policy.write");
  const input = validate(await readJson(request), {
    title: { type: "string", required: true, max: 160 },
    body_md: { type: "string", required: true, max: 200000 },
    review_freq_days: { type: "number", int: true, min: 1, max: 3650 },
    changelog: { type: "string", max: 2000 },
  });
  const { body_md, changelog = "Initial version", ...meta } = input;
  if (meta.review_freq_days) meta.next_review = daysFromNow(meta.review_freq_days);
  const policyId = await ctx.repo.insert("policies", meta)
    .catch((e) => { throw String(e).includes("UNIQUE") ? new ApiError(409, "Policy title exists") : e; });
  await ctx.repo.insert("policy_versions", { policy_id: policyId, version: 1, body_md, changelog });
  await ctx.repo.log(ctx.user.id, "policy.create", "policy", policyId, { title: input.title });
  return json({ id: policyId }, 201);
}

export async function newVersion(ctx, policyId, request) {
  require(ctx, "policy.write");
  await ctx.repo.get("policies", policyId);
  const input = validate(await readJson(request), {
    body_md: { type: "string", required: true, max: 200000 },
    changelog: { type: "string", required: true, max: 2000 },
  });
  const last = await ctx.repo.raw(
    "SELECT MAX(version) AS v FROM policy_versions WHERE org_id = ? AND policy_id = ?"
  ).bind(ctx.repo.orgId, policyId).first();
  const id = await ctx.repo.insert("policy_versions", {
    policy_id: policyId, version: (last?.v || 0) + 1, ...input,
  });
  await ctx.repo.update("policies", policyId, { status: "in_review" });
  await ctx.repo.log(ctx.user.id, "policy.version", "policy_version", id, { changelog: input.changelog });
  return json({ id }, 201);
}

export async function approveVersion(ctx, versionId) {
  require(ctx, "policy.write");
  const v = await ctx.repo.get("policy_versions", versionId);
  await ctx.repo.update("policy_versions", versionId, {
    approved_by: ctx.membership.id, approved_at: new Date().toISOString(),
  });
  await ctx.repo.update("policies", v.policy_id, { status: "approved" });
  await ctx.repo.log(ctx.user.id, "policy.approve", "policy_version", versionId);
  return json({ ok: true });
}

export async function acknowledge(ctx, versionId) {
  require(ctx, "policy.acknowledge");
  await ctx.repo.get("policy_versions", versionId);
  await ctx.env.DB.prepare(
    "INSERT OR IGNORE INTO policy_acknowledgements (policy_version_id, membership_id) VALUES (?,?)"
  ).bind(versionId, ctx.membership.id).run();
  await ctx.repo.log(ctx.user.id, "policy.acknowledge", "policy_version", versionId);
  return json({ ok: true });
}

export async function policyVersions(ctx, policyId) {
  await ctx.repo.get("policies", policyId);
  const rows = await ctx.repo.list("policy_versions", { where: "policy_id = ?", params: [policyId], order: "version DESC" });
  return json({ versions: rows });
}
