/**
 * Cloudflare Access authentication — every request to /api/* passes here.
 *
 * Access (Google / Microsoft / email OTP IdPs) authenticates at the edge and
 * forwards an RS256 JWT (`Cf-Access-Jwt-Assertion` header / `CF_Authorization`
 * cookie). The Worker independently verifies:
 *   1. Signature against the team's public JWKS.
 *   2. `iss` equals the configured team domain.
 *   3. `aud` includes the configured Access application AUD.
 *   4. `exp` / `nbf` currently valid.
 *
 * Configure via Worker vars: ACCESS_TEAM_DOMAIN, ACCESS_AUD.
 * DEV_BYPASS_EMAIL (local dev only) short-circuits verification.
 */

import { ApiError } from "./lib/util.js";

let jwksCache = { url: null, keys: null, exp: 0 };

function b64urlToBytes(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat(s.length % 4 ? 4 - (s.length % 4) : 0);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function getToken(request) {
  const header = request.headers.get("cf-access-jwt-assertion");
  if (header) return header;
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1] : null;
}

async function getJwks(certsUrl) {
  const now = Date.now();
  if (jwksCache.url === certsUrl && jwksCache.keys && now < jwksCache.exp) return jwksCache.keys;
  const res = await fetch(certsUrl, { cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new ApiError(503, "Unable to fetch Access signing keys");
  const { keys } = await res.json();
  jwksCache = { url: certsUrl, keys, exp: now + 3600_000 };
  return keys;
}

/** Verify the Access JWT; returns { email } or throws 401/503. */
export async function authenticate(request, env) {
  if (env.DEV_BYPASS_EMAIL) return { email: env.DEV_BYPASS_EMAIL };

  let teamDomain = (env.ACCESS_TEAM_DOMAIN || "").trim().replace(/\/$/, "");
  const aud = (env.ACCESS_AUD || "").trim();
  if (teamDomain && !/^https?:\/\//i.test(teamDomain)) teamDomain = "https://" + teamDomain;
  if (!teamDomain || !aud) throw new ApiError(503, "Access not configured (ACCESS_TEAM_DOMAIN / ACCESS_AUD)");

  const token = getToken(request);
  if (!token) throw new ApiError(401, "Authentication required");

  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiError(401, "Malformed token");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== teamDomain) throw new ApiError(401, "Invalid token issuer");
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) throw new ApiError(401, "Invalid token audience");
  if (typeof payload.exp !== "number" || payload.exp < now) throw new ApiError(401, "Token expired");
  if (typeof payload.nbf === "number" && payload.nbf > now + 60) throw new ApiError(401, "Token not yet valid");

  const keys = await getJwks(teamDomain + "/cdn-cgi/access/certs");
  const jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) throw new ApiError(401, "Unknown signing key");

  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
  if (!ok) throw new ApiError(401, "Invalid token signature");

  const email = String(payload.email || "").toLowerCase();
  if (!email) throw new ApiError(401, "Token carries no identity");
  return { email };
}
