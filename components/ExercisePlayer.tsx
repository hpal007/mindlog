"use client";

import { useEffect, useState } from "react";
import type { RecommendedExercise } from "@/lib/schemas";

/**
 * Step-by-step guided player. Steps with `seconds` get a calm countdown with a
 * breathing ring; untimed steps advance manually. Restrained motion — the ring
 * animation is disabled under prefers-reduced-motion (handled in globals.css).
 */
export function ExercisePlayer({
  exercise,
  onClose,
}: {
  exercise: RecommendedExercise;
  onClose?: () => void;
}) {
  const close = onClose ?? (() => {});
  const steps = [...exercise.steps].sort((a, b) => a.order - b.order);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const [remaining, setRemaining] = useState<number | null>(null);

  // Start/refresh the timer when entering a timed step.
  useEffect(() => {
    setRemaining(step?.seconds ?? null);
  }, [step]);

  // Tick down each second for timed steps.
  useEffect(() => {
    if (remaining == null || remaining <= 0) return;
    const id = setTimeout(() => setRemaining((r) => (r == null ? null : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  if (!step) return null;

  const next = () => {
    if (isLast) close();
    else setIndex((i) => i + 1);
  };

  return (
    <section
      aria-labelledby="player-title"
      className="paper-card animate-rise p-6"
    >
      <div className="flex items-center justify-between">
        <h2 id="player-title" className="text-lg font-extrabold text-ink">
          {exercise.title}
        </h2>
        <button
          type="button"
          onClick={close}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-ink/55 hover:text-ink"
        >
          Close
        </button>
      </div>

      <p
        className="mt-1 text-xs font-medium text-ink/50"
        aria-live="polite"
      >
        Step {index + 1} of {steps.length}
      </p>

      {/* Progress bar */}
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hairline)]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
        aria-label="Exercise progress"
      >
        <div
          className="h-full rounded-full bg-sage-500 transition-[width] duration-500"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>

      {remaining != null ? (
        <div className="my-6 flex flex-col items-center">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <div
              aria-hidden="true"
              className="animate-breathe absolute inset-0 rounded-full bg-sage-100"
            />
            <span className="relative text-3xl font-extrabold tabular-nums text-sage-600">
              {remaining}
            </span>
          </div>
          <p className="mt-3 text-sm text-ink/60" aria-hidden="true">
            {remaining > 0 ? "Breathe with the circle" : "Done — take your time"}
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-lg leading-relaxed text-ink/90">{step.text}</p>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-xl border border-[var(--hairline)] px-4 py-2.5 font-semibold text-ink/70 transition-colors hover:border-sage-400 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={next}
          className="flex-1 rounded-xl bg-sage-600 px-5 py-2.5 font-bold text-white transition-colors hover:bg-sage-500"
        >
          {isLast ? "Finish" : "Next"}
        </button>
      </div>
    </section>
  );
}

export default ExercisePlayer;
