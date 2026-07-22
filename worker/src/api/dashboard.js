/* Dashboard aggregates: org score, framework progress, counters, upcoming. */

import { json } from "../lib/util.js";
import { severity } from "./grc.js";

export async function dashboard(ctx) {
  const orgId = ctx.repo.orgId;
  const db = ctx.env.DB;

  // Framework progress: met=1, partially_met=0.5 over assessable requirements.
  const fw = await db.prepare(
    `SELECT fa.id AS adoption_id, f.id AS framework_id, f.short_name, fa.target_date,
       SUM(CASE WHEN a.status = 'met' THEN 1.0 WHEN a.status = 'partially_met' THEN 0.5 ELSE 0 END) AS earned,
       SUM(CASE WHEN a.status != 'not_applicable' THEN 1 ELSE 0 END) AS assessable
     FROM framework_adoptions fa
     JOIN frameworks f ON f.id = fa.framework_id
     LEFT JOIN assessments a ON a.adoption_id = fa.id
     WHERE fa.org_id = ? AND fa.status = 'active' GROUP BY fa.id`
  ).bind(orgId).all();
  const frameworks = (fw.results || []).map((r) => ({
    adoption_id: r.adoption_id, framework_id: r.framework_id, short_name: r.short_name,
    target_date: r.target_date,
    percent: r.assessable ? Math.round((r.earned / r.assessable) * 100) : 0,
  }));
  const score = frameworks.length
    ? Math.round(frameworks.reduce((s, f) => s + f.percent, 0) / frameworks.length) : 0;

  const ev = await db.prepare(
    `SELECT status, COUNT(*) AS n FROM evidence WHERE org_id = ? GROUP BY status`
  ).bind(orgId).all();
  const evidence = Object.fromEntries((ev.results || []).map((r) => [r.status, r.n]));

  const rk = await db.prepare(
    `SELECT likelihood, impact FROM risks WHERE org_id = ? AND status NOT IN ('closed')`
  ).bind(orgId).all();
  const risk = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of rk.results || []) risk[severity(r.likelihood, r.impact)]++;

  const soon = new Date(Date.now() + 30 * 86400000).toISOString();
  const upcoming = [];
  const evExp = await db.prepare(
    `SELECT id, name, expires_at FROM evidence WHERE org_id = ? AND status = 'approved'
     AND expires_at < ? ORDER BY expires_at LIMIT 10`
  ).bind(orgId, soon).all();
  for (const e of evExp.results || []) upcoming.push({ type: "evidence_expiry", id: e.id, label: e.name, when: e.expires_at });
  const ctrlRev = await db.prepare(
    `SELECT id, code, title, next_review FROM controls WHERE org_id = ? AND next_review IS NOT NULL
     AND next_review < ? ORDER BY next_review LIMIT 10`
  ).bind(orgId, soon).all();
  for (const c of ctrlRev.results || []) upcoming.push({ type: "control_review", id: c.id, label: `${c.code} ${c.title}`, when: c.next_review });
  const polRev = await db.prepare(
    `SELECT id, title, next_review FROM policies WHERE org_id = ? AND next_review IS NOT NULL
     AND next_review < ? ORDER BY next_review LIMIT 10`
  ).bind(orgId, soon).all();
  for (const p of polRev.results || []) upcoming.push({ type: "policy_review", id: p.id, label: p.title, when: p.next_review });
  const audDue = await db.prepare(
    `SELECT id, name, ends_on FROM audits WHERE org_id = ? AND status != 'closed'
     AND ends_on IS NOT NULL AND ends_on < ? ORDER BY ends_on LIMIT 10`
  ).bind(orgId, soon).all();
  for (const a of audDue.results || []) upcoming.push({ type: "audit_deadline", id: a.id, label: a.name, when: a.ends_on });
  upcoming.sort((a, b) => String(a.when).localeCompare(String(b.when)));

  return json({ score, frameworks, evidence, risk, upcoming: upcoming.slice(0, 15) });
}
