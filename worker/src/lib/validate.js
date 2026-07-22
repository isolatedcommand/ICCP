/* Minimal declarative input validation — deny-by-default.
 * spec: { field: { type, required, max, enum, min, int } }
 * Returns a NEW object containing only declared fields (mass-assignment guard). */

import { ApiError } from "./util.js";

export function validate(body, spec) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Expected a JSON object body");
  }
  const out = {};
  for (const [field, rule] of Object.entries(spec)) {
    let v = body[field];
    if (v === undefined || v === null || v === "") {
      if (rule.required) throw new ApiError(400, `Missing required field: ${field}`);
      continue;
    }
    switch (rule.type) {
      case "string":
        if (typeof v !== "string") throw new ApiError(400, `${field} must be a string`);
        v = v.trim();
        if (rule.max && v.length > rule.max) throw new ApiError(400, `${field} exceeds ${rule.max} characters`);
        if (rule.enum && !rule.enum.includes(v)) throw new ApiError(400, `${field} must be one of: ${rule.enum.join(", ")}`);
        break;
      case "number":
        v = Number(v);
        if (!Number.isFinite(v)) throw new ApiError(400, `${field} must be a number`);
        if (rule.int && !Number.isInteger(v)) throw new ApiError(400, `${field} must be an integer`);
        if (rule.min !== undefined && v < rule.min) throw new ApiError(400, `${field} must be >= ${rule.min}`);
        if (rule.max !== undefined && v > rule.max) throw new ApiError(400, `${field} must be <= ${rule.max}`);
        break;
      case "array":
        if (!Array.isArray(v)) throw new ApiError(400, `${field} must be an array`);
        if (rule.max && v.length > rule.max) throw new ApiError(400, `${field} exceeds ${rule.max} items`);
        if (rule.items === "string" && !v.every((x) => typeof x === "string")) {
          throw new ApiError(400, `${field} must contain strings`);
        }
        break;
      case "date":
        if (typeof v !== "string" || isNaN(Date.parse(v))) throw new ApiError(400, `${field} must be an ISO date`);
        break;
      default:
        throw new ApiError(500, `Unknown validation type for ${field}`);
    }
    out[field] = v;
  }
  return out;
}

export async function readJson(request, maxBytes = 256 * 1024) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > maxBytes) throw new ApiError(413, "Body too large");
  try { return await request.json(); }
  catch { throw new ApiError(400, "Invalid JSON body"); }
}
