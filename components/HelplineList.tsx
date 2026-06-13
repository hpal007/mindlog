import type { Helpline } from "@/lib/constants";

/** Shared, tappable helpline list — used by both SOS and the crisis banner. */
export function HelplineList({
  helplines,
}: {
  helplines: readonly Helpline[];
}) {
  return (
    <ul className="grid gap-2.5" role="list">
      {helplines.map((h) => (
        <li key={h.tel}>
          <a
            href={`tel:${h.tel}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-clay-400/40 bg-white/70 px-4 py-3 transition-colors hover:border-clay-500 hover:bg-white"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{h.name}</span>
              {h.note ? (
                <span className="block text-sm text-ink/60">{h.note}</span>
              ) : null}
            </span>
            <span className="shrink-0 whitespace-nowrap font-bold text-clay-600">
              <span aria-hidden="true" className="mr-1">
                ☎
              </span>
              {h.number}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
