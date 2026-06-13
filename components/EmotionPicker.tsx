"use client";

// Curated, nuanced emotion vocabulary (How We Feel style). Precise naming →
// better-targeted coping. These feed mood_tags on the journal entry.
const EMOTIONS = [
  "anxious",
  "overwhelmed",
  "burnt-out",
  "numb",
  "restless",
  "lonely",
  "frustrated",
  "discouraged",
  "pressured",
  "hopeful",
  "calm",
  "focused",
  "grateful",
  "relieved",
] as const;

/** Multi-select nuanced-emotion chips → mood_tags. */
export function EmotionPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">
        What words fit today? <span className="font-normal text-ink/70">(optional)</span>
      </legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Emotion words">
        {EMOTIONS.map((tag) => {
          const on = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(tag)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                on
                  ? "border-sage-500 bg-sage-500 text-white"
                  : "border-[var(--hairline)] bg-white/60 text-ink/75 hover:border-sage-400"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
