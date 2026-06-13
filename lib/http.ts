import { NextResponse } from "next/server";

/**
 * Generic JSON error response. Client-facing only — NEVER include stack traces,
 * internal messages, or secrets (Security: generic client errors). Pass a short,
 * user-safe message; log the real cause server-side separately if needed.
 */
export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Encode one NDJSON line (a single JSON object + trailing newline). */
export function ndjsonLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}
