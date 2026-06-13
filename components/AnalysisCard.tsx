import type { EntryAnalysis } from "@/lib/schemas";
import { TriggerChips } from "@/components/TriggerChips";

/**
 * Renders the streamed analysis. While streaming, `liveSummary` shows tokens as
 * they arrive (the region is aria-live so SR users hear progress); once the
 * final structured `analysis` lands, the full breakdown appears.
 */
export function AnalysisCard({
  liveSummary,
  analysis,
  streaming,
}: {
  liveSummary: string;
  analysis: EntryAnalysis | null;
  streaming: boolean;
}) {
  return (
    <section
      aria-label="Your reflection"
      aria-busy={streaming}
      className="paper-card animate-rise p-6"
    >
      <h2 className="text-lg font-extrabold text-ink">What I noticed</h2>

      {/* Live region: announces streaming progress + the final summary. */}
      <p
        aria-live="polite"
        className="mt-2 min-h-[1.5rem] leading-relaxed text-ink/85"
      >
        {streaming && !liveSummary ? (
          <span className="text-ink/50">Reading what you wrote…</span>
        ) : (
          (analysis?.summary || liveSummary)
        )}
        {streaming ? (
          <span aria-hidden="true" className="ml-0.5 text-sage-500">
            ▍
          </span>
        ) : null}
      </p>

      {analysis ? (
        <div className="mt-5 grid gap-5">
          {analysis.triggers.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/55">
                Possible triggers
              </h3>
              <TriggerChips triggers={analysis.triggers} />
            </div>
          ) : null}

          {analysis.emotions.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/55">
                Emotions present
              </h3>
              <ul className="flex flex-wrap gap-2" role="list">
                {analysis.emotions.map((e) => (
                  <li
                    key={e.label}
                    className="rounded-full bg-sage-50 px-3 py-1 text-sm text-sage-600"
                    title={`intensity ${Math.round(e.intensity * 100)}%`}
                  >
                    {e.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.themes.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/55">
                Themes
              </h3>
              <ul className="flex flex-wrap gap-2" role="list">
                {analysis.themes.map((theme) => (
                  <li
                    key={theme}
                    className="rounded-full border border-[var(--hairline)] px-3 py-1 text-sm text-ink/70"
                  >
                    {theme}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
