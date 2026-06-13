// POST /api/chat — empathetic streaming companion grounded in recent triggers.
//
// Safety FIRST: every user message is scanned by the deterministic keyword
// backstop before any LLM call (students vent in chat, not only journals). On an
// acute hit the companion HARD-STOPS — no LLM, no "treating" the crisis — and
// returns a JSON crisis payload so the UI escalates to the crisis banner. Else it
// streams Gemini tokens token-by-token (real streaming for Efficiency) and
// persists the full assistant reply when the stream completes. Generic errors.
import "server-only";

import { chatTurnSchema, crisisPayloadSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { streamChat } from "@/lib/ai/gemini";
import { keywordRisk } from "@/lib/safety/classifier";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  DEMO_USER_ID,
  HELPLINES,
  CRISIS_GROUNDING_MESSAGE,
} from "@/lib/constants";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60; // allow Gemini streaming to run past the 10s default

const RECENT_TRIGGER_ENTRIES = 5;
const RECENT_CHAT_TURNS = 10;

export async function POST(req: Request): Promise<Response> {
  const userId = DEMO_USER_ID;

  try {
    // 1) Rate-limit the paid endpoint.
    const limit = await checkRateLimit(userId);
    if (!limit.allowed) {
      return jsonError(429, "You're sending messages quickly. Please pause a moment.");
    }

    // 2) Validate input.
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonError(400, "Invalid input");
    }
    const parsed = chatTurnSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "Invalid input");
    }
    const { message, entry_id } = parsed.data;
    const entryId = entry_id ?? null;

    // 3) SAFETY GATE — deterministic scan BEFORE any LLM call.
    if (keywordRisk(message) === "acute") {
      // Persist the user's message (so the crisis event has context) but never
      // call the model — hard-stop and escalate to the crisis banner.
      await db.insertChatMessage(userId, "user", message, entryId);
      await db.insertCrisisEvent(userId, entryId, "acute", { source: "chat" });
      const crisis = crisisPayloadSchema.parse({
        risk: "acute" as const,
        message: CRISIS_GROUNDING_MESSAGE,
        helplines: HELPLINES,
      });
      return Response.json(crisis);
    }

    // 4) Persist the user turn, then gather grounding context.
    await db.insertChatMessage(userId, "user", message, entryId);

    const [recent, history] = await Promise.all([
      db.getRecentEntriesWithAnalyses(userId, RECENT_TRIGGER_ENTRIES),
      db.getRecentChat(userId, RECENT_CHAT_TURNS),
    ]);

    // Flatten recent analysis trigger labels (dedup, keep it lean) to ground the
    // companion in what the student has actually been struggling with.
    const triggers = dedupe(
      recent.flatMap((r) => (r.analysis?.triggers ?? []).map((t) => t.label)),
    ).slice(0, 8);

    // History for the model is chronological, role+content only.
    const modelHistory = history.map((m) => ({ role: m.role, content: m.content }));

    // 5) Stream assistant tokens; accumulate the full reply and persist on close.
    let assistantReply = "";
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const token of streamChat({ message, history: modelHistory, triggers })) {
            if (!token) continue;
            assistantReply += token;
            controller.enqueue(encoder.encode(token));
          }
        } catch {
          const fallback =
            "I'm having trouble responding right now, but I'm still here for you.";
          assistantReply += assistantReply ? "" : fallback;
          try {
            controller.enqueue(encoder.encode(assistantReply ? "" : fallback));
          } catch {
            /* controller may already be closed */
          }
        } finally {
          // Persist the full assistant turn (best-effort) before closing.
          if (assistantReply.trim()) {
            try {
              await db.insertChatMessage(userId, "assistant", assistantReply, entryId);
            } catch {
              /* persistence failure must not break the client stream */
            }
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return jsonError(500, "Something went wrong. Please try again.");
  }
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}
