// LOCKED AI-core contract. Lane B implements; Lane C consumes. Do not change
// signatures without updating both lanes.
import type { EntryAnalysis, CopingExercise } from "@/lib/schemas";
import type { CopingExerciseRow, ChatMessageRow } from "@/lib/db/types";

// ---- Streaming analysis: ONE Gemini structured-streaming call ----
// Yields incremental human-facing tokens (the reflection/summary) for the
// streaming UX, then a final validated structured result for persistence.
export type AnalysisStreamEvent =
  | { type: "token"; text: string }
  | { type: "analysis"; analysis: EntryAnalysis };

export type AnalyzeEntry = (text: string) => AsyncIterable<AnalysisStreamEvent>;

// ---- Streaming chat companion, grounded in recent triggers ----
export interface StreamChatArgs {
  message: string;
  history: Pick<ChatMessageRow, "role" | "content">[];
  /** Recent detected triggers to ground the companion. */
  triggers?: string[];
}
export type StreamChat = (args: StreamChatArgs) => AsyncIterable<string>;

// ---- Exercise generation (used by recommend on the no-match path) ----
export type GenerateExercise = (
  triggers: string[],
  context: string,
) => Promise<CopingExercise>;

// ---- Library recommend: match existing OR generate+validate+dedup ----
export type RecommendDecision =
  | { kind: "match"; exerciseId: string; reason: string }
  | { kind: "generate"; exercise: CopingExercise; reason: string };

export interface RecommendArgs {
  triggers: string[];
  analysisSummary: string;
  exercises: CopingExerciseRow[];
}
export type RecommendExercise = (args: RecommendArgs) => Promise<RecommendDecision>;

// ---- Deterministic safety backstop (no LLM) ----
import type { RiskLevel } from "@/lib/constants";
export type KeywordRisk = (text: string) => RiskLevel;
