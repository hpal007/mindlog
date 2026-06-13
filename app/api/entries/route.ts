// POST /api/entries — journal → streamed analysis → (crisis | coping exercise).
// GET  /api/entries — RLS-scoped history.
//
// Orchestration per SPEC "API Contracts": validate → rate-limit → deterministic
// keyword backstop + ONE structured streaming Gemini analysis → dual-signal
// crisis short-circuit OR self-growing-library recommend. Streams analysis
// tokens as NDJSON as they arrive (real streaming for Efficiency), then emits a
// single JSON tail line. Input is Zod-validated; model output is already
// Zod-validated by Lane B but we never trust it blindly. Errors are generic.
import "server-only";

import {
  journalEntryInputSchema,
  crisisPayloadSchema,
  recommendedExerciseSchema,
  entriesResultSchema,
  type RecommendedExercise,
  type EntriesResult,
} from "@/lib/schemas";
import { db } from "@/lib/db";
import { analyzeEntry } from "@/lib/ai/gemini";
import { keywordRisk } from "@/lib/safety/classifier";
import { recommendExercise } from "@/lib/library/recommend";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  DEMO_USER_ID,
  GEMINI_MODEL,
  HELPLINES,
  CRISIS_GROUNDING_MESSAGE,
} from "@/lib/constants";
import { jsonError, ndjsonLine } from "@/lib/http";
import type { EntryAnalysis } from "@/lib/schemas";
import type { CopingExerciseRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const maxDuration = 60; // allow Gemini streaming to run past the 10s default

// ---------------------------------------------------------------------------
// POST — orchestrate analysis → crisis / coping. Streams NDJSON.
// ---------------------------------------------------------------------------
export async function POST(req: Request): Promise<Response> {
  const userId = DEMO_USER_ID;

  try {
    // 1) Rate-limit paid (LLM) endpoint first.
    const limit = await checkRateLimit(userId);
    if (!limit.allowed) {
      return jsonError(429, "You're doing that a lot. Please try again shortly.");
    }

    // 2) Parse + validate input.
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonError(400, "Invalid input");
    }
    const parsed = journalEntryInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "Invalid input");
    }
    const input = parsed.data;

    // 3) Deterministic keyword backstop (cheap, no LLM) — one signal of the
    //    dual-signal crisis gate. Computed up front so a model miss still trips.
    const kwRisk = keywordRisk(input.body);

    // 4) Persist the entry before streaming so the analysis/crisis rows can FK to it.
    const entry = await db.insertEntry(userId, input);

    // 5) Stream: consume the analyze() async iterable, forward tokens as NDJSON,
    //    capture the final structured analysis, then branch crisis vs coping.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const finish = (line: unknown) => {
          controller.enqueue(ndjsonLine(line));
          controller.close();
        };

        try {
          let analysis: EntryAnalysis | null = null;

          for await (const ev of analyzeEntry(input.body)) {
            if (ev.type === "token") {
              if (ev.text) controller.enqueue(ndjsonLine({ type: "token", text: ev.text }));
            } else if (ev.type === "analysis") {
              analysis = ev.analysis;
            }
          }

          // analyzeEntry always yields a final analysis (it falls back internally),
          // but be defensive about model output regardless.
          if (!analysis) {
            finish({
              type: "result",
              result: {
                risk: "acute" as const,
                message: CRISIS_GROUNDING_MESSAGE,
                helplines: HELPLINES,
              },
            });
            return;
          }

          // 6) DUAL-SIGNAL crisis gate. Either signal can trip acute; the keyword
          //    backstop can also elevate a model "none"/"elevated".
          const modelRisk = analysis.risk_level;
          const isAcute = kwRisk === "acute" || modelRisk === "acute";
          const effectiveRisk: EntryAnalysis["risk_level"] = isAcute
            ? "acute"
            : kwRisk === "elevated" || modelRisk === "elevated"
              ? "elevated"
              : "none";

          // Persist the analysis with the elevated effective risk so trends/history
          // reflect the safety backstop, not just the model's self-assessment.
          const persistedAnalysis: EntryAnalysis = { ...analysis, risk_level: effectiveRisk };

          // --- ACUTE: short-circuit. No coping exercise. Crisis resources only. ---
          if (isAcute) {
            await db.insertAnalysis(userId, entry.id, persistedAnalysis, GEMINI_MODEL);
            const crisis = crisisPayloadSchema.parse({
              risk: "acute" as const,
              message: CRISIS_GROUNDING_MESSAGE,
              helplines: HELPLINES,
            });
            await db.insertCrisisEvent(userId, entry.id, "acute", crisis);
            finish({ type: "result", result: crisis });
            return;
          }

          // --- NOT ACUTE: persist analysis, then recommend a coping exercise. ---
          const analysisRow = await db.insertAnalysis(
            userId,
            entry.id,
            persistedAnalysis,
            GEMINI_MODEL,
          );

          const recommendation = await buildRecommendation(
            userId,
            entry.id,
            persistedAnalysis,
          );

          const result: EntriesResult = entriesResultSchema.parse({
            analysisId: analysisRow.id,
            entryId: entry.id,
            analysis: persistedAnalysis,
            recommendation,
          });
          finish({ type: "result", result });
        } catch {
          // Mid-stream failure: emit a safe terminal line and close. We can't set
          // an HTTP status here (headers already sent), so surface a generic error
          // object the client can render without leaking internals.
          try {
            controller.enqueue(
              ndjsonLine({ type: "error", error: "Something went wrong analyzing your entry." }),
            );
          } catch {
            /* controller may already be closed */
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    // Pre-stream failure (rate-limit/db/parse infra). Generic 500.
    return jsonError(500, "Something went wrong. Please try again.");
  }
}

/**
 * Run the self-growing library decision and persist its side effects, returning
 * a client-facing RecommendedExercise (or null if nothing could be recommended).
 */
async function buildRecommendation(
  userId: string,
  entryId: string,
  analysis: EntryAnalysis,
): Promise<RecommendedExercise | null> {
  try {
    const exercises = await db.getActiveExercises();
    const triggers = analysis.triggers.map((t) => t.label);

    const decision = await recommendExercise({
      triggers,
      analysisSummary: analysis.summary,
      exercises,
    });

    if (decision.kind === "match") {
      const matched = exercises.find((e) => e.id === decision.exerciseId);
      if (!matched) return null;
      await db.incrementUsage(matched.id);
      const rec = await db.insertRecommendation(userId, entryId, matched.id, decision.reason);
      return toRecommendedExercise(matched, decision.reason, rec.id);
    }

    // kind === "generate": persist the freshly generated exercise, then recommend it.
    const ex = decision.exercise;
    const slug = slugify(ex.title);
    const row = await db.insertGeneratedExercise({
      slug,
      title: ex.title,
      technique: ex.technique,
      category: ex.category,
      addresses_triggers: ex.addresses_triggers,
      steps: ex.steps,
      pros: ex.pros ?? null,
      evidence_basis: ex.evidence_basis ?? null,
    });
    const rec = await db.insertRecommendation(userId, entryId, row.id, decision.reason);
    return toRecommendedExercise(row, decision.reason, rec.id);
  } catch {
    // Recommendation is best-effort — a failure here must not fail the whole entry.
    return null;
  }
}

/** Map a persisted exercise row → the client RecommendedExercise shape (Zod-validated). */
function toRecommendedExercise(
  row: CopingExerciseRow,
  reason: string,
  recommendationId: string,
): RecommendedExercise {
  return recommendedExerciseSchema.parse({
    id: row.id,
    slug: row.slug,
    title: row.title,
    technique: row.technique,
    category: row.category,
    addresses_triggers: row.addresses_triggers,
    steps: row.steps,
    pros: row.pros ?? undefined,
    evidence_basis: row.evidence_basis ?? undefined,
    source: row.source,
    reason,
    recommendation_id: recommendationId,
  });
}

/** URL-safe slug + short random suffix to keep the unique slug constraint satisfied. */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "exercise"}-${suffix}`;
}

// ---------------------------------------------------------------------------
// GET — RLS-scoped entry history.
// ---------------------------------------------------------------------------
export async function GET(): Promise<Response> {
  const userId = DEMO_USER_ID;
  try {
    const entries = await db.listEntries(userId);
    return Response.json({ entries });
  } catch {
    return jsonError(500, "Something went wrong loading your entries.");
  }
}
