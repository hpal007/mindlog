// Unit tests for the pure trends heuristics extracted from app/api/trends/route.ts.
// These cover the streak day-space math (UTC, today/yesterday grace, gaps) and the
// insight branches (mood-dip correlation vs plain mention vs recent-average). All
// deterministic — no db, no LLM. Assertions are on specific values/strings.
import { describe, it, expect } from "vitest";
import { computeStreak, computeInsights, type Joined } from "@/lib/trends-logic";

// A UTC midnight `daysAgo` days back, as an ISO timestamp the route stores.
function utcDaysAgoIso(daysAgo: number, hour = 12): string {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function joined(daysAgo: number, mood: number, triggerLabels: string[]): Joined {
  const date = utcDaysAgoIso(daysAgo);
  return {
    entry: {
      id: `e-${daysAgo}`,
      user_id: "u",
      body: "x",
      mood_score: mood,
      mood_tags: [],
      created_at: date,
    },
    analysis: {
      id: `a-${daysAgo}`,
      entry_id: `e-${daysAgo}`,
      user_id: "u",
      triggers: triggerLabels.map((label) => ({
        label,
        evidence_span: "span",
        confidence: 0.8,
      })),
      emotions: [],
      themes: [],
      risk_level: "none",
      summary: "s",
      model: "gemini",
      created_at: date,
    },
  };
}

describe("computeStreak", () => {
  it("(a) N consecutive days ending today → N", () => {
    const ts = [0, 1, 2, 3, 4].map((d) => utcDaysAgoIso(d));
    expect(computeStreak(ts)).toBe(5);
  });

  it("(b) today not yet journaled but yesterday onward → grace counts the run", () => {
    // No entry for today (daysAgo 0); 3 consecutive ending yesterday.
    const ts = [1, 2, 3].map((d) => utcDaysAgoIso(d));
    expect(computeStreak(ts)).toBe(3);
  });

  it("(c) a gap breaks the streak → only the most-recent run counts", () => {
    // Today + yesterday, then a gap at 2 days ago, then 3 & 4 days ago.
    const ts = [0, 1, 3, 4].map((d) => utcDaysAgoIso(d));
    expect(computeStreak(ts)).toBe(2);
  });

  it("(c2) neither today nor yesterday present → 0 even with older entries", () => {
    const ts = [2, 3, 4].map((d) => utcDaysAgoIso(d));
    expect(computeStreak(ts)).toBe(0);
  });

  it("(d) empty → 0", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("dedupes multiple entries on the same UTC day", () => {
    const ts = [utcDaysAgoIso(0, 8), utcDaysAgoIso(0, 20), utcDaysAgoIso(1, 10)];
    expect(computeStreak(ts)).toBe(2);
  });
});

describe("computeInsights", () => {
  it("empty rows → the single encouraging empty-state string", () => {
    expect(computeInsights([], [], [], 0)).toEqual([
      "Your trends will appear here once you start journaling. One check-in is all it takes to begin.",
    ]);
  });

  it("(dip branch) a mood dip correlates with the top trigger → dip phrasing", () => {
    // Days WITH "mock test" are low mood (2); days WITHOUT are high (5) → dip ≥ 0.3.
    const rows: Joined[] = [
      joined(0, 2, ["mock test"]),
      joined(1, 2, ["mock test"]),
      joined(2, 5, ["parents"]),
      joined(3, 5, ["sleep"]),
    ];
    const top = [{ label: "mock test", count: 2 }];
    const insights = computeInsights(rows, rows, top, 1);
    expect(insights[0]).toBe(
      'Your mood tends to dip on days you mention "mock test" — it came up 2 times.',
    );
  });

  it("(no-dip branch) trigger present but no mood dip → 'worth a closer look' phrasing", () => {
    // WITH and WITHOUT both moderate → dip < 0.3, but both groups non-empty.
    const rows: Joined[] = [
      joined(0, 4, ["mock test"]),
      joined(1, 4, ["mock test"]),
      joined(2, 4, ["parents"]),
    ];
    const top = [{ label: "mock test", count: 2 }];
    const insights = computeInsights(rows, rows, top, 1);
    expect(insights[0]).toBe(
      '"mock test" has come up 2 times recently — it may be worth a closer look.',
    );
  });

  it("(mention-only branch) trigger in every entry → plain 'has come up' phrasing", () => {
    // Every row has the trigger → `without` is empty → the else branch fires.
    const rows: Joined[] = [
      joined(0, 3, ["mock test"]),
      joined(1, 3, ["mock test"]),
    ];
    const top = [{ label: "mock test", count: 2 }];
    const insights = computeInsights(rows, rows, top, 1);
    expect(insights[0]).toBe('"mock test" has come up 2 times recently.');
  });

  it("singular trigger count uses 'time' not 'times' (dip branch)", () => {
    // One low-mood day WITH the trigger, one high-mood day WITHOUT → dip ≥ 0.3.
    const rows: Joined[] = [
      joined(0, 2, ["mock test"]),
      joined(1, 5, ["parents"]),
    ];
    const top = [{ label: "mock test", count: 1 }];
    const insights = computeInsights(rows, rows, top, 1);
    expect(insights[0]).toBe(
      'Your mood tends to dip on days you mention "mock test" — it came up 1 time.',
    );
    expect(insights[0]).not.toContain("1 times");
  });

  it("(recent-average insight) reports the exact average string over the last entries", () => {
    // chronological moods 2,4 → avg 3.0 out of 5 across 2 check-ins.
    const rows: Joined[] = [joined(1, 4, ["parents"]), joined(0, 2, ["sleep"])];
    const chronological: Joined[] = [joined(1, 2, ["parents"]), joined(0, 4, ["sleep"])];
    const insights = computeInsights(rows, chronological, [], 0);
    expect(insights).toContain(
      "Your average mood across your last 2 check-ins is 3.0 out of 5.",
    );
  });

  it("(streak-encouragement branch) streakDays ≥ 2 → consistency message", () => {
    const rows: Joined[] = [joined(0, 3, []), joined(1, 3, [])];
    const insights = computeInsights(rows, rows, [], 4);
    expect(insights).toContain(
      "You've checked in 4 days in a row — that consistency matters.",
    );
  });

  it("caps at 3 insights", () => {
    const rows: Joined[] = [
      joined(0, 2, ["mock test"]),
      joined(1, 2, ["mock test"]),
      joined(2, 5, ["parents"]),
    ];
    const top = [{ label: "mock test", count: 2 }];
    const insights = computeInsights(rows, rows, top, 5);
    expect(insights.length).toBeLessThanOrEqual(3);
  });
});
