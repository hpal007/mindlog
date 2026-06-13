// Lane B — Gemini AI core. Server-side only (route handlers).
//
// ONE structured streaming call per journal entry (efficiency). Streams human-
// facing tokens as chunks arrive, accumulates the full JSON, then Zod-validates
// the structured result before returning it (output validation = security).
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema, ThinkingConfig } from "@google/genai";

import { GEMINI_MODEL, MAX_OUTPUT_TOKENS, THINKING_CONFIG } from "@/lib/constants";

// The runtime API accepts `thinkingBudget` (disables 2.5 thinking so the capped
// output budget goes to the answer), but this SDK version's ThinkingConfig type
// only declares `includeThoughts`. Cast past the stale type; the field is real.
const thinking = THINKING_CONFIG as unknown as ThinkingConfig;
import {
  entryAnalysisSchema,
  copingExerciseSchema,
  EXERCISE_CATEGORIES,
  type EntryAnalysis,
  type CopingExercise,
} from "@/lib/schemas";
import type {
  AnalyzeEntry,
  StreamChat,
  GenerateExercise,
  AnalysisStreamEvent,
} from "@/lib/ai/contract";
import {
  ANALYSIS_SYSTEM_INSTRUCTION,
  buildAnalysisPrompt,
  buildChatSystemInstruction,
  buildChatUserContent,
  EXERCISE_SYSTEM_INSTRUCTION,
  buildExercisePrompt,
} from "@/lib/ai/prompts";

// --- Client (lazily constructed so importing this module never throws) -------
let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// --- Gemini response schemas (hand-built to avoid SDK-version drift) ----------
// These constrain the model; the Zod schemas in lib/schemas are the final gate.
// `summary` is intentionally generated FIRST (propertyOrdering) so the warm,
// human-readable reflection streams to the student immediately while the
// structured fields are still being produced (see analyzeEntry's summary streamer).
const analysisResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "One warm, non-clinical sentence reflecting what the student shared.",
    },
    risk_level: { type: Type.STRING, enum: ["none", "elevated", "acute"] },
    triggers: {
      type: Type.ARRAY,
      maxItems: "8",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          evidence_span: {
            type: Type.STRING,
            description: "A short phrase quoted verbatim from the student's text.",
          },
          confidence: { type: Type.NUMBER },
        },
        required: ["label", "evidence_span", "confidence"],
      },
    },
    emotions: {
      type: Type.ARRAY,
      maxItems: "8",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          intensity: { type: Type.NUMBER },
        },
        required: ["label", "intensity"],
      },
    },
    themes: { type: Type.ARRAY, maxItems: "8", items: { type: Type.STRING } },
  },
  propertyOrdering: ["summary", "risk_level", "triggers", "emotions", "themes"],
  required: ["summary", "risk_level", "triggers", "emotions", "themes"],
};

const exerciseResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    technique: { type: Type.STRING },
    category: { type: Type.STRING, enum: [...EXERCISE_CATEGORIES] },
    addresses_triggers: {
      type: Type.ARRAY,
      maxItems: "10",
      items: { type: Type.STRING },
    },
    steps: {
      type: Type.ARRAY,
      minItems: "1",
      maxItems: "10",
      items: {
        type: Type.OBJECT,
        properties: {
          order: { type: Type.INTEGER },
          text: { type: Type.STRING },
          seconds: { type: Type.INTEGER, nullable: true },
        },
        required: ["order", "text"],
      },
    },
    pros: { type: Type.STRING, nullable: true },
    evidence_basis: { type: Type.STRING, nullable: true },
  },
  required: ["title", "technique", "category", "addresses_triggers", "steps"],
};

// --- Helpers -----------------------------------------------------------------
function safeJsonParse(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Model occasionally wraps JSON in prose/fences; recover the outermost object.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model output was not valid JSON");
  }
}

/** A gentle, safe analysis used only when the model + retry both fail.
 *  risk_level is deliberately "none" here — the deterministic keyword backstop in
 *  lib/safety/classifier.ts runs independently and still trips the crisis path. */
function fallbackAnalysis(): EntryAnalysis {
  return entryAnalysisSchema.parse({
    triggers: [],
    emotions: [],
    themes: [],
    risk_level: "none",
    summary:
      "Thank you for taking a moment to check in with yourself today. Putting your thoughts into words is a meaningful step.",
  });
}

/**
 * Incrementally extracts the value of the leading `summary` JSON string field
 * from a growing raw buffer, returning only the NEWLY-available decoded text on
 * each call. Lets us stream the warm human reflection to the student cleanly
 * (no raw JSON on screen) from the same single structured call. Once the field's
 * closing quote arrives it stops — later fields (triggers/emotions) aren't shown.
 */
function makeSummaryStreamer(): (acc: string) => string {
  let valueStart = -1; // index of the first char of the summary string value
  let emitted = 0; // count of decoded chars already returned
  let done = false;

  return (acc: string): string => {
    if (done) return "";
    if (valueStart === -1) {
      const key = acc.indexOf('"summary"');
      if (key === -1) return "";
      const colon = acc.indexOf(":", key + 9);
      if (colon === -1) return "";
      const openQuote = acc.indexOf('"', colon + 1);
      if (openQuote === -1) return "";
      valueStart = openQuote + 1;
    }

    let decoded = "";
    let closed = false;
    for (let i = valueStart; i < acc.length; i++) {
      const c = acc[i];
      if (c === "\\") {
        const next = acc[i + 1];
        if (next === undefined) break; // incomplete escape — wait for more
        decoded += next === "n" ? "\n" : next === "t" ? " " : next;
        i++;
        continue;
      }
      if (c === '"') {
        closed = true;
        break;
      }
      decoded += c;
    }

    const delta = decoded.slice(emitted);
    emitted = decoded.length;
    if (closed) done = true;
    return delta;
  };
}

// =============================================================================
// analyzeEntry — ONE structured streaming call. Streams the human-readable
// reflection cleanly as it generates, then yields the validated structured
// analysis. No second model call: on a parse miss we salvage the buffer locally
// (avoids a redundant full LLM re-generation) and only then fall back.
// =============================================================================
export const analyzeEntry: AnalyzeEntry = async function* (
  text: string,
): AsyncGenerator<AnalysisStreamEvent> {
  let accumulated = "";

  try {
    const stream = await ai().models.generateContentStream({
      model: GEMINI_MODEL,
      contents: buildAnalysisPrompt(text),
      config: {
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: analysisResponseSchema,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: thinking,
        temperature: 0.4,
      },
    });

    // Stream only the readable `summary` field as it arrives (the model emits it
    // first), so the student sees a warm sentence type out — not raw JSON.
    const nextSummary = makeSummaryStreamer();
    for await (const chunk of stream) {
      const delta = chunk.text;
      if (!delta) continue;
      accumulated += delta;
      const readable = nextSummary(accumulated);
      if (readable) yield { type: "token", text: readable };
    }

    yield { type: "analysis", analysis: entryAnalysisSchema.parse(safeJsonParse(accumulated)) };
  } catch {
    // Parse/transport miss: salvage what streamed (brace extraction in
    // safeJsonParse) WITHOUT a second model call; only fall back if unsalvageable.
    try {
      yield { type: "analysis", analysis: entryAnalysisSchema.parse(safeJsonParse(accumulated)) };
    } catch {
      yield { type: "analysis", analysis: fallbackAnalysis() };
    }
  }
};

// =============================================================================
// streamChat — streaming companion grounded in recent triggers.
// =============================================================================
export const streamChat: StreamChat = async function* (args): AsyncGenerator<string> {
  const history = (args.history ?? [])
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const contents = [
    ...history,
    { role: "user", parts: [{ text: buildChatUserContent(args.message) }] },
  ];

  try {
    const stream = await ai().models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: buildChatSystemInstruction(args.triggers),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: thinking,
        temperature: 0.7,
      },
    });

    let emitted = false;
    for await (const chunk of stream) {
      const delta = chunk.text;
      if (delta) {
        emitted = true;
        yield delta;
      }
    }
    if (!emitted) {
      yield "I'm here with you. Could you tell me a little more about what's on your mind?";
    }
  } catch {
    yield "I'm having trouble responding right now, but I'm still here for you. If things feel overwhelming, please reach out to someone you trust or a helpline.";
  }
};

// =============================================================================
// generateExercise — structured call → Zod-validated CopingExercise, 1 retry.
// =============================================================================
export const generateExercise: GenerateExercise = async (
  triggers: string[],
  context: string,
): Promise<CopingExercise> => {
  const request = {
    model: GEMINI_MODEL,
    contents: buildExercisePrompt(triggers, context),
    config: {
      systemInstruction: EXERCISE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: exerciseResponseSchema,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: thinking,
      temperature: 0.6,
    },
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ai().models.generateContent(request);
      return copingExerciseSchema.parse(safeJsonParse(res.text ?? ""));
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `generateExercise failed: ${lastErr instanceof Error ? lastErr.message : "unknown"}`,
  );
};
