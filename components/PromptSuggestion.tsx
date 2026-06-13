"use client";

import type { EXAM_TRACKS } from "@/lib/schemas";
import { suggestPrompts } from "@/components/lib/prompts";

type ExamTrack = (typeof EXAM_TRACKS)[number];

/**
 * Contextual blank-page starters, keyed by mood + optional exam track. Tapping
 * one seeds the journal. Local prompt bank — no API call. (Market feature #1.)
 */
export function PromptSuggestion({
  moodScore,
  track,
  onPick,
}: {
  moodScore: number | null;
  track?: ExamTrack;
  onPick: (prompt: string) => void;
}) {
  const prompts = suggestPrompts(moodScore, track);

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink/70">
        <span aria-hidden="true" className="mr-1">
          ✷
        </span>
        Not sure where to start? Try one:
      </p>
      <ul className="flex flex-col gap-2" role="list">
        {prompts.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="w-full rounded-xl border border-dashed border-sage-400/60 bg-sage-50/50 px-3.5 py-2.5 text-left text-sm text-ink/80 transition-colors hover:border-sage-500 hover:bg-sage-50"
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
