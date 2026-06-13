import type { EXAM_TRACKS } from "@/lib/schemas";

// Seeded, contextual blank-page starters — no API needed. Keyed by a coarse
// mood band and (optionally) exam track. Beats blank-page paralysis for a
// time-starved student. (Market feature #1.)

type ExamTrack = (typeof EXAM_TRACKS)[number];

const BY_MOOD: Record<"low" | "mid" | "high", string[]> = {
  low: [
    "What felt heaviest today — and where in your body did you feel it?",
    "If today had a colour, what would it be, and why?",
    "What is one small thing that did not go wrong today?",
  ],
  mid: [
    "Which part of today drained you the most?",
    "What did you avoid today, and what made it feel hard?",
    "Name one moment you'd quietly like to forget — and one you'd keep.",
  ],
  high: [
    "What gave you a little energy today?",
    "Which study session actually felt like progress?",
    "Who or what made today lighter?",
  ],
};

const BY_TRACK: Partial<Record<ExamTrack, string>> = {
  NEET: "How did Bio / Physics / Chem sit with you today — any subject that's been weighing on you?",
  JEE: "Which topic in Maths or Physics felt like a wall today?",
  CAT: "How did today's mocks or VARC / DILR practice leave you feeling?",
  GATE: "What in your core subject felt clearer — or murkier — today?",
  UPSC: "How is the syllabus feeling right now — ahead, behind, or somewhere in between?",
  CUET: "Which section or subject took the most out of you today?",
};

/** Returns up to 3 contextual prompts for the current mood + track. */
export function suggestPrompts(
  moodScore: number | null,
  track?: ExamTrack,
): string[] {
  const band: "low" | "mid" | "high" =
    moodScore == null || moodScore === 0
      ? "mid"
      : moodScore <= 2
        ? "low"
        : moodScore === 3
          ? "mid"
          : "high";

  const base = [...BY_MOOD[band]];
  const trackPrompt = track ? BY_TRACK[track] : undefined;
  if (trackPrompt) base.unshift(trackPrompt);
  return base.slice(0, 3);
}
