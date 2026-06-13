"use client";

import { useState } from "react";
import type { EXAM_TRACKS, JournalEntryInput } from "@/lib/schemas";
import { MoodSelector } from "@/components/MoodSelector";
import { EmotionPicker } from "@/components/EmotionPicker";
import { PromptSuggestion } from "@/components/PromptSuggestion";

type ExamTrack = (typeof EXAM_TRACKS)[number];

/**
 * The journaling form. Composes mood + emotion + prompts + free text, validates
 * lightly client-side, and hands a typed JournalEntryInput up on submit.
 */
export function JournalEditor({
  track,
  busy = false,
  onSubmit,
}: {
  track?: ExamTrack;
  busy?: boolean;
  onSubmit?: (input: JournalEntryInput) => void;
}) {
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  const toggleTag = (tag: string) =>
    setTags((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag],
    );

  const seedPrompt = (prompt: string) =>
    setBody((cur) => (cur ? cur : prompt + "\n\n"));

  const canSubmit = body.trim().length > 0 && mood != null && !busy;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || mood == null) return;
    onSubmit?.({
      body: body.trim(),
      mood_score: mood,
      mood_tags: tags,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="paper-card animate-rise p-6">
      <div className="grid gap-6">
        <MoodSelector value={mood} onChange={setMood} />

        <div>
          <label
            htmlFor="journal-body"
            className="mb-2 block text-sm font-semibold text-ink"
          >
            What is on your mind today?
          </label>
          <textarea
            id="journal-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={6}
            placeholder="Write as freely as you like. No one else sees this."
            className="w-full resize-y rounded-xl border border-[var(--hairline)] bg-white/70 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink/60"
          />
          <p className="mt-1 text-right text-xs text-ink/70" aria-live="polite">
            {body.length}/5000
          </p>
        </div>

        {body.trim().length === 0 ? (
          <PromptSuggestion moodScore={mood} track={track} onPick={seedPrompt} />
        ) : null}

        <EmotionPicker selected={tags} onToggle={toggleTag} />

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-sage-600 px-5 py-3 font-bold text-white transition-colors hover:bg-sage-500 disabled:cursor-not-allowed disabled:bg-ink/20"
        >
          {busy ? "Reflecting…" : "Reflect with me"}
        </button>
        {mood == null ? (
          <p className="-mt-3 text-xs text-ink/70">
            Pick a mood and write a little to continue.
          </p>
        ) : null}
      </div>
    </form>
  );
}

export default JournalEditor;
