/* Audit workspaces: findings, corrective actions, evidence requests. */

import { json, ApiError } from "../lib/util.js";
import { readJson, validate } from "../lib/validate.js";
import { require } from "../rbac.js";

export async function list(ctx) {
  const audits = await ctx.repo.list("audits", { order: "created_at DESC" });
  const counts = await ctx.repo.raw(
    `SELECT audit_id, COUNT(*) AS findings,
            SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open_findings
     FROM audit_findings WHERE org_id = ? GROUP BY audit_id`
  ).bind(ctx.repo.orgId).all();
  const byAudit = Object.fromEntries((counts.results || []).map((c) => [c.audit_id, c]));
  return json({ audits: audits.map((a) => ({ ...a, ...byAudit[a.id] })) });
}

export async function create(ctx, request) {
  require(ctx, "audit.write");
  const input = validate(await readJson(request), {
    name: { type: "string", required: true, max: 160 },
    framework_id: { type: "string", max: 60 },
    auditor_id: { type: "string", max: 40 },
    starts_on: { type: "date" }, ends_on: { type: "date" },
  });
  const id = await ctx.repo.insert("audits", input);
  await ctx.repo.log(ctx.user.id, "audit.create", "audit", id, { name: input.name });
  return json({ id }, 201);
}

export async function update(ctx, id, request) {
  require(ctx, "audit.write");
  const input = validate(await readJson(request), {
    status: { type: "string", enum: ["preparing", "fieldwork", "reporting", "closed"] },
    auditor_id: { type: "string", max: 40 },
    starts_on: { type: "date" }, ends_on: { type: "date" },
  });
  await ctx.repo.update("audits", id, input);
  await ctx.repo.log(ctx.user.id, "audit.update", "audit", id, input);
  return json({ ok: true });
}

export async function addFinding(ctx, auditId, request) {
  require(ctx, "audit.write");
  await ctx.repo.get("audits", auditId);
  const input = validate(await readJson(request), {
    title: { type: "string", required: true, max: 200 },
    detail: { type: "string", max: 8000 },
    severity: { type: "string", enum: ["observation", "minor", "major", "critical"] },
    requirement_id: { type: "string", max: 80 },
    control_id: { type: "string", max: 40 },
    corrective_action: { type: "string", max: 4000 },
    due_date: { type: "date" },
  });
  if (input.control_id) await ctx.repo.get("controls", input.control_id);
  const id = await ctx.repo.insert("audit_findings", { audit_id: auditId, ...input });
  await ctx.repo.log(ctx.user.id, "audit.finding", "audit_finding", id, { title: input.title });
  return json({ id }, 201);
}

export async function findings(ctx, auditId) {
  await ctx.repo.get("audits", auditId);
  const rows = await ctx.repo.list("audit_findings", { where: "audit_id = ?", params: [auditId] });
  return json({ findings: rows });
}

export async function updateFinding(ctx, id, request) {
  require(ctx, "audit.write");
  const input = validate(await readJson(request), {
    status: { type: "string", enum: ["open", "in_progress", "resolved", "verified"] },
    corrective_action: { type: "string", max: 4000 },
    due_date: { type: "date" },
  });
  await ctx.repo.update("audit_findings", id, input);
  await ctx.repo.log(ctx.user.id, "audit.finding.update", "audit_finding", id, input);
  return json({ ok: true });
}

export async function requestEvidence(ctx, auditId, request) {
  require(ctx, "audit.write");
  await ctx.repo.get("audits", auditId);
  const input = validate(await readJson(request), {
    request: { type: "string", required: true, max: 2000 },
    requirement_id: { type: "string", max: 80 },
  });
  const id = await ctx.repo.insert("audit_evidence_requests", { audit_id: auditId, ...input });
  await ctx.repo.log(ctx.user.id, "audit.request", "audit_evidence_request", id);
  return json({ id }, 201);
}

export async function fulfilRequest(ctx, id, request) {
  require(ctx, "evidence.write");
  const input = validate(await readJson(request), {
    evidence_id: { type: "string", required: true, max: 40 },
    status: { type: "string", enum: ["provided", "accepted"] },
  });
  await ctx.repo.get("evidence", input.evidence_id);
  await ctx.repo.update("audit_evidence_requests", id, {
    evidence_id: input.evidence_id, status: input.status || "provided",
  });
  await ctx.repo.log(ctx.user.id, "audit.request.fulfil", "audit_evidence_request", id, input);
  return json({ ok: true });
}

export async function evidenceRequests(ctx, auditId) {
  await ctx.repo.get("audits", auditId);
  const rows = await ctx.repo.list("audit_evidence_requests", { where: "audit_id = ?", params: [auditId] });
  return json({ requests: rows });
}
