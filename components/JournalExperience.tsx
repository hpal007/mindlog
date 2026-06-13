"use client";

import { useState } from "react";
import type {
  JournalEntryInput,
  EntryAnalysis,
  RecommendedExercise,
  CrisisPayload,
} from "@/lib/schemas";
import {
  entriesResultSchema,
  crisisPayloadSchema,
} from "@/lib/schemas";
import { readNdjson } from "@/components/lib/stream";
import { JournalEditor } from "@/components/JournalEditor";
import { AnalysisCard } from "@/components/AnalysisCard";
import { ExerciseCard } from "@/components/ExerciseCard";
import { CrisisResourceBanner } from "@/components/CrisisResourceBanner";

type Phase = "idle" | "streaming" | "done";

/**
 * Owns the core flow: submit journal → POST /api/entries → consume the NDJSON
 * stream live (tokens append to the summary) → render the final EntryAnalysis
 * + recommended exercise, OR the crisis banner if the result is acute.
 */
export function JournalExperience() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveSummary, setLiveSummary] = useState("");
  const [analysis, setAnalysis] = useState<EntryAnalysis | null>(null);
  const [exercise, setExercise] = useState<RecommendedExercise | null>(null);
  const [crisis, setCrisis] = useState<CrisisPayload | null>(null);
  const [error, setError] = useState(false);

  const reset = () => {
    setPhase("idle");
    setLiveSummary("");
    setAnalysis(null);
    setExercise(null);
    setCrisis(null);
    setError(false);
  };

  const submit = async (input: JournalEntryInput) => {
    reset();
    setPhase("streaming");

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok || !res.body) throw new Error("entries failed");

      await readNdjson(res.body, (obj) => {
        const line = obj as Record<string, unknown>;

        if (line.type === "token" && typeof line.text === "string") {
          setLiveSummary((s) => s + line.text);
          return;
        }

        if (line.type === "result") {
          const result = line.result ?? line;
          // Crisis short-circuit (acute) — render banner instead of exercise.
          const asCrisis = crisisPayloadSchema.safeParse(result);
          if (asCrisis.success) {
            setCrisis(asCrisis.data);
            return;
          }
          const asResult = entriesResultSchema.safeParse(result);
          if (asResult.success) {
            setAnalysis(asResult.data.analysis);
            setExercise(asResult.data.recommendation);
          }
        }
      });
    } catch {
      setError(true);
    } finally {
      setPhase("done");
    }
  };

  const showJournal = phase === "idle";

  return (
    <div className="grid gap-6">
      {showJournal ? (
        <>
          <p className="text-[15px] leading-relaxed text-ink/70">
            Take a breath. Write what is actually on your mind — I will help you
            notice the patterns underneath.
          </p>
          <JournalEditor busy={false} onSubmit={submit} />
        </>
      ) : null}

      {!showJournal && crisis ? (
        <CrisisResourceBanner payload={crisis} />
      ) : null}

      {!showJournal && !crisis ? (
        <>
          <AnalysisCard
            liveSummary={liveSummary}
            analysis={analysis}
            streaming={phase === "streaming"}
          />
          {error ? (
            <p role="alert" className="text-sm text-clay-500">
              Something went wrong while reflecting. Please try again.
            </p>
          ) : null}
          {phase === "done" && exercise ? (
            <ExerciseCard exercise={exercise} />
          ) : null}
        </>
      ) : null}

      {phase === "done" ? (
        <button
          type="button"
          onClick={reset}
          className="justify-self-start rounded-xl border border-[var(--hairline)] px-4 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:border-sage-400"
        >
          ← Write another entry
        </button>
      ) : null}
    </div>
  );
}
