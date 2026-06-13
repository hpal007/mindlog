// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  makeRecommendExercise,
  scoreExercise,
  textSimilarity,
  isDuplicateExercise,
} from "@/lib/library/recommend";
import type { CopingExerciseRow } from "@/lib/db/types";
import type { CopingExercise } from "@/lib/schemas";

function row(over: Partial<CopingExerciseRow>): CopingExerciseRow {
  return {
    id: over.id ?? "00000000-0000-0000-0000-0000000000aa",
    slug: over.slug ?? "slug",
    title: over.title ?? "Box Breathing",
    technique: over.technique ?? "box breathing",
    category: over.category ?? "breathing",
    addresses_triggers: over.addresses_triggers ?? ["anxiety"],
    steps: over.steps ?? [{ order: 1, text: "Inhale 4s", seconds: 4 }],
    pros: over.pros ?? null,
    evidence_basis: over.evidence_basis ?? null,
    source: over.source ?? "curated",
    status: over.status ?? "active",
    usage_count: over.usage_count ?? 0,
    avg_effectiveness: over.avg_effectiveness ?? 0,
    created_at: over.created_at ?? new Date().toISOString(),
  };
}

const breathing = row({
  id: "11111111-1111-1111-1111-111111111111",
  title: "Box Breathing for Exam Anxiety",
  technique: "box breathing",
  addresses_triggers: ["anxiety", "panic", "exam stress"],
});
const sleep = row({
  id: "22222222-2222-2222-2222-222222222222",
  title: "Wind-Down for Sleep",
  technique: "progressive muscle relaxation",
  category: "sleep",
  addresses_triggers: ["insomnia", "racing thoughts at night"],
});

const EXERCISES = [breathing, sleep];

function generatedExercise(over: Partial<CopingExercise> = {}): CopingExercise {
  return {
    title: over.title ?? "Five Senses Grounding",
    technique: over.technique ?? "5-4-3-2-1 grounding",
    category: over.category ?? "grounding",
    addresses_triggers: over.addresses_triggers ?? ["overwhelm"],
    steps: over.steps ?? [{ order: 1, text: "Name five things you can see." }],
  };
}

describe("recommendExercise — match path", () => {
  it("returns kind:match for a strong trigger overlap WITHOUT calling generate", async () => {
    const generate = vi.fn();
    const recommend = makeRecommendExercise(generate);

    const decision = await recommend({
      triggers: ["anxiety", "exam stress"],
      analysisSummary: "Anxious about the upcoming exam.",
      exercises: EXERCISES,
    });

    expect(decision.kind).toBe("match");
    if (decision.kind === "match") expect(decision.exerciseId).toBe(breathing.id);
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("recommendExercise — generate path", () => {
  it("calls generate and returns the generated exercise when no match clears the bar", async () => {
    const gen = generatedExercise();
    const generate = vi.fn().mockResolvedValue(gen);
    const recommend = makeRecommendExercise(generate);

    const decision = await recommend({
      triggers: ["fear of disappointing my parents"],
      analysisSummary: "Worried about family expectations.",
      exercises: EXERCISES,
    });

    expect(generate).toHaveBeenCalledOnce();
    expect(decision.kind).toBe("generate");
    if (decision.kind === "generate") expect(decision.exercise.title).toBe(gen.title);
  });
});

describe("recommendExercise — dedup falls back to match", () => {
  it("when generate returns a near-duplicate of an existing active exercise, falls back to a match", async () => {
    // Generated exercise shares technique with `breathing` => isDuplicateExercise true.
    const dup = generatedExercise({
      title: "Another Box Breathing Drill",
      technique: "box breathing",
      addresses_triggers: ["focus"],
    });
    const generate = vi.fn().mockResolvedValue(dup);
    const recommend = makeRecommendExercise(generate);

    // Trigger that matches NO existing tag (so nothing clears the 0.4 bar) but
    // bestMatch still returns a non-null fallback. generate runs, dedup trips,
    // and we fall back to the best available match.
    const decision = await recommend({
      triggers: ["loneliness"],
      analysisSummary: "Feeling isolated.",
      exercises: EXERCISES,
    });

    expect(generate).toHaveBeenCalled();
    expect(decision.kind).toBe("match");
    if (decision.kind === "match") expect(decision.exerciseId).toBe(breathing.id);
  });
});

describe("recommendExercise — graceful degradation", () => {
  it("falls back to the best match if generation throws", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("gemini down"));
    const recommend = makeRecommendExercise(generate);
    const decision = await recommend({
      triggers: ["panic"],
      analysisSummary: "x",
      exercises: EXERCISES,
    });
    expect(decision.kind).toBe("match");
  });
});

describe("scoreExercise ordering", () => {
  it("scores a directly-tagged exercise higher than an unrelated one", () => {
    const onTopic = scoreExercise(breathing, ["anxiety"]);
    const offTopic = scoreExercise(sleep, ["anxiety"]);
    expect(onTopic).toBeGreaterThan(offTopic);
    expect(onTopic).toBeLessThanOrEqual(1);
    expect(offTopic).toBeGreaterThanOrEqual(0);
  });

  it("effectiveness lifts the score of an otherwise-equal exercise", () => {
    const base = scoreExercise({ ...breathing, avg_effectiveness: 0 }, ["anxiety"]);
    const proven = scoreExercise({ ...breathing, avg_effectiveness: 1 }, ["anxiety"]);
    expect(proven).toBeGreaterThan(base);
  });

  it("returns 0 for no triggers", () => {
    expect(scoreExercise(breathing, [])).toBe(0);
  });
});

describe("textSimilarity + isDuplicateExercise (pure helpers)", () => {
  it("textSimilarity is 1 for identical strings, 0 for disjoint", () => {
    expect(textSimilarity("deep breathing exercise", "deep breathing exercise")).toBe(1);
    expect(textSimilarity("apple orange", "xylophone trombone")).toBe(0);
  });

  it("isDuplicateExercise detects a shared technique", () => {
    const dup = isDuplicateExercise(
      { title: "Totally Different Title", technique: "box breathing" },
      EXERCISES,
    );
    expect(dup).toBe(true);
  });

  it("isDuplicateExercise is false for a genuinely novel exercise", () => {
    const novel = isDuplicateExercise(
      { title: "Cold Water Reset", technique: "dive reflex activation" },
      EXERCISES,
    );
    expect(novel).toBe(false);
  });
});
