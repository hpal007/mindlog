// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  keywordRisk,
  ACUTE_PATTERNS,
  ELEVATED_PATTERNS,
  EXAM_IDIOM_PATTERNS,
} from "@/lib/safety/classifier";

describe("keywordRisk — ACUTE (genuine self-harm / suicidal ideation)", () => {
  const acute = [
    "I keep thinking about suicide lately.",
    "Sometimes I just want to kill myself.",
    "I feel like ending my life would be easier.",
    "I don't want to be alive anymore.",
    "There's no reason to live now.",
    "I've been cutting myself when it gets bad.",
    "Honestly I want to die.",
    "I think everyone would be better off without me.",
    "I have a plan to overdose.",
  ];
  for (const phrase of acute) {
    it(`flags acute: "${phrase}"`, () => {
      expect(keywordRisk(phrase)).toBe("acute");
    });
  }
});

describe("keywordRisk — EXAM IDIOMS must NOT be acute (false-positive guard)", () => {
  const idioms = [
    "this exam is killing me",
    "I'm dead if I fail this paper",
    "I'm dying to get into IIT",
    "this syllabus is murder",
    "honestly I'm so dead if I don't clear the cutoff",
    "the physics portion is killing me but I'll manage",
    "I absolutely killed it in the mock today",
  ];
  for (const phrase of idioms) {
    it(`does NOT flag acute: "${phrase}"`, () => {
      expect(keywordRisk(phrase)).not.toBe("acute");
    });
  }

  it("an idiom in the SAME text as neutral content stays non-acute", () => {
    expect(keywordRisk("Long day. This exam is killing me but I studied 6 hours.")).not.toBe(
      "acute",
    );
  });
});

describe("keywordRisk — ELEVATED (notable distress, not acute)", () => {
  const elevated = [
    "I feel hopeless about all of this.",
    "I'm worthless, nothing I do is good enough.",
    "I feel so empty these days.",
    "I'm completely burnt out.",
    "I am a complete failure.",
  ];
  for (const phrase of elevated) {
    it(`flags elevated: "${phrase}"`, () => {
      expect(keywordRisk(phrase)).toBe("elevated");
    });
  }
});

describe("keywordRisk — NONE (neutral / positive)", () => {
  const neutral = [
    "Studied organic chemistry today, felt pretty good about it.",
    "Took a walk and revised three chapters.",
    "Mock test went okay, scored better than last week.",
    "",
    "   ",
  ];
  for (const phrase of neutral) {
    it(`returns none: ${JSON.stringify(phrase)}`, () => {
      expect(keywordRisk(phrase)).toBe("none");
    });
  }
});

describe("pattern arrays are exported and non-empty (contract sanity)", () => {
  it("ACUTE/ELEVATED/IDIOM pattern banks are present", () => {
    expect(ACUTE_PATTERNS.length).toBeGreaterThan(0);
    expect(ELEVATED_PATTERNS.length).toBeGreaterThan(0);
    expect(EXAM_IDIOM_PATTERNS.length).toBeGreaterThan(0);
  });
});
