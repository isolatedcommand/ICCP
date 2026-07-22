/**
 * Org-scoped repository layer — the ONLY way handlers touch tenant data.
 *
 * `withOrg(env, orgId)` returns helpers that inject `org_id = ?` into every
 * statement, so no handler can accidentally read or write another tenant's
 * rows. Library tables (frameworks / requirements / requirement_concepts) are
 * global and exposed read-only via `lib*` helpers.
 */

import { ulid, ApiError } from "./lib/util.js";

export function withOrg(env, orgId) {
  const db = env.DB;
  return {
    orgId,

    /** SELECT many rows from an org table. `where` fragments AND-ed after org scope. */
    async list(table, { where = "", params = [], order = "created_at DESC", limit = 200 } = {}) {
      const sql = `SELECT * FROM ${table} WHERE org_id = ?${where ? ` AND ${where}` : ""} ORDER BY ${order} LIMIT ?`;
      const r = await db.prepare(sql).bind(orgId, ...params, limit).all();
      return r.results || [];
    },

    /** SELECT one row by id, 404 if absent. */
    async get(table, id) {
      const row = await db.prepare(`SELECT * FROM ${table} WHERE org_id = ? AND id = ?`).bind(orgId, id).first();
      if (!row) throw new ApiError(404, `${table.replace(/s$/, "")} not found`);
      return row;
    },

    /** INSERT with generated id + org_id. Returns the new id. */
    async insert(table, fields) {
      const id = fields.id || ulid();
      const cols = ["id", "org_id", ...Object.keys(fields).filter((k) => k !== "id")];
      const vals = [id, orgId, ...Object.keys(fields).filter((k) => k !== "id").map((k) => fields[k])];
      const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
      await db.prepare(sql).bind(...vals).run();
      return id;
    },

    /** UPDATE by id within the org. */
    async update(table, id, fields) {
      const keys = Object.keys(fields);
      if (!keys.length) return;
      const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE org_id = ? AND id = ?`;
      const r = await db.prepare(sql).bind(...keys.map((k) => fields[k]), orgId, id).run();
      if (!r.meta || r.meta.changes === 0) throw new ApiError(404, `${table.replace(/s$/, "")} not found`);
    },

    /** Raw prepared statement — caller MUST scope by org_id in the SQL. */
    raw(sql) { return db.prepare(sql); },

    /** Append-only audit trail. */
    async log(actorId, action, entityType, entityId, detail = "") {
      await db.prepare(
        "INSERT INTO activity_logs (id, org_id, actor_id, action, entity_type, entity_id, detail) VALUES (?,?,?,?,?,?,?)"
      ).bind(ulid(), orgId, actorId, action, entityType, entityId,
             typeof detail === "string" ? detail : JSON.stringify(detail)).run();
    },
  };
}

/* ── Global library (read-only) ─────────────────────────────────────────── */

export async function libFrameworks(env) {
  const r = await env.DB.prepare("SELECT * FROM frameworks ORDER BY name").all();
  return r.results || [];
}

export async function libRequirements(env, frameworkId) {
  const r = await env.DB.prepare(
    "SELECT * FROM requirements WHERE framework_id = ? ORDER BY code"
  ).bind(frameworkId).all();
  return r.results || [];
}

/** Sibling requirements sharing a concept — the cross-framework fan-out. */
export async function libRelated(env, requirementId) {
  const r = await env.DB.prepare(
    `SELECT DISTINCT req.*, rc2.concept FROM requirement_concepts rc1
     JOIN requirement_concepts rc2 ON rc2.concept = rc1.concept
     JOIN requirements req ON req.id = rc2.requirement_id
     WHERE rc1.requirement_id = ? AND rc2.requirement_id != ?`
  ).bind(requirementId, requirementId).all();
  return r.results || [];
}

/** Resolve user by verified email, creating the row on first sight. */
export async function upsertUser(env, email) {
  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    const id = ulid();
    await env.DB.prepare("INSERT INTO users (id, email) VALUES (?, ?)").bind(id, email).run();
    user = { id, email, name: "" };
  }
  await env.DB.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").bind(user.id).run();
  return user;
}

/** Membership for user in org — the authorisation anchor. 403 if absent. */
export async function requireMembership(env, userId, orgId) {
  const m = await env.DB.prepare(
    "SELECT * FROM memberships WHERE user_id = ? AND org_id = ?"
  ).bind(userId, orgId).first();
  if (!m) throw new ApiError(403, "Not a member of this organisation");
  return m;
}
