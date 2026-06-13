"use client";

const MOODS: { score: number; label: string; face: string }[] = [
  { score: 1, label: "Really low", face: "😞" },
  { score: 2, label: "Low", face: "😕" },
  { score: 3, label: "Okay", face: "😐" },
  { score: 4, label: "Good", face: "🙂" },
  { score: 5, label: "Great", face: "😊" },
];

/** Mood 1–5 picker. Radio-group semantics for keyboard + screen readers. */
export function MoodSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (score: number) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">
        How is your mood right now?
      </legend>
      <div role="radiogroup" aria-label="Mood from 1 to 5" className="flex gap-2">
        {MOODS.map((m) => {
          const selected = value === m.score;
          return (
            <button
              key={m.score}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${m.label} (${m.score} of 5)`}
              onClick={() => onChange(m.score)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors ${
                selected
                  ? "border-sage-500 bg-sage-50 ring-1 ring-sage-500"
                  : "border-[var(--hairline)] bg-white/60 hover:border-sage-400"
              }`}
            >
              <span aria-hidden="true" className="text-2xl">
                {m.face}
              </span>
              <span className="text-[11px] font-medium text-ink/70">
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
