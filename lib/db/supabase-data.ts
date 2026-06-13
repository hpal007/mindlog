import "server-only";
import { serviceClient } from "@/lib/supabase/server";
import type { EntryAnalysis, JournalEntryInput, Trigger, Emotion } from "@/lib/schemas";
import type { RiskLevel } from "@/lib/constants";
import type { DataAccess } from "@/lib/db/index";
import type {
  JournalEntryRow,
  EntryAnalysisRow,
  CopingExerciseRow,
  ExerciseRecommendationRow,
  ChatMessageRow,
} from "@/lib/db/types";

// ============================================================================
// Supabase implementation of the LOCKED DataAccess interface.
//
// Every query uses the service-role client (serviceClient()) and is scoped by
// an EXPLICIT user_id — under the 1hr clock we run a seeded demo session, not
// auth.uid(), and the service role bypasses RLS. RLS stays ON (see
// 0002_rls.sql) so the per-user isolation security story is real and testable.
//
// Zod schemas are the source of truth for shapes; jsonb columns
// (triggers/emotions/themes/steps/shown_resources) are read/written as native
// JSON and cast to the locked Row types.
// ============================================================================

/** Auto-retire an exercise once it has enough samples but underperforms. */
const RETIRE_MIN_SAMPLES = 4;
const RETIRE_THRESHOLD = 2.0; // avg rating (1–5) below this => retire

function client() {
  return serviceClient();
}

/** Narrow a Supabase error into a thrown Error with a generic, safe message. */
function fail(context: string, error: { message: string } | null): never {
  throw new Error(`db.${context} failed: ${error?.message ?? "unknown error"}`);
}

// ---- row mappers (jsonb columns arrive as `unknown`; cast to locked shapes) --

function mapEntry(row: Record<string, unknown>): JournalEntryRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    body: row.body as string,
    mood_score: row.mood_score as number,
    mood_tags: (row.mood_tags as string[] | null) ?? [],
    created_at: row.created_at as string,
  };
}

function mapAnalysis(row: Record<string, unknown>): EntryAnalysisRow {
  return {
    id: row.id as string,
    entry_id: row.entry_id as string,
    user_id: row.user_id as string,
    triggers: (row.triggers as Trigger[] | null) ?? [],
    emotions: (row.emotions as Emotion[] | null) ?? [],
    themes: (row.themes as string[] | null) ?? [],
    risk_level: row.risk_level as RiskLevel,
    summary: (row.summary as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

function mapExercise(row: Record<string, unknown>): CopingExerciseRow {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    technique: row.technique as string,
    category: row.category as string,
    addresses_triggers: (row.addresses_triggers as string[] | null) ?? [],
    steps: (row.steps as CopingExerciseRow["steps"] | null) ?? [],
    pros: (row.pros as string | null) ?? null,
    evidence_basis: (row.evidence_basis as string | null) ?? null,
    source: row.source as CopingExerciseRow["source"],
    status: row.status as CopingExerciseRow["status"],
    usage_count: (row.usage_count as number | null) ?? 0,
    avg_effectiveness: Number(row.avg_effectiveness ?? 0),
    created_at: row.created_at as string,
  };
}

function mapRecommendation(row: Record<string, unknown>): ExerciseRecommendationRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    entry_id: (row.entry_id as string | null) ?? null,
    exercise_id: row.exercise_id as string,
    reason: (row.reason as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

function mapChat(row: Record<string, unknown>): ChatMessageRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    entry_id: (row.entry_id as string | null) ?? null,
    role: row.role as ChatMessageRow["role"],
    content: row.content as string,
    created_at: row.created_at as string,
  };
}

export const db: DataAccess = {
  // ----------------------------- journal entries ----------------------------
  async insertEntry(userId, input: JournalEntryInput): Promise<JournalEntryRow> {
    const { data, error } = await client()
      .from("journal_entries")
      .insert({
        user_id: userId,
        body: input.body,
        mood_score: input.mood_score,
        mood_tags: input.mood_tags ?? [],
      })
      .select("*")
      .single();
    if (error || !data) fail("insertEntry", error);
    return mapEntry(data);
  },

  async listEntries(userId, limit = 50): Promise<JournalEntryRow[]> {
    const { data, error } = await client()
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("listEntries", error);
    return (data ?? []).map(mapEntry);
  },

  async getRecentEntriesWithAnalyses(userId, limit = 20) {
    const { data: entries, error } = await client()
      .from("journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("getRecentEntriesWithAnalyses", error);

    const rows = (entries ?? []).map(mapEntry);
    if (rows.length === 0) return [];

    const entryIds = rows.map((e) => e.id);
    const { data: analyses, error: aErr } = await client()
      .from("entry_analyses")
      .select("*")
      .eq("user_id", userId)
      .in("entry_id", entryIds);
    if (aErr) fail("getRecentEntriesWithAnalyses(analyses)", aErr);

    const byEntry = new Map<string, EntryAnalysisRow>();
    for (const a of analyses ?? []) {
      const mapped = mapAnalysis(a);
      // Keep the first (analyses are 1:1 per entry on the happy path).
      if (!byEntry.has(mapped.entry_id)) byEntry.set(mapped.entry_id, mapped);
    }

    return rows.map((entry) => ({
      entry,
      analysis: byEntry.get(entry.id) ?? null,
    }));
  },

  // -------------------------------- analyses --------------------------------
  async insertAnalysis(userId, entryId, analysis: EntryAnalysis, model): Promise<EntryAnalysisRow> {
    const { data, error } = await client()
      .from("entry_analyses")
      .insert({
        entry_id: entryId,
        user_id: userId,
        triggers: analysis.triggers,
        emotions: analysis.emotions,
        themes: analysis.themes,
        risk_level: analysis.risk_level,
        summary: analysis.summary,
        model,
      })
      .select("*")
      .single();
    if (error || !data) fail("insertAnalysis", error);
    return mapAnalysis(data);
  },

  // ---------------------------- coping library ------------------------------
  async getActiveExercises(): Promise<CopingExerciseRow[]> {
    const { data, error } = await client()
      .from("coping_exercises")
      .select("*")
      .eq("status", "active")
      // Best-performing, most-used first so the matcher sees the strongest
      // candidates; curated seeds (avg > 0) outrank brand-new ai_generated (0).
      .order("avg_effectiveness", { ascending: false })
      .order("usage_count", { ascending: false });
    if (error) fail("getActiveExercises", error);
    return (data ?? []).map(mapExercise);
  },

  async insertGeneratedExercise(ex): Promise<CopingExerciseRow> {
    const { data, error } = await client()
      .from("coping_exercises")
      .insert({
        slug: ex.slug,
        title: ex.title,
        technique: ex.technique,
        category: ex.category,
        addresses_triggers: ex.addresses_triggers ?? [],
        steps: ex.steps,
        pros: ex.pros,
        evidence_basis: ex.evidence_basis,
        source: "ai_generated",
        status: "active",
        usage_count: 0,
        avg_effectiveness: 0,
      })
      .select("*")
      .single();
    if (error || !data) fail("insertGeneratedExercise", error);
    return mapExercise(data);
  },

  async incrementUsage(exerciseId): Promise<void> {
    // Atomic in-database bump (see 0005_atomic_usage.sql): one round-trip, no
    // read, no lost-update race under concurrent recommendations.
    const { error } = await client().rpc("increment_exercise_usage", {
      p_exercise_id: exerciseId,
    });
    if (error) fail("incrementUsage", error);
  },

  // ----------------------------- recommendations ----------------------------
  async insertRecommendation(userId, entryId, exerciseId, reason): Promise<ExerciseRecommendationRow> {
    const { data, error } = await client()
      .from("exercise_recommendations")
      .insert({
        user_id: userId,
        entry_id: entryId,
        exercise_id: exerciseId,
        reason,
      })
      .select("*")
      .single();
    if (error || !data) fail("insertRecommendation", error);
    return mapRecommendation(data);
  },

  async applyFeedback(userId, recommendationId, helpful, rating, note) {
    // 1. Resolve which exercise this recommendation points at (user-scoped).
    const { data: rec, error: recErr } = await client()
      .from("exercise_recommendations")
      .select("exercise_id")
      .eq("id", recommendationId)
      .eq("user_id", userId)
      .single();
    if (recErr || !rec) fail("applyFeedback(lookup)", recErr);
    const exerciseId = rec.exercise_id as string;

    // 2. Record the feedback row.
    const { error: fErr } = await client()
      .from("exercise_feedback")
      .insert({
        user_id: userId,
        recommendation_id: recommendationId,
        helpful: helpful ?? null,
        rating: rating ?? null,
        note: note ?? null,
      });
    if (fErr) fail("applyFeedback(insert)", fErr);

    // 3. Recompute avg_effectiveness = mean of all ratings across every
    //    recommendation of this exercise (join feedback -> recommendations).
    const { data: recs, error: recsErr } = await client()
      .from("exercise_recommendations")
      .select("id")
      .eq("exercise_id", exerciseId);
    if (recsErr) fail("applyFeedback(recs)", recsErr);
    const recIds = (recs ?? []).map((r) => r.id as string);

    let avg = 0;
    let sampleCount = 0;
    if (recIds.length > 0) {
      const { data: fb, error: fbErr } = await client()
        .from("exercise_feedback")
        .select("rating")
        .in("recommendation_id", recIds)
        .not("rating", "is", null);
      if (fbErr) fail("applyFeedback(ratings)", fbErr);
      const ratings = (fb ?? [])
        .map((r) => r.rating as number | null)
        .filter((r): r is number => typeof r === "number");
      sampleCount = ratings.length;
      if (sampleCount > 0) {
        avg = ratings.reduce((s, r) => s + r, 0) / sampleCount;
      }
    }
    const rounded = Math.round(avg * 100) / 100; // numeric(3,2)

    // 4. Persist the new average; auto-retire chronic underperformers.
    const update: { avg_effectiveness: number; status?: "retired" } = {
      avg_effectiveness: rounded,
    };
    if (sampleCount >= RETIRE_MIN_SAMPLES && rounded < RETIRE_THRESHOLD) {
      update.status = "retired";
    }
    const { error: upErr } = await client()
      .from("coping_exercises")
      .update(update)
      .eq("id", exerciseId);
    if (upErr) fail("applyFeedback(update)", upErr);

    return { exerciseId, avg_effectiveness: rounded };
  },

  // ---------------------------------- chat ----------------------------------
  async insertChatMessage(userId, role, content, entryId): Promise<ChatMessageRow> {
    const { data, error } = await client()
      .from("chat_messages")
      .insert({
        user_id: userId,
        role,
        content,
        entry_id: entryId,
      })
      .select("*")
      .single();
    if (error || !data) fail("insertChatMessage", error);
    return mapChat(data);
  },

  async getRecentChat(userId, limit = 20): Promise<ChatMessageRow[]> {
    const { data, error } = await client()
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("getRecentChat", error);
    // Return chronological order (oldest first) for prompt context.
    return (data ?? []).map(mapChat).reverse();
  },

  // --------------------------------- crisis ---------------------------------
  async insertCrisisEvent(userId, entryId, riskLevel, shownResources): Promise<void> {
    const { error } = await client()
      .from("crisis_events")
      .insert({
        user_id: userId,
        entry_id: entryId,
        risk_level: riskLevel,
        shown_resources: shownResources ?? null,
      });
    if (error) fail("insertCrisisEvent", error);
  },
};
