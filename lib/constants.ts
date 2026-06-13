// LOCKED shared constants. Single source for cross-lane values. Do not duplicate.

/** Gemini fast tier. Swap here if a newer flash model is confirmed at build time. */
export const GEMINI_MODEL = "gemini-2.0-flash";

/** Hard cap on model output — efficiency (avoid runaway token spend / latency). */
export const MAX_OUTPUT_TOKENS = 1024;

/** Seeded demo session under the 1hr clock (no real auth). RLS still enforced. */
export const DEMO_USER_ID =
  process.env.DEMO_USER_ID ?? "00000000-0000-0000-0000-000000000001";

/** Rate limit: max paid (LLM) calls per user per rolling window. */
export const RATE_LIMIT_MAX = 30;
export const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour

/** Library match threshold — best candidate must clear this to be reused vs generated. */
export const LIBRARY_MATCH_THRESHOLD = 0.4;

export type RiskLevel = "none" | "elevated" | "acute";

/** India mental-health helplines shown on the crisis path + always-visible SOS. */
export interface Helpline {
  name: string;
  number: string;
  /** Digits-only for the tel: link. */
  tel: string;
  note?: string;
}

export const HELPLINES: readonly Helpline[] = [
  { name: "KIRAN (National)", number: "1800-599-0019", tel: "18005990019", note: "24/7, 13 languages" },
  { name: "Tele-MANAS", number: "14416", tel: "14416", note: "Govt. of India, 24/7" },
  { name: "AASRA", number: "+91-9820466726", tel: "+919820466726", note: "24/7 emotional support" },
  { name: "iCall (TISS)", number: "+91-9152987821", tel: "+919152987821", note: "Mon–Sat, 8am–10pm" },
] as const;

export const DISCLAIMER_TEXT =
  "MindLog is a supportive companion, not a medical or clinical service. It is not for emergencies and not a substitute for professional care. Your entries are private to you.";

export const CRISIS_GROUNDING_MESSAGE =
  "You matter, and you do not have to face this alone. If you are in danger or thinking of harming yourself, please reach out to one of the helplines below right now, or talk to a trusted adult or professional.";
