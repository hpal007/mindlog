import "server-only";
import { createHash } from "node:crypto";
import { serviceClient } from "@/lib/supabase/server";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS, DEMO_USER_ID } from "@/lib/constants";

// Persistent Postgres-counter rate limiter. One bucket row per
// (key, window_start) where window_start is the floor of now() to a fixed
// RATE_LIMIT_WINDOW_SECONDS window. The increment is atomic (a single SQL
// upsert via the increment_rate_limit() function — see 0004_ratelimit.sql), so
// concurrent serverless invocations cannot race. State lives in Postgres, so it
// survives cold starts.
//
// Under the seeded-demo design every visitor shares one DEMO_USER_ID, so a
// single shared bucket would let one visitor lock out everyone. We instead key
// the bucket PER CLIENT: a deterministic uuid derived from the request IP, so
// each actor gets its own window. The rate_limits.user_id column is a bare uuid
// (no FK), so an IP-derived uuid is a valid, isolated bucket key.

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Derive a stable per-client bucket key (a uuid) from the request's client IP.
 * Falls back to the seeded demo user when no IP header is present (e.g. local).
 * Server-side only; the IP comes from the platform's forwarded headers.
 */
export function rateLimitKeyFromRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip"))?.trim();
  if (!ip) return DEMO_USER_ID;
  // sha256(ip) → first 32 hex chars formatted as a uuid (8-4-4-4-12).
  const h = createHash("sha256").update(ip).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Floor `now` to the start of its fixed window, as an ISO timestamp. */
function windowStart(nowMs: number): string {
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;
  const bucketMs = Math.floor(nowMs / windowMs) * windowMs;
  return new Date(bucketMs).toISOString();
}

/**
 * Atomically count this call against the given bucket key's current window.
 * `key` is a per-client uuid (see rateLimitKeyFromRequest), so each actor is
 * throttled independently. Returns whether the call is allowed and how many
 * remain in the window. Fails OPEN on infrastructure error: this is a wellness
 * companion, so a counter outage must never hard-block a student mid-journal;
 * per-client keying bounds the abuse surface even when it fails open.
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const start = windowStart(Date.now());

  const { data, error } = await serviceClient().rpc("increment_rate_limit", {
    p_user_id: key,
    p_window_start: start,
  });

  if (error || typeof data !== "number") {
    // Fail open — never hard-block the user on a counter outage.
    return { allowed: true, remaining: RATE_LIMIT_MAX };
  }

  const count = data;
  const remaining = Math.max(0, RATE_LIMIT_MAX - count);
  return { allowed: count <= RATE_LIMIT_MAX, remaining };
}
