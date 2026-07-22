/**
 * Public demo environment.
 *
 * Requests arriving on DEMO_HOST bypass Cloudflare Access and act as a shared
 * demo identity inside one fixed demo organisation. Visitors get a
 * compliance_manager role so every module is usable, but they can never reach
 * another tenant: the router pins the org id, and the repository layer scopes
 * every query. A daily cron wipes the demo org's data and reseeds it.
 */

import { ulid, daysFromNow } from "./lib/util.js";
import { withOrg } from "./db.js";

export const DEMO_HOST = "compliance-demo.isolatedcommand.com";
export const DEMO_ORG_ID = "01DEMO0000000000000000000000";
const DEMO_USER_EMAIL = "demo@isolatedcommand.com";

export function isDemoRequest(url, env) {
  if (url.hostname === DEMO_HOST) return true;
  // Local dev convenience: ?demo=1 while DEV_BYPASS_EMAIL is set.
  return Boolean(env.DEV_BYPASS_EMAIL && url.searchParams.get("demo") === "1");
}

/** Demo identity + guaranteed org/membership. Returns { user, membership }. */
export async function demoContext(env) {
  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(DEMO_USER_EMAIL).first();
  if (!user) {
    user = { id: ulid(), email: DEMO_USER_EMAIL, name: "Demo user" };
    await env.DB.prepare("INSERT INTO users (id, email, name) VALUES (?,?,?)")
      .bind(user.id, user.email, user.name).run();
  }
  let org = await env.DB.prepare("SELECT * FROM organisations WHERE id = ?").bind(DEMO_ORG_ID).first();
  if (!org) {
    await env.DB.prepare("INSERT INTO organisations (id, slug, name) VALUES (?,?,?)")
      .bind(DEMO_ORG_ID, "demo", "Demo Organisation").run();
    await seedDemoData(env);
  }
  let membership = await env.DB.prepare(
    "SELECT * FROM memberships WHERE org_id = ? AND user_id = ?").bind(DEMO_ORG_ID, user.id).first();
  if (!membership) {
    membership = { id: ulid(), org_id: DEMO_ORG_ID, user_id: user.id, role: "compliance_manager" };
    await env.DB.prepare("INSERT INTO memberships (id, org_id, user_id, role) VALUES (?,?,?,?)")
      .bind(membership.id, DEMO_ORG_ID, user.id, membership.role).run();
  }
  return { user, membership };
}

/** Nightly: wipe the demo org's tenant data (keep org + membership), reseed. */
export async function resetDemo(env) {
  const org = await env.DB.prepare("SELECT id FROM organisations WHERE id = ?").bind(DEMO_ORG_ID).first();
  if (!org) return;
  const oid = DEMO_ORG_ID;
  // Join-table rows first (no org_id column), then org-scoped tables.
  const stmts = [
    `DELETE FROM policy_acknowledgements WHERE policy_version_id IN (SELECT id FROM policy_versions WHERE org_id = '${oid}')`,
    `DELETE FROM evidence_controls WHERE evidence_id IN (SELECT id FROM evidence WHERE org_id = '${oid}')`,
    `DELETE FROM control_mappings WHERE control_id IN (SELECT id FROM controls WHERE org_id = '${oid}')`,
    `DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE org_id = '${oid}')`,
  ].map((s) => env.DB.prepare(s));
  for (const t of ["integration_checks", "integrations", "audit_evidence_requests", "audit_findings",
    "audits", "policy_versions", "policies", "risk_treatments", "risks", "evidence_reviews",
    "evidence", "assessments", "framework_adoptions", "controls", "teams", "activity_logs"]) {
    stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE org_id = ?`).bind(oid));
  }
  await env.DB.batch(stmts);
  // Evidence objects in R2.
  const listed = await env.EVIDENCE.list({ prefix: `org/${oid}/` });
  if (listed.objects.length) await env.EVIDENCE.delete(listed.objects.map((o) => o.key));
  await seedDemoData(env);
}

/** A showcase-rich tenant: adoptions, assessments, controls, evidence, risks, policies, audit. */
export async function seedDemoData(env) {
  const repo = withOrg(env, DEMO_ORG_ID);

  // Adopt ISO 27001 + Cyber Trust Mark, with a mixed assessment picture.
  const adoptions = {};
  for (const fw of ["iso27001-2022", "sg-ctm"]) {
    adoptions[fw] = await repo.insert("framework_adoptions", { framework_id: fw, target_date: daysFromNow(180) });
    const reqs = await env.DB.prepare("SELECT id FROM requirements WHERE framework_id = ?").bind(fw).all();
    const rows = reqs.results || [];
    const stmts = rows.map((r, i) => {
      const status = i % 4 === 0 ? "met" : i % 4 === 1 ? "partially_met" : i % 4 === 2 ? "met" : "unassessed";
      const maturity = status === "met" ? 3 + (i % 2) : status === "partially_met" ? 2 : 0;
      return env.DB.prepare(
        "INSERT INTO assessments (id, org_id, adoption_id, requirement_id, status, maturity) VALUES (?,?,?,?,?,?)"
      ).bind(ulid(), DEMO_ORG_ID, adoptions[fw], r.id, status, maturity);
    });
    for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  }

  // Controls mapped across frameworks.
  const controls = [
    ["CTL-001", "Logical access control & least privilege", "implemented", ["iso27001-2022/A.5.15", "sg-ctm/B6"]],
    ["CTL-002", "Multi-factor authentication on external services", "implemented", ["iso27001-2022/A.5.17", "cis-v8/6.3"]],
    ["CTL-003", "Quarterly privileged access review", "in_progress", ["iso27001-2022/A.8.2", "soc2-2017/CC6.3"]],
    ["CTL-004", "Vulnerability scanning & patch SLAs", "implemented", ["iso27001-2022/A.8.8", "sg-ctm/B8"]],
    ["CTL-005", "Tested, isolated backups", "attention", ["iso27001-2022/A.8.13", "sg-ctm/B10"]],
    ["CTL-006", "Security awareness programme", "not_implemented", ["iso27001-2022/A.6.3", "sg-ctm/B14"]],
  ];
  const controlIds = {};
  for (const [code, title, status, reqs] of controls) {
    const id = await repo.insert("controls", {
      code, title, status, review_freq_days: 90,
      last_review: status === "implemented" ? new Date().toISOString() : null,
      next_review: daysFromNow(status === "attention" ? 7 : 90),
    });
    controlIds[code] = id;
    for (const rid of reqs) {
      await env.DB.prepare("INSERT OR IGNORE INTO control_mappings (control_id, requirement_id) VALUES (?,?)").bind(id, rid).run();
    }
  }

  // Evidence in every lifecycle state.
  const demoMember = await env.DB.prepare(
    "SELECT id FROM memberships WHERE org_id = ? LIMIT 1").bind(DEMO_ORG_ID).first();
  const creator = demoMember ? demoMember.id : "demo";
  const evidence = [
    ["Q2 Privileged Access Review", "approved", 90, "CTL-003"],
    ["MFA configuration export — IdP", "approved", 180, "CTL-002"],
    ["Vulnerability scan report — June", "pending_review", 90, "CTL-004"],
    ["Backup restore test record", "expired", 30, "CTL-005"],
    ["Access Control Policy v3 (signed)", "approved", 365, "CTL-001"],
  ];
  for (const [name, status, valid_days, ctl] of evidence) {
    const fields = { name, status, valid_days, created_by: creator, file_name: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf", content_type: "application/pdf", size_bytes: 84213 };
    if (status === "approved") { fields.approved_at = new Date().toISOString(); fields.expires_at = daysFromNow(valid_days); }
    if (status === "expired") { fields.approved_at = daysFromNow(-60); fields.expires_at = daysFromNow(-5); }
    const id = await repo.insert("evidence", fields);
    await env.DB.prepare("INSERT OR IGNORE INTO evidence_controls (evidence_id, control_id) VALUES (?,?)").bind(id, controlIds[ctl]).run();
  }

  // Risk register across severities.
  const risks = [
    ["RSK-001", "Stale privileged accounts in IdP", 4, 5, "treating"],
    ["RSK-002", "Backup restore never exercised for file store", 3, 4, "open"],
    ["RSK-003", "Shadow SaaS without security review", 3, 3, "open"],
    ["RSK-004", "Laptop disk encryption gaps", 2, 2, "accepted"],
  ];
  for (const [code, title, likelihood, impact, status] of risks) {
    await repo.insert("risks", { code, title, likelihood, impact, status, category: "security" });
  }

  // Policies with a version each.
  for (const title of ["Information Security Policy", "Access Control Policy", "Incident Response Policy"]) {
    const pid = await repo.insert("policies", { title, status: "approved", review_freq_days: 365, next_review: daysFromNow(200) });
    await repo.insert("policy_versions", {
      policy_id: pid, version: 1, changelog: "Initial approved version",
      body_md: `# ${title}\n\nDemo policy content — replace with your organisation's own.`,
      approved_at: new Date().toISOString(),
    });
  }

  // An audit in fieldwork with findings.
  const auditId = await repo.insert("audits", {
    name: "ISO 27001 internal audit — demo cycle", framework_id: "iso27001-2022",
    starts_on: daysFromNow(-7), ends_on: daysFromNow(21), status: "fieldwork",
  });
  await repo.insert("audit_findings", {
    audit_id: auditId, severity: "major", title: "Backup restoration not tested in 12 months",
    control_id: controlIds["CTL-005"], requirement_id: "iso27001-2022/A.8.13",
    corrective_action: "Schedule quarterly restore tests; document results.", due_date: daysFromNow(30), status: "in_progress",
  });
  await repo.insert("audit_findings", {
    audit_id: auditId, severity: "minor", title: "Awareness training completion below 90%",
    requirement_id: "iso27001-2022/A.6.3", status: "open",
  });
}
