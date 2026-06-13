// LOCKED data-access interface. Lane A IMPLEMENTS these against Supabase.
// Lane C (routes) imports and calls them. Signatures are the contract — do not
// change them without updating both lanes. All functions are RLS-scoped by
// passing an explicit userId (service-role client + explicit user_id filter,
// since under the 1hr clock we use a seeded demo session, not auth.uid()).

import type { EntryAnalysis, JournalEntryInput } from "@/lib/schemas";
import type {
  JournalEntryRow,
  EntryAnalysisRow,
  CopingExerciseRow,
  ExerciseRecommendationRow,
  ChatMessageRow,
} from "@/lib/db/types";

export interface InsertEntryResult {
  entry: JournalEntryRow;
}

export interface DataAccess {
  // --- journal entries ---
  insertEntry(userId: string, input: JournalEntryInput): Promise<JournalEntryRow>;
  listEntries(userId: string, limit?: number): Promise<JournalEntryRow[]>;
  getRecentEntriesWithAnalyses(
    userId: string,
    limit?: number,
  ): Promise<{ entry: JournalEntryRow; analysis: EntryAnalysisRow | null }[]>;

  // --- analyses ---
  insertAnalysis(
    userId: string,
    entryId: string,
    analysis: EntryAnalysis,
    model: string,
  ): Promise<EntryAnalysisRow>;

  // --- coping library (global) ---
  getActiveExercises(): Promise<CopingExerciseRow[]>;
  insertGeneratedExercise(
    ex: Omit<CopingExerciseRow, "id" | "created_at" | "usage_count" | "avg_effectiveness" | "status" | "source" | "slug"> & { slug: string },
  ): Promise<CopingExerciseRow>;
  incrementUsage(exerciseId: string): Promise<void>;

  // --- recommendations ---
  insertRecommendation(
    userId: string,
    entryId: string | null,
    exerciseId: string,
    reason: string,
  ): Promise<ExerciseRecommendationRow>;
  applyFeedback(
    userId: string,
    recommendationId: string,
    helpful: boolean | undefined,
    rating: number | undefined,
    note: string | undefined,
  ): Promise<{ exerciseId: string; avg_effectiveness: number }>;

  // --- chat ---
  insertChatMessage(
    userId: string,
    role: "user" | "assistant",
    content: string,
    entryId: string | null,
  ): Promise<ChatMessageRow>;
  getRecentChat(userId: string, limit?: number): Promise<ChatMessageRow[]>;

  // --- crisis ---
  insertCrisisEvent(
    userId: string,
    entryId: string | null,
    riskLevel: string,
    shownResources: unknown,
  ): Promise<void>;
}

// Lane A's concrete Supabase implementation (lib/db/supabase-data.ts).
export { db } from "./supabase-data";
