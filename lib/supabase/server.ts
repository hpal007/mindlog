import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// LOCKED Supabase access. Server-side only — the service-role key must NEVER
// reach the client. Routes use the service-role client and filter by an
// explicit user_id (seeded demo session under the 1hr clock); RLS policies
// remain ON so the per-user isolation story is real and testable.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

let _service: SupabaseClient | null = null;

/** Service-role client — full access, server-only. Bypasses RLS; routes scope
 *  every query by an explicit user_id. */
export function serviceClient(): SupabaseClient {
  if (_service) return _service;
  _service = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _service;
}

/** True when Supabase env is configured. Lets routes degrade gracefully in
 *  local/dev before keys are pasted in. */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
