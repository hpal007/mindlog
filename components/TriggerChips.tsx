import type { Trigger } from "@/lib/schemas";

/** Detected stress triggers, each with the verbatim evidence span quoted. */
export function TriggerChips({ triggers }: { triggers: Trigger[] }) {
  if (triggers.length === 0) return null;

  return (
    <ul className="grid gap-2.5" role="list">
      {triggers.map((t) => (
        <li
          key={`${t.label}:${t.evidence_span}`}
          className="rounded-xl border border-clay-400/30 bg-clay-400/5 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink">{t.label}</span>
            <span
              className="shrink-0 text-xs font-medium text-ink/50"
              aria-label={`confidence ${Math.round(t.confidence * 100)} percent`}
            >
              {Math.round(t.confidence * 100)}%
            </span>
          </div>
          <p className="mt-1 text-sm italic text-ink/65">
            <span aria-hidden="true">“</span>
            {t.evidence_span}
            <span aria-hidden="true">”</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
