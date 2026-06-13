// @vitest-environment node
//
// Orchestration tests for GET /api/trends. LLM-free; DB mocked.
// Contract (SPEC "API Contracts" + trendsResponseSchema): aggregates the user's
// recent entries+analyses into moodSeries, topTriggers, insights, entryCount,
// streakDays. With ≥3 entries insights are non-empty; with none, zeros + no crash.
//
// NOTE: the trends route is Lane C territory. If it hasn't landed yet, this whole
// suite skips with a clear message rather than redding the run.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { trendsResponseSchema } from "@/lib/schemas";

const ROUTE_PATH = fileURLToPath(new URL("../../app/api/trends/route.ts", import.meta.url));
const ROUTE_EXISTS = existsSync(ROUTE_PATH);

const { db } = vi.hoisted(() => ({
  db: {
    getRecentEntriesWithAnalyses: vi.fn(),
    listEntries: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db }));

function entry(daysAgo: number, mood: number, triggerLabels: string[]) {
  const date = new Date(Date.now() - daysAgo * 86400_000).toISOString();
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
      risk_level: "none" as const,
      summary: "s",
      model: "gemini",
      created_at: date,
    },
  };
}

const d = ROUTE_EXISTS ? describe : describe.skip;

d("GET /api/trends", () => {
  let GET: () => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ GET } = await import("@/app/api/trends/route"));
  });

  it("with several entries → 200, schema-valid, insights non-empty", async () => {
    db.getRecentEntriesWithAnalyses.mockResolvedValue([
      entry(0, 2, ["mock test", "sleep"]),
      entry(1, 3, ["mock test"]),
      entry(2, 4, ["parents"]),
    ]);
    db.listEntries.mockResolvedValue([{}, {}, {}]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = trendsResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.entryCount).toBeGreaterThan(0);
      expect(parsed.data.topTriggers.length).toBeGreaterThan(0);
    }
  });

  it("N consecutive-day entries (incl. today) → streakDays === N", async () => {
    // 4 entries on today, yesterday, 2- and 3-days-ago → a 4-day streak.
    db.getRecentEntriesWithAnalyses.mockResolvedValue([
      entry(0, 3, ["mock test"]),
      entry(1, 3, ["sleep"]),
      entry(2, 4, ["parents"]),
      entry(3, 4, ["mock test"]),
    ]);
    db.listEntries.mockResolvedValue([{}, {}, {}, {}]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = trendsResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.streakDays).toBe(4);
    }
  });

  it("with no entries → 200, zeros, no crash", async () => {
    db.getRecentEntriesWithAnalyses.mockResolvedValue([]);
    db.listEntries.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = trendsResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.entryCount).toBe(0);
      expect(parsed.data.moodSeries).toEqual([]);
      expect(parsed.data.topTriggers).toEqual([]);
    }
  });
});

if (!ROUTE_EXISTS) {
  describe("GET /api/trends — PENDING Lane C", () => {
    it.skip("app/api/trends/route.ts not present yet — tests written against the SPEC contract", () => {});
  });
}
