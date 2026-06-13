import { z } from "zod";

// ============================================================================
// LOCKED single source of truth. Every app type is z.infer'red from here.
// Used for: API I/O validation, Gemini structured-output parsing, DB write
// typing, and client forms. NEVER hand-maintain a duplicate shape elsewhere.
// ============================================================================

export const EXAM_TRACKS = ["NEET", "JEE", "CUET", "CAT", "GATE", "UPSC", "OTHER"] as const;
export const RISK_LEVELS = ["none", "elevated", "acute"] as const;

export const riskLevelSchema = z.enum(RISK_LEVELS);

// ---------- Journal input (client form + POST /api/entries body) ----------
export const journalEntryInputSchema = z.object({
  body: z.string().trim().min(1, "Write a little about your day.").max(5000),
  mood_score: z.number().int().min(1).max(5),
  mood_tags: z.array(z.string().min(1).max(40)).max(12).default([]),
});
export type JournalEntryInput = z.infer<typeof journalEntryInputSchema>;

// ---------- Analysis (Gemini structured output + entry_analyses row) ----------
export const triggerSchema = z.object({
  label: z.string().min(1).max(80),
  /** A short span quoted verbatim from the student's text as evidence. */
  evidence_span: z.string().min(1).max(280),
  confidence: z.number().min(0).max(1),
});
export type Trigger = z.infer<typeof triggerSchema>;

export const emotionSchema = z.object({
  label: z.string().min(1).max(40),
  intensity: z.number().min(0).max(1),
});
export type Emotion = z.infer<typeof emotionSchema>;

export const entryAnalysisSchema = z.object({
  triggers: z.array(triggerSchema).max(8).default([]),
  emotions: z.array(emotionSchema).max(8).default([]),
  themes: z.array(z.string().min(1).max(60)).max(8).default([]),
  risk_level: riskLevelSchema,
  /** One warm, non-clinical sentence reflecting what the student shared. */
  summary: z.string().min(1).max(400),
});
export type EntryAnalysis = z.infer<typeof entryAnalysisSchema>;

// ---------- Coping exercise (validates AI-generated exercises before persist) ----------
export const EXERCISE_CATEGORIES = [
  "breathing", "grounding", "study-reframe", "sleep", "motivation",
] as const;

export const exerciseStepSchema = z.object({
  order: z.number().int().min(1),
  text: z.string().min(1).max(400),
  /** Optional seconds for timed steps (e.g. breathing holds). */
  seconds: z.number().int().min(1).max(600).optional(),
});
export type ExerciseStep = z.infer<typeof exerciseStepSchema>;

export const copingExerciseSchema = z.object({
  title: z.string().min(1).max(120),
  technique: z.string().min(1).max(80),
  category: z.enum(EXERCISE_CATEGORIES),
  addresses_triggers: z.array(z.string().min(1).max(80)).max(10).default([]),
  steps: z.array(exerciseStepSchema).min(1).max(10),
  pros: z.string().max(400).optional(),
  evidence_basis: z.string().max(120).optional(),
});
export type CopingExercise = z.infer<typeof copingExerciseSchema>;

/** Exercise as served to the client (includes db id + library metadata). */
export const recommendedExerciseSchema = copingExerciseSchema.extend({
  id: z.string().uuid(),
  slug: z.string(),
  source: z.enum(["curated", "ai_generated"]),
  /** Why this exercise was chosen for this student/entry. */
  reason: z.string().max(400).optional(),
  recommendation_id: z.string().uuid().optional(),
});
export type RecommendedExercise = z.infer<typeof recommendedExerciseSchema>;

// ---------- Chat ----------
export const chatTurnSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  /** Optional entry context to ground the companion in recent triggers. */
  entry_id: z.string().uuid().optional(),
});
export type ChatTurn = z.infer<typeof chatTurnSchema>;

// ---------- Feedback ----------
export const feedbackInputSchema = z.object({
  recommendation_id: z.string().uuid(),
  helpful: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().max(500).optional(),
}).refine((v) => v.helpful !== undefined || v.rating !== undefined, {
  message: "Provide helpful and/or a rating.",
});
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

// ---------- Trends ----------
export const moodPointSchema = z.object({
  date: z.string(), // ISO date
  mood_score: z.number(),
});
export const topTriggerSchema = z.object({
  label: z.string(),
  count: z.number().int(),
});
export const trendsResponseSchema = z.object({
  moodSeries: z.array(moodPointSchema),
  topTriggers: z.array(topTriggerSchema),
  /** Plain-language pattern statements ("Your mood dips on mock-test days"). */
  insights: z.array(z.string()),
  entryCount: z.number().int(),
  streakDays: z.number().int(),
});
export type TrendsResponse = z.infer<typeof trendsResponseSchema>;

// ---------- Crisis resources payload (returned on acute path) ----------
export const crisisPayloadSchema = z.object({
  risk: z.literal("acute"),
  message: z.string(),
  helplines: z.array(z.object({
    name: z.string(),
    number: z.string(),
    tel: z.string(),
    note: z.string().optional(),
  })),
});
export type CrisisPayload = z.infer<typeof crisisPayloadSchema>;

// ---------- POST /api/entries — JSON tail emitted after the streamed analysis ----------
export const entriesResultSchema = z.object({
  analysisId: z.string().uuid(),
  entryId: z.string().uuid(),
  analysis: entryAnalysisSchema,
  recommendation: recommendedExerciseSchema.nullable(),
});
export type EntriesResult = z.infer<typeof entriesResultSchema>;
