/* Organisations & membership management. */

import { json, ulid, ApiError } from "../lib/util.js";
import { readJson, validate } from "../lib/validate.js";
import { require, ROLES } from "../rbac.js";

/** GET /api/v1/me — identity + organisations. */
export async function me(env, user) {
  const r = await env.DB.prepare(
    `SELECT o.id, o.slug, o.name, m.role FROM memberships m
     JOIN organisations o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.name`
  ).bind(user.id).all();
  return json({ user: { id: user.id, email: user.email, name: user.name }, organisations: r.results || [] });
}

/** POST /api/v1/orgs — create org; creator becomes owner. */
export async function createOrg(env, user, request) {
  const input = validate(await readJson(request), {
    name: { type: "string", required: true, max: 120 },
    slug: { type: "string", required: true, max: 60 },
  });
  if (!/^[a-z0-9][a-z0-9-]*$/.test(input.slug)) throw new ApiError(400, "slug must be lowercase alphanumeric/hyphen");
  const orgId = ulid();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO organisations (id, slug, name) VALUES (?,?,?)").bind(orgId, input.slug, input.name),
      env.DB.prepare("INSERT INTO memberships (id, org_id, user_id, role) VALUES (?,?,?,?)").bind(ulid(), orgId, user.id, "owner"),
    ]);
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new ApiError(409, "Organisation slug already taken");
    throw e;
  }
  return json({ id: orgId, slug: input.slug, name: input.name }, 201);
}

/** GET /members */
export async function listMembers(ctx) {
  const r = await ctx.repo.raw(
    `SELECT m.id, m.role, m.created_at, u.email, u.name FROM memberships m
     JOIN users u ON u.id = m.user_id WHERE m.org_id = ? ORDER BY u.email`
  ).bind(ctx.repo.orgId).all();
  return json({ members: r.results || [] });
}

/** POST /members — invite by email (org.manage). */
export async function addMember(ctx, request) {
  require(ctx, "org.manage");
  const input = validate(await readJson(request), {
    email: { type: "string", required: true, max: 254 },
    role:  { type: "string", required: true, enum: [...ROLES] },
  });
  const email = input.email.toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, "Invalid email");
  let u = await ctx.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!u) {
    u = { id: ulid(), email };
    await ctx.env.DB.prepare("INSERT INTO users (id, email) VALUES (?,?)").bind(u.id, email).run();
  }
  const id = ulid();
  try {
    await ctx.env.DB.prepare("INSERT INTO memberships (id, org_id, user_id, role) VALUES (?,?,?,?)")
      .bind(id, ctx.repo.orgId, u.id, input.role).run();
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new ApiError(409, "Already a member");
    throw e;
  }
  await ctx.repo.log(ctx.user.id, "member.add", "membership", id, { email, role: input.role });
  return json({ id, email, role: input.role }, 201);
}

/** GET /activity — audit trail (read). */
export async function activity(ctx) {
  const rows = await ctx.repo.list("activity_logs", { order: "created_at DESC", limit: 100 });
  return json({ activity: rows });
}
