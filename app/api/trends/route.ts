// GET /api/trends — aggregated mood/trigger trends + plain-language pattern
// insights ("Your mood dips on days you mention mock test"). All heuristic, no
// LLM call (Efficiency). Empty-state safe. Response is Zod-validated before send.
import "server-only";

import { trendsResponseSchema, type TrendsResponse } from "@/lib/schemas";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/constants";
import { jsonError } from "@/lib/http";
import { computeTopTriggers, computeStreak, computeInsights } from "@/lib/trends-logic";

export const runtime = "nodejs";

const LOOKBACK = 60;

export async function GET(): Promise<Response> {
  const userId = DEMO_USER_ID;

  try {
    const rows = await db.getRecentEntriesWithAnalyses(userId, LOOKBACK);

    // Chronological (oldest → newest) for the mood series.
    const chronological = [...rows].sort(
      (a, b) =>
        new Date(a.entry.created_at).getTime() - new Date(b.entry.created_at).getTime(),
    );

    const moodSeries = chronological.map((r) => ({
      date: r.entry.created_at,
      mood_score: r.entry.mood_score,
    }));

    const topTriggers = computeTopTriggers(rows);
    const streakDays = computeStreak(rows.map((r) => r.entry.created_at));
    const insights = computeInsights(rows, chronological, topTriggers, streakDays);

    const response: TrendsResponse = trendsResponseSchema.parse({
      moodSeries,
      topTriggers,
      insights,
      entryCount: rows.length,
      streakDays,
    });

    return Response.json(response);
  } catch {
    return jsonError(500, "Something went wrong loading your trends.");
  }
}
