// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  journalEntryInputSchema,
  entryAnalysisSchema,
  copingExerciseSchema,
  feedbackInputSchema,
  trendsResponseSchema,
  crisisPayloadSchema,
} from "@/lib/schemas";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("journalEntryInputSchema", () => {
  it("accepts a valid entry and defaults mood_tags", () => {
    const r = journalEntryInputSchema.safeParse({ body: "Tough day with mocks.", mood_score: 3 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mood_tags).toEqual([]);
  });

  it("trims the body", () => {
    const r = journalEntryInputSchema.safeParse({ body: "  hi  ", mood_score: 2 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toBe("hi");
  });

  it("rejects an empty body", () => {
    expect(journalEntryInputSchema.safeParse({ body: "   ", mood_score: 3 }).success).toBe(false);
  });

  it("rejects mood_score below the 1..5 range (0)", () => {
    expect(journalEntryInputSchema.safeParse({ body: "ok", mood_score: 0 }).success).toBe(false);
  });

  it("rejects mood_score above the 1..5 range (6)", () => {
    expect(journalEntryInputSchema.safeParse({ body: "ok", mood_score: 6 }).success).toBe(false);
  });

  it("rejects a non-integer mood_score", () => {
    expect(journalEntryInputSchema.safeParse({ body: "ok", mood_score: 2.5 }).success).toBe(false);
  });

  it("rejects a body over the 5000 char cap", () => {
    expect(
      journalEntryInputSchema.safeParse({ body: "x".repeat(5001), mood_score: 3 }).success,
    ).toBe(false);
  });
});

describe("entryAnalysisSchema", () => {
  const valid = {
    triggers: [{ label: "mock test", evidence_span: "the mock destroyed me", confidence: 0.8 }],
    emotions: [{ label: "anxious", intensity: 0.7 }],
    themes: ["exam pressure"],
    risk_level: "none",
    summary: "You're feeling the weight of mock-test results.",
  };

  it("accepts a valid analysis", () => {
    expect(entryAnalysisSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults arrays when omitted (only risk_level + summary required)", () => {
    const r = entryAnalysisSchema.safeParse({ risk_level: "elevated", summary: "ok" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.triggers).toEqual([]);
      expect(r.data.emotions).toEqual([]);
      expect(r.data.themes).toEqual([]);
    }
  });

  it("rejects an invalid risk_level", () => {
    expect(entryAnalysisSchema.safeParse({ ...valid, risk_level: "critical" }).success).toBe(false);
  });

  it("rejects confidence outside 0..1", () => {
    const bad = { ...valid, triggers: [{ label: "x", evidence_span: "y", confidence: 1.5 }] };
    expect(entryAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an empty summary", () => {
    expect(entryAnalysisSchema.safeParse({ ...valid, summary: "" }).success).toBe(false);
  });
});

describe("copingExerciseSchema", () => {
  const valid = {
    title: "Box Breathing",
    technique: "4-4-4-4 box breathing",
    category: "breathing",
    addresses_triggers: ["anxiety"],
    steps: [{ order: 1, text: "Inhale for 4 seconds", seconds: 4 }],
  };

  it("accepts a valid exercise", () => {
    expect(copingExerciseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(copingExerciseSchema.safeParse({ ...valid, category: "yoga" }).success).toBe(false);
  });

  it("rejects an empty steps array", () => {
    expect(copingExerciseSchema.safeParse({ ...valid, steps: [] }).success).toBe(false);
  });

  it("rejects a step with order < 1", () => {
    const bad = { ...valid, steps: [{ order: 0, text: "x" }] };
    expect(copingExerciseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("feedbackInputSchema", () => {
  it("accepts feedback with only `helpful`", () => {
    expect(feedbackInputSchema.safeParse({ recommendation_id: UUID, helpful: true }).success).toBe(
      true,
    );
  });

  it("accepts feedback with only a `rating`", () => {
    expect(feedbackInputSchema.safeParse({ recommendation_id: UUID, rating: 4 }).success).toBe(true);
  });

  it("rejects feedback with NEITHER helpful nor rating", () => {
    expect(feedbackInputSchema.safeParse({ recommendation_id: UUID }).success).toBe(false);
  });

  it("rejects a non-uuid recommendation_id", () => {
    expect(feedbackInputSchema.safeParse({ recommendation_id: "nope", helpful: true }).success).toBe(
      false,
    );
  });

  it("rejects a rating outside 1..5", () => {
    expect(feedbackInputSchema.safeParse({ recommendation_id: UUID, rating: 6 }).success).toBe(
      false,
    );
  });
});

describe("trendsResponseSchema", () => {
  it("accepts an empty-but-shaped trends response", () => {
    const r = trendsResponseSchema.safeParse({
      moodSeries: [],
      topTriggers: [],
      insights: [],
      entryCount: 0,
      streakDays: 0,
    });
    expect(r.success).toBe(true);
  });
});

describe("crisisPayloadSchema", () => {
  it("requires risk literal 'acute'", () => {
    const bad = { risk: "none", message: "x", helplines: [] };
    expect(crisisPayloadSchema.safeParse(bad).success).toBe(false);
  });
});
