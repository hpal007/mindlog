// Pure trends heuristics extracted from app/api/trends/route.ts so they can be
// unit-tested without the route/db. The route imports these back — behavior is
// byte-identical. No I/O, no LLM: all deterministic aggregation over rows.
import type { JournalEntryRow, EntryAnalysisRow } from "@/lib/db/types";

export type Joined = { entry: JournalEntryRow; analysis: EntryAnalysisRow | null };

const TOP_TRIGGERS = 8;

export function computeTopTriggers(rows: Joined[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.analysis?.triggers ?? []) {
      const label = t.label.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, TOP_TRIGGERS);
}

/** Consecutive days (ending today or yesterday) that have at least one entry. */
export function computeStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0;

  // Keep everything in UTC day-space so it matches toDayKey (entries are stored
  // as UTC timestamps); mixing local midnight with UTC keys dropped today's entry.
  const days = new Set(timestamps.map(toDayKey));
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  // Allow the streak to "start" from today or yesterday (grace for not-yet-journaled today).
  if (!days.has(key(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(key(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function toDayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD
}

export function computeInsights(
  rows: Joined[],
  chronological: Joined[],
  topTriggers: { label: string; count: number }[],
  streakDays: number,
): string[] {
  // Empty state — a gentle, encouraging nudge instead of stats.
  if (rows.length === 0) {
    return ["Your trends will appear here once you start journaling. One check-in is all it takes to begin."];
  }

  const insights: string[] = [];

  // 1) Mood-dip correlation with the most common trigger.
  const top = topTriggers[0];
  if (top) {
    const withTrigger: number[] = [];
    const without: number[] = [];
    for (const r of rows) {
      const labels = (r.analysis?.triggers ?? []).map((t) => t.label.toLowerCase());
      (labels.includes(top.label.toLowerCase()) ? withTrigger : without).push(
        r.entry.mood_score,
      );
    }
    if (withTrigger.length >= 1 && without.length >= 1) {
      const dip = average(without) - average(withTrigger);
      if (dip >= 0.3) {
        insights.push(
          `Your mood tends to dip on days you mention "${top.label}" — it came up ${top.count} time${top.count === 1 ? "" : "s"}.`,
        );
      } else {
        insights.push(`"${top.label}" has come up ${top.count} time${top.count === 1 ? "" : "s"} recently — it may be worth a closer look.`);
      }
    } else {
      insights.push(`"${top.label}" has come up ${top.count} time${top.count === 1 ? "" : "s"} recently.`);
    }
  }

  // 2) Recent average mood (last up-to-7 entries).
  const recent = chronological.slice(-7).map((r) => r.entry.mood_score);
  if (recent.length >= 2) {
    const avg = average(recent);
    insights.push(
      `Your average mood across your last ${recent.length} check-ins is ${avg.toFixed(1)} out of 5.`,
    );
  }

  // 3) Streak encouragement (shame-free framing).
  if (streakDays >= 2) {
    insights.push(`You've checked in ${streakDays} day${streakDays === 1 ? "" : "s"} in a row — that consistency matters.`);
  } else if (insights.length < 1) {
    insights.push("You're building a habit of checking in with yourself — keep going at your own pace.");
  }

  return insights.slice(0, 3);
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}
