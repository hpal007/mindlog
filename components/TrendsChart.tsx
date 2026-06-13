import type { TrendsResponse } from "@/lib/schemas";

type MoodPoint = TrendsResponse["moodSeries"][number];

/**
 * Lightweight inline-SVG mood line chart — no chart library. Mood 1–5 over time.
 * Accessible: an aria-label summary + an sr-only data table so the trend is
 * readable without sight; decorative SVG marked aria-hidden.
 */
export function TrendsChart({ series }: { series: MoodPoint[] }) {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last) return null;

  const W = 640;
  const H = 180;
  const pad = { top: 16, right: 16, bottom: 28, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const x = (i: number) =>
    series.length === 1
      ? pad.left + innerW / 2
      : pad.left + (i / (series.length - 1)) * innerW;
  // mood 1..5 → bottom..top
  const y = (m: number) => pad.top + (1 - (m - 1) / 4) * innerH;

  const line = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.mood_score).toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${x(series.length - 1).toFixed(1)} ${pad.top + innerH} L ${x(0).toFixed(1)} ${pad.top + innerH} Z`;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const avg = series.reduce((s, p) => s + p.mood_score, 0) / series.length;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Mood over ${series.length} entries, from ${fmt(first.date)} to ${fmt(last.date)}, averaging ${avg.toFixed(1)} out of 5.`}
      >
        {[1, 2, 3, 4, 5].map((m) => (
          <g key={m} aria-hidden="true">
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(m)}
              y2={y(m)}
              stroke="#e7e0d4"
              strokeWidth={1}
            />
            <text x={4} y={y(m) + 4} fontSize={10} fill="#3a4556">
              {m}
            </text>
          </g>
        ))}
        <path d={area} fill="#dcebe2" opacity={0.6} aria-hidden="true" />
        <path
          d={line}
          fill="none"
          stroke="#3f7d61"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          aria-hidden="true"
        />
        {series.map((p, i) => (
          <circle
            key={p.date}
            cx={x(i)}
            cy={y(p.mood_score)}
            r={3.5}
            fill="#2f6149"
            aria-hidden="true"
          />
        ))}
      </svg>

      <figcaption className="sr-only">
        <table>
          <caption>Mood score by date</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Mood (1–5)</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.date}>
                <th scope="row">{fmt(p.date)}</th>
                <td>{p.mood_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
