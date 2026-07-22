/* Shared helpers: ids, JSON responses, errors. */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** ULID — sortable unique id (time prefix + crypto random). */
export function ulid() {
  let ts = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) { time = ALPHABET[ts % 32] + time; ts = Math.floor(ts / 32); }
  const rand = crypto.getRandomValues(new Uint8Array(16));
  let out = time;
  for (let i = 0; i < 16; i++) out += ALPHABET[rand[i] % 32];
  return out;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function errorResponse(err) {
  if (err instanceof ApiError) return json({ error: err.message }, err.status);
  console.error("unhandled:", err && err.stack || err);
  return json({ error: "Internal error" }, 500);
}

/** Days from now as ISO date string. */
export function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}
