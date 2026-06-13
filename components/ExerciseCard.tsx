"use client";

import { useState } from "react";
import type { RecommendedExercise } from "@/lib/schemas";
import { ExercisePlayer } from "@/components/ExercisePlayer";

const CATEGORY_LABEL: Record<string, string> = {
  breathing: "Breathing",
  grounding: "Grounding",
  "study-reframe": "Study reframe",
  sleep: "Sleep",
  motivation: "Motivation",
};

/**
 * The recommended coping exercise. Surfaces the evidence basis (CBT/grounding/
 * breathing — credibility, not "canned tips") and why it was chosen, then lets
 * the student start the step-by-step player.
 */
export function ExerciseCard({ exercise }: { exercise: RecommendedExercise }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <ExercisePlayer exercise={exercise} onClose={() => setPlaying(false)} />
    );
  }

  return (
    <section aria-labelledby="exercise-title" className="paper-card animate-rise p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-sage-600">
          {CATEGORY_LABEL[exercise.category] ?? exercise.category}
        </span>
        {exercise.evidence_basis ? (
          <span className="rounded-full border border-[var(--hairline)] px-2.5 py-0.5 text-xs font-medium text-ink/60">
            {exercise.evidence_basis}
          </span>
        ) : null}
        {exercise.source === "ai_generated" ? (
          <span className="rounded-full border border-clay-400/40 px-2.5 py-0.5 text-xs font-medium text-clay-500">
            made for you
          </span>
        ) : null}
      </div>

      <h2 id="exercise-title" className="mt-3 text-xl font-extrabold text-ink">
        {exercise.title}
      </h2>

      {exercise.reason ? (
        <p className="mt-2 leading-relaxed text-ink/75">{exercise.reason}</p>
      ) : exercise.pros ? (
        <p className="mt-2 leading-relaxed text-ink/75">{exercise.pros}</p>
      ) : null}

      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="mt-5 rounded-xl bg-sage-600 px-5 py-3 font-bold text-white transition-colors hover:bg-sage-500"
      >
        Start — {exercise.steps.length}{" "}
        {exercise.steps.length === 1 ? "step" : "steps"}
      </button>
    </section>
  );
}
