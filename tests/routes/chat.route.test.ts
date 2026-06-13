// @vitest-environment node
//
// Orchestration tests for POST /api/chat. LLM + DB mocked.
// Covers streaming success (tokens stream out + assistant turn persisted) and the
// acute hard-stop (crisis JSON, streamChat NEVER called).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readStreamText, jsonRequest } from "../helpers/readStream";

const { streamChat, checkRateLimit, db } = vi.hoisted(() => ({
  streamChat: vi.fn(),
  checkRateLimit: vi.fn(),
  db: {
    insertChatMessage: vi.fn(),
    insertCrisisEvent: vi.fn(),
    getRecentEntriesWithAnalyses: vi.fn(),
    getRecentChat: vi.fn(),
  },
}));

vi.mock("@/lib/ai/gemini", () => ({ streamChat, analyzeEntry: vi.fn(), generateExercise: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit, rateLimitKeyFromRequest: () => "00000000-0000-0000-0000-000000000001" }));
vi.mock("@/lib/db", () => ({ db }));

import { POST } from "@/app/api/chat/route";

function tokensOf(tokens: string[]) {
  return async function* () {
    for (const t of tokens) yield t;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });
  db.insertChatMessage.mockResolvedValue({ id: "m1" });
  db.insertCrisisEvent.mockResolvedValue(undefined);
  db.getRecentEntriesWithAnalyses.mockResolvedValue([]);
  db.getRecentChat.mockResolvedValue([]);
});

describe("POST /api/chat — streaming success", () => {
  it("streams tokens and persists the assistant reply", async () => {
    streamChat.mockImplementation(tokensOf(["Hey, ", "I'm here ", "with you."]));

    const res = await POST(jsonRequest({ message: "I bombed my mock and feel low." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");

    const text = await readStreamText(res);
    expect(text).toBe("Hey, I'm here with you.");

    expect(streamChat).toHaveBeenCalledOnce();
    // user turn + assistant turn persisted.
    expect(db.insertChatMessage).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001", "user", expect.any(String), null);
    expect(db.insertChatMessage).toHaveBeenCalledWith(
      expect.any(String),
      "assistant",
      "Hey, I'm here with you.",
      null,
    );
  });
});

describe("POST /api/chat — acute hard-stop", () => {
  it("returns crisis JSON and NEVER calls the model on an acute message", async () => {
    const res = await POST(jsonRequest({ message: "I want to kill myself." }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { risk: string; helplines: unknown[] };
    expect(body.risk).toBe("acute");
    expect(Array.isArray(body.helplines)).toBe(true);
    expect(body.helplines.length).toBeGreaterThan(0);

    expect(streamChat).not.toHaveBeenCalled();
    expect(db.insertCrisisEvent).toHaveBeenCalledOnce();
  });
});

describe("POST /api/chat — validation", () => {
  it("rejects an empty message with 400", async () => {
    const res = await POST(jsonRequest({ message: "" }));
    expect(res.status).toBe(400);
    expect(streamChat).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat — rate limit 429", () => {
  it("returns 429 and never calls the model when not allowed", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await POST(jsonRequest({ message: "I bombed my mock and feel low." }));
    expect(res.status).toBe(429);
    expect(streamChat).not.toHaveBeenCalled();
  });
});
