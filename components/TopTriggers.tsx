import type { TrendsResponse } from "@/lib/schemas";

type TopTrigger = TrendsResponse["topTriggers"][number];

/** Top recurring triggers as a simple horizontal magnitude list. */
export function TopTriggers({ triggers }: { triggers: TopTrigger[] }) {
  if (triggers.length === 0) return null;
  const max = Math.max(...triggers.map((t) => t.count), 1);

  return (
    <ul className="grid gap-2.5" role="list">
      {triggers.map((t) => (
        <li key={t.label} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-ink">{t.label}</span>
            <span className="text-sm text-ink/55">
              {t.count} {t.count === 1 ? "time" : "times"}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--hairline)]"
            role="presentation"
          >
            <div
              className="h-full rounded-full bg-clay-400"
              style={{ width: `${(t.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
