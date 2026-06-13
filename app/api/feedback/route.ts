// POST /api/feedback — exercise effectiveness signal for the self-growing library.
//
// Records helpful?/rating?/note? against a recommendation and updates the
// exercise's avg_effectiveness (Lane A's applyFeedback handles the aggregation +
// auto-retire). Zod-validated input; generic client errors; RLS-scoped by userId.
import "server-only";

import { feedbackInputSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/constants";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const userId = DEMO_USER_ID;

  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonError(400, "Invalid input");
    }
    const parsed = feedbackInputSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(400, "Invalid input");
    }
    const { recommendation_id, helpful, rating, note } = parsed.data;

    const { avg_effectiveness } = await db.applyFeedback(
      userId,
      recommendation_id,
      helpful,
      rating,
      note,
    );

    return Response.json({ ok: true, avg_effectiveness });
  } catch {
    return jsonError(500, "Something went wrong saving your feedback.");
  }
}
