import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS } from "@/lib/constants";

// Persistent Postgres-counter rate limiter. One bucket row per
// (user_id, window_start) where window_start is the floor of now() to a fixed
// RATE_LIMIT_WINDOW_SECONDS window. The increment is atomic (a single SQL
// upsert via the increment_rate_limit() function — see 0004_ratelimit.sql), so
// concurrent serverless invocations cannot race. State lives in Postgres, so it
// survives cold starts.

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/** Floor `now` to the start of its fixed window, as an ISO timestamp. */
function windowStart(nowMs: number): string {
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;
  const bucketMs = Math.floor(nowMs / windowMs) * windowMs;
  return new Date(bucketMs).toISOString();
}

/**
 * Atomically count this call against the user's current window.
 * Returns whether the call is allowed and how many remain in the window.
 * Fails OPEN on infrastructure error (a limiter outage must not take the app
 * down) — the LLM endpoints still validate input independently.
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const start = windowStart(Date.now());

  const { data, error } = await serviceClient().rpc("increment_rate_limit", {
    p_user_id: userId,
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
