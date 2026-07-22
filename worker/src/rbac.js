/**
 * RBAC — deny-by-default permission matrix.
 * Roles: owner, compliance_manager, security_engineer, auditor, contributor, viewer.
 * Route handlers call `require(ctx, "permission")`; anything not granted is a 403.
 */

import { ApiError } from "./lib/util.js";

const MATRIX = {
  "org.manage":            ["owner"],
  "framework.adopt":       ["owner", "compliance_manager"],
  "assessment.write":      ["owner", "compliance_manager"],
  "control.write":         ["owner", "compliance_manager", "security_engineer"],
  "evidence.write":        ["owner", "compliance_manager", "security_engineer", "contributor"],
  "evidence.approve":      ["owner", "compliance_manager"],
  "risk.write":            ["owner", "compliance_manager", "security_engineer"],
  "policy.write":          ["owner", "compliance_manager"],
  "policy.acknowledge":    ["owner", "compliance_manager", "security_engineer", "contributor", "viewer"],
  "audit.write":           ["owner", "compliance_manager", "auditor"],
  "integration.manage":    ["owner", "security_engineer"],
  "read":                  ["owner", "compliance_manager", "security_engineer", "auditor", "contributor", "viewer"],
};

export function can(role, permission) {
  const allowed = MATRIX[permission];
  return Boolean(allowed && allowed.includes(role));
}

/** Throws 403 unless the membership's role holds the permission. */
export function require(ctx, permission) {
  if (!can(ctx.membership.role, permission)) {
    throw new ApiError(403, `Forbidden: requires ${permission}`);
  }
}

export const ROLES = Object.freeze([
  "owner", "compliance_manager", "security_engineer", "auditor", "contributor", "viewer",
]);
