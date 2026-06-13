// @vitest-environment node
//
// Orchestration tests for POST /api/entries. The LLM and DB are fully mocked —
// no network. Covers: happy path (streamed NDJSON + recommendation), validation
// 400, rate-limit 429, Gemini failure (graceful, no stack leak), acute via MODEL
// signal, acute via KEYWORD backstop, and the match-vs-generate persistence branch.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readNdjson, jsonRequest } from "../helpers/readStream";
import type { AnalysisStreamEvent } from "@/lib/ai/contract";
import type { EntryAnalysis } from "@/lib/schemas";

// --- Mocks. vi.hoisted so the mock state is available to the hoisted vi.mock factories. ---
const { analyzeEntry, recommendExercise, checkRateLimit, db } = vi.hoisted(() => ({
  analyzeEntry: vi.fn(),
  recommendExercise: vi.fn(),
  checkRateLimit: vi.fn(),
  db: {
    insertEntry: vi.fn(),
    insertAnalysis: vi.fn(),
    getActiveExercises: vi.fn(),
    insertGeneratedExercise: vi.fn(),
    incrementUsage: vi.fn(),
    insertRecommendation: vi.fn(),
    insertCrisisEvent: vi.fn(),
  },
}));

vi.mock("@/lib/ai/gemini", () => ({ analyzeEntry, streamChat: vi.fn(), generateExercise: vi.fn() }));
vi.mock("@/lib/library/recommend", () => ({ recommendExercise }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit }));
vi.mock("@/lib/db", () => ({ db }));

// Import AFTER the mocks are registered.
import { POST } from "@/app/api/entries/route";

const ENTRY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ANALYSIS_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const EXERCISE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const REC_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

function streamOf(events: AnalysisStreamEvent[]) {
  return async function* () {
    for (const ev of events) yield ev;
  };
}

function analysis(over: Partial<EntryAnalysis> = {}): EntryAnalysis {
  return {
    triggers: over.triggers ?? [
      { label: "mock test", evidence_span: "the mock crushed me", confidence: 0.8 },
    ],
    emotions: over.emotions ?? [{ label: "anxious", intensity: 0.7 }],
    themes: over.themes ?? ["exam pressure"],
    risk_level: over.risk_level ?? "none",
    summary: over.summary ?? "You're feeling the weight of a hard mock.",
  };
}

const exerciseRow = {
  id: EXERCISE_ID,
  slug: "box-breathing",
  title: "Box Breathing",
  technique: "box breathing",
  category: "breathing",
  addresses_triggers: ["anxiety"],
  steps: [{ order: 1, text: "Inhale 4s", seconds: 4 }],
  pros: null,
  evidence_basis: null,
  source: "curated" as const,
  status: "active" as const,
  usage_count: 0,
  avg_effectiveness: 0,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });
  db.insertEntry.mockResolvedValue({
    id: ENTRY_ID,
    user_id: "u",
    body: "x",
    mood_score: 3,
    mood_tags: [],
    created_at: new Date().toISOString(),
  });
  db.insertAnalysis.mockResolvedValue({ id: ANALYSIS_ID });
  db.getActiveExercises.mockResolvedValue([exerciseRow]);
  db.incrementUsage.mockResolvedValue(undefined);
  db.insertRecommendation.mockResolvedValue({ id: REC_ID });
  db.insertGeneratedExercise.mockResolvedValue(exerciseRow);
  db.insertCrisisEvent.mockResolvedValue(undefined);
});

const goodBody = { body: "The mock test crushed me today.", mood_score: 2 };

describe("POST /api/entries — success (a)", () => {
  it("streams a token line and a final result with a recommendation", async () => {
    analyzeEntry.mockImplementation(
      streamOf([
        { type: "token", text: "Hearing you..." },
        { type: "analysis", analysis: analysis() },
      ]),
    );
    recommendExercise.mockResolvedValue({
      kind: "match",
      exerciseId: EXERCISE_ID,
      reason: "Targets your anxiety.",
    });

    const res = await POST(jsonRequest(goodBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("ndjson");

    const lines = await readNdjson<{ type: string; text?: string; result?: unknown }>(res);
    expect(lines.some((l) => l.type === "token" && l.text)).toBe(true);

    const result = lines.find((l) => l.type === "result")?.result as {
      analysis: EntryAnalysis;
      recommendation: { id: string } | null;
    };
    expect(result).toBeTruthy();
    expect(result.recommendation?.id).toBe(EXERCISE_ID);

    expect(db.insertEntry).toHaveBeenCalledOnce();
    expect(db.insertAnalysis).toHaveBeenCalledOnce();
    expect(db.insertRecommendation).toHaveBeenCalledOnce();
    expect(db.insertCrisisEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/entries — validation 400 (b)", () => {
  it("rejects an out-of-range mood_score (9) before any LLM call", async () => {
    const res = await POST(jsonRequest({ body: "ok", mood_score: 9 }));
    expect(res.status).toBe(400);
    expect(analyzeEntry).not.toHaveBeenCalled();
    expect(db.insertEntry).not.toHaveBeenCalled();
  });
});

describe("POST /api/entries — rate limit 429 (c)", () => {
  it("returns 429 and never calls the model when not allowed", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await POST(jsonRequest(goodBody));
    expect(res.status).toBe(429);
    expect(analyzeEntry).not.toHaveBeenCalled();
  });
});

describe("POST /api/entries — Gemini failure (d)", () => {
  it("degrades gracefully (emits an error line, no crash, no stack leak)", async () => {
    analyzeEntry.mockImplementation(() => {
      throw new Error("INTERNAL gemini stacktrace secret-key-leak");
    });
    const res = await POST(jsonRequest(goodBody));
    // Headers already streamed → a 200 stream carrying a safe error line.
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    expect(text).not.toContain("secret-key-leak");
    expect(text).not.toContain("stacktrace");
    const lines = await readNdjson<{ type: string; error?: string }>(res);
    expect(lines.some((l) => l.type === "error")).toBe(true);
  });
});

describe("POST /api/entries — ACUTE via MODEL signal (e)", () => {
  it("crisis payload, NO recommendation, crisis event written", async () => {
    analyzeEntry.mockImplementation(
      streamOf([{ type: "analysis", analysis: analysis({ risk_level: "acute" }) }]),
    );

    const res = await POST(jsonRequest(goodBody));
    expect(res.status).toBe(200);
    const lines = await readNdjson<{ type: string; result?: { risk?: string } }>(res);
    const result = lines.find((l) => l.type === "result")?.result;
    expect(result?.risk).toBe("acute");

    expect(db.insertCrisisEvent).toHaveBeenCalledOnce();
    expect(db.insertRecommendation).not.toHaveBeenCalled();
    expect(recommendExercise).not.toHaveBeenCalled();
  });
});

describe("POST /api/entries — ACUTE via KEYWORD backstop (f)", () => {
  it("model says none but a self-harm phrase still trips the crisis path", async () => {
    // Model misses it → returns "none". Body contains a genuine acute phrase.
    analyzeEntry.mockImplementation(
      streamOf([{ type: "analysis", analysis: analysis({ risk_level: "none" }) }]),
    );

    const res = await POST(
      jsonRequest({ body: "I honestly want to kill myself, I can't do this.", mood_score: 1 }),
    );
    expect(res.status).toBe(200);
    const lines = await readNdjson<{ type: string; result?: { risk?: string } }>(res);
    expect(lines.find((l) => l.type === "result")?.result?.risk).toBe("acute");

    expect(db.insertCrisisEvent).toHaveBeenCalledOnce();
    expect(db.insertRecommendation).not.toHaveBeenCalled();
  });
});

describe("POST /api/entries — MATCH vs GENERATE (g)", () => {
  it("MATCH: reuses an existing exercise, persists NO new exercise", async () => {
    analyzeEntry.mockImplementation(streamOf([{ type: "analysis", analysis: analysis() }]));
    recommendExercise.mockResolvedValue({
      kind: "match",
      exerciseId: EXERCISE_ID,
      reason: "match reason",
    });

    const res = await POST(jsonRequest(goodBody));
    await readNdjson(res);

    expect(db.insertGeneratedExercise).not.toHaveBeenCalled();
    expect(db.incrementUsage).toHaveBeenCalledWith(EXERCISE_ID);
    expect(db.insertRecommendation).toHaveBeenCalledOnce();
  });

  it("GENERATE: persists a freshly generated exercise via insertGeneratedExercise", async () => {
    analyzeEntry.mockImplementation(streamOf([{ type: "analysis", analysis: analysis() }]));
    recommendExercise.mockResolvedValue({
      kind: "generate",
      exercise: {
        title: "Five Senses Grounding",
        technique: "5-4-3-2-1 grounding",
        category: "grounding",
        addresses_triggers: ["overwhelm"],
        steps: [{ order: 1, text: "Name five things you can see." }],
      },
      reason: "new tailored exercise",
    });

    const res = await POST(jsonRequest(goodBody));
    await readNdjson(res);

    expect(db.insertGeneratedExercise).toHaveBeenCalledOnce();
    expect(db.insertRecommendation).toHaveBeenCalledOnce();
  });
});
