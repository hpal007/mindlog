// LOCKED DB row types. Mirrors supabase/migrations. Lane A may regenerate via
// `supabase gen types` later, but these signatures are the contract Lane C builds on.
import type { RiskLevel } from "@/lib/constants";
import type { Trigger, Emotion } from "@/lib/schemas";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  exam_track: string | null;
  created_at: string;
}

export interface JournalEntryRow {
  id: string;
  user_id: string;
  body: string;
  mood_score: number;
  mood_tags: string[];
  created_at: string;
}

export interface EntryAnalysisRow {
  id: string;
  entry_id: string;
  user_id: string;
  triggers: Trigger[];
  emotions: Emotion[];
  themes: string[];
  risk_level: RiskLevel;
  summary: string | null;
  model: string | null;
  created_at: string;
}

export interface CopingExerciseRow {
  id: string;
  slug: string;
  title: string;
  technique: string;
  category: string;
  addresses_triggers: string[];
  steps: { order: number; text: string; seconds?: number }[];
  pros: string | null;
  evidence_basis: string | null;
  source: "curated" | "ai_generated";
  status: "active" | "pending_review" | "retired";
  usage_count: number;
  avg_effectiveness: number;
  created_at: string;
}

export interface ExerciseRecommendationRow {
  id: string;
  user_id: string;
  entry_id: string | null;
  exercise_id: string;
  reason: string | null;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  user_id: string;
  entry_id: string | null;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
