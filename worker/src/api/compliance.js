/* Framework library, adoptions, assessments, controls & mappings. */

import { json, ulid, daysFromNow, ApiError } from "../lib/util.js";
import { readJson, validate } from "../lib/validate.js";
import { require } from "../rbac.js";
import { libFrameworks, libRequirements, libRelated } from "../db.js";

/* ── Library ── */

export async function frameworks(ctx) {
  const all = await libFrameworks(ctx.env);
  const adoptions = await ctx.repo.list("framework_adoptions", { order: "created_at" });
  const byFw = Object.fromEntries(adoptions.map((a) => [a.framework_id, a]));
  return json({ frameworks: all.map((f) => ({ ...f, adoption: byFw[f.id] || null })) });
}

export async function requirements(ctx, frameworkId) {
  const reqs = await libRequirements(ctx.env, frameworkId);
  if (!reqs.length) throw new ApiError(404, "Framework not found or empty");
  return json({ requirements: reqs });
}

export async function related(ctx, requirementId) {
  return json({ related: await libRelated(ctx.env, decodeURIComponent(requirementId)) });
}

/* ── Adoption & assessment ── */

export async function adopt(ctx, request) {
  require(ctx, "framework.adopt");
  const input = validate(await readJson(request), {
    framework_id: { type: "string", required: true, max: 60 },
    target_date:  { type: "date" },
  });
  const reqs = await libRequirements(ctx.env, input.framework_id);
  if (!reqs.length) throw new ApiError(404, "Unknown framework");
  const id = await ctx.repo.insert("framework_adoptions", {
    framework_id: input.framework_id, target_date: input.target_date || null,
  }).catch((e) => { throw String(e).includes("UNIQUE") ? new ApiError(409, "Already adopted") : e; });
  // Seed one unassessed row per requirement so progress is measurable at once.
  const stmts = reqs.map((r) => ctx.env.DB.prepare(
    "INSERT INTO assessments (id, org_id, adoption_id, requirement_id) VALUES (?,?,?,?)"
  ).bind(ulid(), ctx.repo.orgId, id, r.id));
  for (let i = 0; i < stmts.length; i += 50) await ctx.env.DB.batch(stmts.slice(i, i + 50));
  await ctx.repo.log(ctx.user.id, "framework.adopt", "framework_adoption", id, { framework: input.framework_id });
  return json({ id }, 201);
}

export async function assessments(ctx, adoptionId) {
  await ctx.repo.get("framework_adoptions", adoptionId);
  const r = await ctx.repo.raw(
    `SELECT a.*, req.code, req.title, req.grouping FROM assessments a
     JOIN requirements req ON req.id = a.requirement_id
     WHERE a.org_id = ? AND a.adoption_id = ? ORDER BY req.code`
  ).bind(ctx.repo.orgId, adoptionId).all();
  return json({ assessments: r.results || [] });
}

export async function updateAssessment(ctx, id, request) {
  require(ctx, "assessment.write");
  const input = validate(await readJson(request), {
    status:   { type: "string", enum: ["unassessed", "not_met", "partially_met", "met", "not_applicable"] },
    maturity: { type: "number", int: true, min: 0, max: 5 },
    note:     { type: "string", max: 4000 },
  });
  await ctx.repo.update("assessments", id, { ...input, updated_at: new Date().toISOString() });
  await ctx.repo.log(ctx.user.id, "assessment.update", "assessment", id, input);
  return json({ ok: true });
}

/* ── Controls ── */

export async function listControls(ctx) {
  const controls = await ctx.repo.list("controls", { order: "code" });
  const maps = await ctx.repo.raw(
    `SELECT cm.control_id, cm.requirement_id, r.code, r.framework_id FROM control_mappings cm
     JOIN controls c ON c.id = cm.control_id JOIN requirements r ON r.id = cm.requirement_id
     WHERE c.org_id = ?`
  ).bind(ctx.repo.orgId).all();
  const byControl = {};
  for (const m of maps.results || []) (byControl[m.control_id] ||= []).push(m);
  return json({ controls: controls.map((c) => ({ ...c, mappings: byControl[c.id] || [] })) });
}

const CONTROL_SPEC = {
  code:  { type: "string", max: 30 },
  title: { type: "string", max: 200 },
  description: { type: "string", max: 4000 },
  owner_id: { type: "string", max: 40 },
  status: { type: "string", enum: ["not_implemented", "in_progress", "implemented", "attention", "not_applicable"] },
  review_freq_days: { type: "number", int: true, min: 1, max: 3650 },
  requirement_ids: { type: "array", items: "string", max: 100 },
};

export async function createControl(ctx, request) {
  require(ctx, "control.write");
  const input = validate(await readJson(request), { ...CONTROL_SPEC,
    code: { ...CONTROL_SPEC.code, required: true }, title: { ...CONTROL_SPEC.title, required: true } });
  const { requirement_ids = [], ...fields } = input;
  if (fields.review_freq_days) fields.next_review = daysFromNow(fields.review_freq_days);
  const id = await ctx.repo.insert("controls", fields)
    .catch((e) => { throw String(e).includes("UNIQUE") ? new ApiError(409, "Control code exists") : e; });
  for (const rid of requirement_ids) {
    await ctx.env.DB.prepare("INSERT OR IGNORE INTO control_mappings (control_id, requirement_id) VALUES (?,?)")
      .bind(id, rid).run();
  }
  await ctx.repo.log(ctx.user.id, "control.create", "control", id, { code: input.code });
  return json({ id }, 201);
}

export async function updateControl(ctx, id, request) {
  require(ctx, "control.write");
  const input = validate(await readJson(request), CONTROL_SPEC);
  const { requirement_ids, ...fields } = input;
  if (fields.status === "implemented") {
    fields.last_review = new Date().toISOString();
    const c = await ctx.repo.get("controls", id);
    fields.next_review = daysFromNow(fields.review_freq_days || c.review_freq_days);
  }
  if (Object.keys(fields).length) await ctx.repo.update("controls", id, fields);
  if (requirement_ids) {
    await ctx.repo.get("controls", id); // tenancy check before join-table writes
    await ctx.env.DB.prepare("DELETE FROM control_mappings WHERE control_id = ?").bind(id).run();
    for (const rid of requirement_ids) {
      await ctx.env.DB.prepare("INSERT OR IGNORE INTO control_mappings (control_id, requirement_id) VALUES (?,?)")
        .bind(id, rid).run();
    }
  }
  await ctx.repo.log(ctx.user.id, "control.update", "control", id, input);
  return json({ ok: true });
}
