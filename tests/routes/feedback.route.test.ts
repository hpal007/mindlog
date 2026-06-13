// @vitest-environment node
//
// Orchestration tests for POST /api/feedback. LLM-free; DB mocked.
// Contract (SPEC "API Contracts"): body = feedbackInputSchema; on valid input
// db.applyFeedback() is called and 200 returned; invalid input → 400.
//
// NOTE: the feedback route is Lane C territory. If it hasn't landed yet, this
// whole suite skips with a clear message rather than redding the run.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { jsonRequest } from "../helpers/readStream";

const ROUTE_PATH = fileURLToPath(new URL("../../app/api/feedback/route.ts", import.meta.url));
const ROUTE_EXISTS = existsSync(ROUTE_PATH);

const { checkRateLimit, db } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  db: { applyFeedback: vi.fn() },
}));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit, rateLimitKeyFromRequest: () => "00000000-0000-0000-0000-000000000001" }));
vi.mock("@/lib/db", () => ({ db }));

const REC_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const d = ROUTE_EXISTS ? describe : describe.skip;

d("POST /api/feedback", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29 });
    db.applyFeedback.mockResolvedValue({ exerciseId: "ex1", avg_effectiveness: 0.75 });
    ({ POST } = await import("@/app/api/feedback/route"));
  });

  it("valid feedback → applyFeedback called, 200", async () => {
    const res = await POST(jsonRequest({ recommendation_id: REC_ID, helpful: true, rating: 5 }));
    expect(res.status).toBe(200);
    expect(db.applyFeedback).toHaveBeenCalledOnce();
  });

  it("invalid feedback (neither helpful nor rating) → 400, applyFeedback not called", async () => {
    const res = await POST(jsonRequest({ recommendation_id: REC_ID }));
    expect(res.status).toBe(400);
    expect(db.applyFeedback).not.toHaveBeenCalled();
  });

  it("invalid recommendation_id → 400", async () => {
    const res = await POST(jsonRequest({ recommendation_id: "not-a-uuid", helpful: true }));
    expect(res.status).toBe(400);
  });

  it("rate-limited → 429, applyFeedback not called", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
    const res = await POST(jsonRequest({ recommendation_id: REC_ID, helpful: true, rating: 5 }));
    expect(res.status).toBe(429);
    expect(db.applyFeedback).not.toHaveBeenCalled();
  });
});

if (!ROUTE_EXISTS) {
  describe("POST /api/feedback — PENDING Lane C", () => {
    it.skip("app/api/feedback/route.ts not present yet — tests written against the SPEC contract", () => {});
  });
}
