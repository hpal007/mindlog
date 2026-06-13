// Lane B — self-growing exercise library: match an existing exercise OR
// generate + validate + dedup a new one. Pure decision logic only — this module
// NEVER touches the DB; the route persists based on the decision returned here.
import { LIBRARY_MATCH_THRESHOLD } from "@/lib/constants";
import type { CopingExerciseRow } from "@/lib/db/types";
import type {
  RecommendExercise,
  RecommendArgs,
  RecommendDecision,
} from "@/lib/ai/contract";
import { generateExercise as defaultGenerateExercise } from "@/lib/ai/gemini";
import type { CopingExercise } from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Text helpers (pure)
// ---------------------------------------------------------------------------
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 2); // drop very short/stop-ish tokens
}

/** Jaccard-style token overlap of two strings, 0..1. */
export function textSimilarity(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ---------------------------------------------------------------------------
// Scorer (pure, exported for unit tests)
// ---------------------------------------------------------------------------
/**
 * Score how well an exercise matches the detected triggers, in 0..1.
 *
 * base = blend of exact tag overlap (an exercise tag equals/contains a trigger)
 * and soft text similarity between each trigger and the exercise's tags+title.
 * The base is then weighted by effectiveness via (1 + avg_effectiveness) and
 * re-normalized back into 0..1 so a proven exercise edges out an equal-relevance
 * unproven one without ever exceeding 1.
 */
export function scoreExercise(
  exercise: Pick<
    CopingExerciseRow,
    "addresses_triggers" | "title" | "technique" | "avg_effectiveness"
  >,
  triggers: string[],
): number {
  const cleanTriggers = triggers.map((t) => t.trim()).filter(Boolean);
  if (cleanTriggers.length === 0) return 0;

  const tagSet = new Set(exercise.addresses_triggers.map((t) => t.toLowerCase().trim()));
  const tagBlob = exercise.addresses_triggers.join(" ");
  const titleBlob = `${exercise.title} ${exercise.technique}`;

  let total = 0;
  for (const trigger of cleanTriggers) {
    const lower = trigger.toLowerCase().trim();

    // Exact / containment tag overlap is the strongest signal.
    let exact = 0;
    if (tagSet.has(lower)) {
      exact = 1;
    } else {
      for (const tag of tagSet) {
        if (tag.includes(lower) || lower.includes(tag)) {
          exact = Math.max(exact, 0.8);
        }
      }
    }

    // Soft similarity against the exercise's tags and title.
    const soft = Math.max(
      textSimilarity(trigger, tagBlob),
      0.7 * textSimilarity(trigger, titleBlob),
    );

    total += Math.max(exact, soft);
  }

  const base = total / cleanTriggers.length; // mean relevance across triggers, 0..1

  // Effectiveness lift, normalized back to 0..1.
  const eff = Number.isFinite(exercise.avg_effectiveness)
    ? Math.max(0, Math.min(1, exercise.avg_effectiveness))
    : 0;
  const weighted = (base * (1 + eff)) / 2; // (1+eff) in [1,2] → /2 keeps it ≤ 1

  return Math.max(0, Math.min(1, weighted));
}

// ---------------------------------------------------------------------------
// Dedup (pure)
// ---------------------------------------------------------------------------
const DEDUP_THRESHOLD = 0.6;

/** The existing active exercise `candidate` near-duplicates, or null if none. */
export function findDuplicateExercise<T extends Pick<CopingExerciseRow, "title" | "technique" | "status">>(
  candidate: Pick<CopingExercise, "title" | "technique">,
  existing: T[],
): T | null {
  const candBlob = `${candidate.title} ${candidate.technique}`;
  for (const e of existing) {
    if (e.status !== "active") continue;
    if (e.technique.trim().toLowerCase() === candidate.technique.trim().toLowerCase()) {
      return e;
    }
    if (textSimilarity(candBlob, `${e.title} ${e.technique}`) >= DEDUP_THRESHOLD) {
      return e;
    }
  }
  return null;
}

/** True if `candidate` is a near-duplicate of any existing active exercise. */
export function isDuplicateExercise(
  candidate: Pick<CopingExercise, "title" | "technique">,
  existing: Pick<CopingExerciseRow, "title" | "technique" | "status">[],
): boolean {
  return findDuplicateExercise(candidate, existing) !== null;
}

// ---------------------------------------------------------------------------
// recommendExercise
// ---------------------------------------------------------------------------
function reasonForMatch(ex: CopingExerciseRow, triggers: string[]): string {
  const overlap = triggers.find((t) =>
    ex.addresses_triggers.some(
      (tag) =>
        tag.toLowerCase().includes(t.toLowerCase()) ||
        t.toLowerCase().includes(tag.toLowerCase()),
    ),
  );
  return overlap
    ? `Recommended because it targets what you're feeling around "${overlap}".`
    : `A grounded exercise to help with the stress you described.`;
}

/** Best active exercise + its score. */
function bestMatch(
  exercises: CopingExerciseRow[],
  triggers: string[],
): { exercise: CopingExerciseRow; score: number } | null {
  let best: { exercise: CopingExerciseRow; score: number } | null = null;
  for (const ex of exercises) {
    if (ex.status !== "active") continue;
    const score = scoreExercise(ex, triggers);
    if (!best || score > best.score) best = { exercise: ex, score };
  }
  return best;
}

/**
 * Factory so the route (and tests) can inject a mocked generator. The exported
 * `recommendExercise` binds the real Gemini generator.
 */
export function makeRecommendExercise(
  generate: (triggers: string[], context: string) => Promise<CopingExercise>,
): RecommendExercise {
  return async function recommend(args: RecommendArgs): Promise<RecommendDecision> {
    const { triggers, analysisSummary, exercises } = args;

    const best = bestMatch(exercises, triggers);

    // 1) Strong existing match → reuse it.
    if (best && best.score >= LIBRARY_MATCH_THRESHOLD) {
      return {
        kind: "match",
        exerciseId: best.exercise.id,
        reason: reasonForMatch(best.exercise, triggers),
      };
    }

    // 2) No match clears the bar → generate a fresh exercise.
    try {
      const exercise = await generate(triggers, analysisSummary);

      // 3) Dedup gate — never pollute the library with a near-duplicate. If the
      //    generated exercise duplicates an existing active one, reuse the exact
      //    exercise it duplicates (NOT persisted). Prefer the stronger
      //    trigger-match when one exists, else the duplicated exercise itself —
      //    so a near-duplicate is never inserted, even with no threshold match.
      const duplicateOf = findDuplicateExercise(exercise, exercises);
      if (duplicateOf) {
        const reuse = best?.exercise ?? duplicateOf;
        return {
          kind: "match",
          exerciseId: reuse.id,
          reason: reasonForMatch(reuse, triggers),
        };
      }

      return {
        kind: "generate",
        exercise,
        reason:
          triggers.length > 0
            ? `A new exercise tailored to ${triggers.slice(0, 2).join(" and ")}.`
            : "A new exercise to help you steady yourself right now.",
      };
    } catch {
      // Generation failed — degrade gracefully to the best available match.
      if (best) {
        return {
          kind: "match",
          exerciseId: best.exercise.id,
          reason: reasonForMatch(best.exercise, triggers),
        };
      }
      throw new Error("No exercise available to recommend");
    }
  };
}

export const recommendExercise: RecommendExercise =
  makeRecommendExercise(defaultGenerateExercise);
