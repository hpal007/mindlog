"use client";

import { useEffect, useState } from "react";
import type { TrendsResponse } from "@/lib/schemas";
import { trendsResponseSchema } from "@/lib/schemas";
import { TrendsChart } from "@/components/TrendsChart";
import { TopTriggers } from "@/components/TopTriggers";
import { InsightCard } from "@/components/InsightCard";
import { StreakBadge } from "@/components/StreakBadge";
import { EmptyState } from "@/components/EmptyState";

/** Fetches GET /api/trends and renders the mood chart, triggers, and insights. */
export function TrendsView() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/trends");
        if (!res.ok) throw new Error("trends failed");
        const json = await res.json();
        const parsed = trendsResponseSchema.parse(json);
        if (alive) {
          setData(parsed);
          setStatus("ready");
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <p className="py-10 text-center text-ink/55" aria-live="polite" aria-busy="true">
        Gathering your patterns…
      </p>
    );
  }

  if (status === "error") {
    return (
      <p role="alert" className="py-10 text-center text-clay-500">
        We could not load your trends just now. Please try again.
      </p>
    );
  }

  if (!data || data.entryCount < 1) {
    return (
      <EmptyState
        icon="📈"
        title="Your patterns will grow here"
        body="Once you have journaled a few times, MindLog shows how your mood moves and the triggers that come up most. Keep checking in."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StreakBadge days={data.streakDays} />
        <span className="text-sm text-ink/55">
          {data.entryCount} {data.entryCount === 1 ? "entry" : "entries"} so far
        </span>
      </div>

      <section aria-labelledby="mood-trend" className="paper-card p-6">
        <h2 id="mood-trend" className="text-lg font-extrabold text-ink">
          Mood over time
        </h2>
        <div className="mt-4">
          <TrendsChart series={data.moodSeries} />
        </div>
      </section>

      {data.topTriggers.length > 0 ? (
        <section aria-labelledby="top-triggers" className="paper-card p-6">
          <h2 id="top-triggers" className="text-lg font-extrabold text-ink">
            What comes up most
          </h2>
          <div className="mt-4">
            <TopTriggers triggers={data.topTriggers} />
          </div>
        </section>
      ) : null}

      {data.insights.length > 0 ? (
        <section aria-labelledby="insights" className="paper-card p-6">
          <h2 id="insights" className="text-lg font-extrabold text-ink">
            Patterns I noticed
          </h2>
          <ul className="mt-4 grid gap-2.5" role="list">
            {data.insights.map((text) => (
              <InsightCard key={text} text={text} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
