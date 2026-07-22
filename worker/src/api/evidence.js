/* Evidence lifecycle: upload → pending_review → approve/reject → expiry. */

import { json, daysFromNow, ApiError } from "../lib/util.js";
import { readJson, validate } from "../lib/validate.js";
import { require } from "../rbac.js";

const MAX_UPLOAD = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = [
  "application/pdf", "image/png", "image/jpeg", "text/plain", "text/csv",
  "application/json", "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function list(ctx, url) {
  const status = url.searchParams.get("status");
  const rows = await ctx.repo.list("evidence", status
    ? { where: "status = ?", params: [status] } : {});
  const links = await ctx.repo.raw(
    `SELECT ec.evidence_id, c.code, c.title FROM evidence_controls ec
     JOIN evidence e ON e.id = ec.evidence_id JOIN controls c ON c.id = ec.control_id
     WHERE e.org_id = ?`
  ).bind(ctx.repo.orgId).all();
  const byEv = {};
  for (const l of links.results || []) (byEv[l.evidence_id] ||= []).push(l);
  return json({ evidence: rows.map((e) => ({ ...e, controls: byEv[e.id] || [] })) });
}

/** POST /evidence — metadata first; returns id used for the binary upload. */
export async function create(ctx, request) {
  require(ctx, "evidence.write");
  const input = validate(await readJson(request), {
    name:        { type: "string", required: true, max: 200 },
    description: { type: "string", max: 4000 },
    valid_days:  { type: "number", int: true, min: 1, max: 3650 },
    control_ids: { type: "array", items: "string", max: 50 },
  });
  const { control_ids = [], ...fields } = input;
  const id = await ctx.repo.insert("evidence", { ...fields, created_by: ctx.membership.id });
  for (const cid of control_ids) {
    await ctx.repo.get("controls", cid); // tenancy check
    await ctx.env.DB.prepare("INSERT OR IGNORE INTO evidence_controls (evidence_id, control_id) VALUES (?,?)")
      .bind(id, cid).run();
  }
  await ctx.repo.log(ctx.user.id, "evidence.create", "evidence", id, { name: input.name });
  return json({ id }, 201);
}

/** PUT /evidence/:id/file — binary body straight to R2 (streamed). */
export async function upload(ctx, id, request) {
  require(ctx, "evidence.write");
  const ev = await ctx.repo.get("evidence", id);
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  const size = Number(request.headers.get("content-length") || 0);
  const name = decodeURIComponent(request.headers.get("x-file-name") || "file");
  if (!ALLOWED_TYPES.includes(type)) throw new ApiError(415, `File type not allowed: ${type}`);
  if (!size || size > MAX_UPLOAD) throw new ApiError(413, "File missing or exceeds 50 MB");
  if (/[\/\\]/.test(name)) throw new ApiError(400, "Invalid file name");

  const version = (ev.version || 1) + (ev.r2_key ? 1 : 0);
  const key = `org/${ctx.repo.orgId}/evidence/${id}/${version}/${name}`;
  await ctx.env.EVIDENCE.put(key, request.body, {
    httpMetadata: { contentType: type, contentDisposition: `attachment; filename="${name}"` },
  });
  await ctx.repo.update("evidence", id, {
    r2_key: key, file_name: name, content_type: type, size_bytes: size,
    version, status: "pending_review",
  });
  await ctx.repo.log(ctx.user.id, "evidence.upload", "evidence", id, { file: name, version });
  return json({ ok: true, version });
}

/** GET /evidence/:id/file — tenancy-checked download from R2. */
export async function download(ctx, id) {
  const ev = await ctx.repo.get("evidence", id);
  if (!ev.r2_key) throw new ApiError(404, "No file uploaded");
  const obj = await ctx.env.EVIDENCE.get(ev.r2_key);
  if (!obj) throw new ApiError(404, "Object missing from storage");
  return new Response(obj.body, {
    headers: {
      "content-type": ev.content_type || "application/octet-stream",
      "content-disposition": `attachment; filename="${ev.file_name}"`,
      "cache-control": "no-store",
    },
  });
}

/** POST /evidence/:id/review — approve/reject (evidence.approve). */
export async function review(ctx, id, request) {
  require(ctx, "evidence.approve");
  const input = validate(await readJson(request), {
    decision: { type: "string", required: true, enum: ["approved", "rejected"] },
    comment:  { type: "string", max: 2000 },
  });
  const ev = await ctx.repo.get("evidence", id);
  if (ev.status !== "pending_review") throw new ApiError(409, `Evidence is ${ev.status}, not pending_review`);
  await ctx.repo.insert("evidence_reviews", {
    evidence_id: id, reviewer_id: ctx.membership.id,
    decision: input.decision, comment: input.comment || "",
  });
  const fields = { status: input.decision };
  if (input.decision === "approved") {
    fields.approved_at = new Date().toISOString();
    fields.expires_at = daysFromNow(ev.valid_days || 365);
  }
  await ctx.repo.update("evidence", id, fields);
  await ctx.repo.log(ctx.user.id, `evidence.${input.decision}`, "evidence", id, { comment: input.comment });
  return json({ ok: true });
}

/** Sweep: mark approved-but-past-expiry evidence expired; flag controls. */
export async function sweepExpiry(env) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE evidence SET status = 'expired' WHERE status = 'approved' AND expires_at IS NOT NULL AND expires_at < ?"
  ).bind(now).run();
  await env.DB.prepare(
    `UPDATE controls SET status = 'attention' WHERE status = 'implemented' AND id IN (
       SELECT ec.control_id FROM evidence_controls ec
       JOIN evidence e ON e.id = ec.evidence_id WHERE e.status = 'expired')`
  ).run();
}
