/**
 * @file src/app/api/assistant/route.ts
 * AI civic and mobility assistant endpoint for Puneri Safar.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { userContextSchema } from "@/core/types";
import { processAssistantMessage } from "@/services/assistant";
import { applyRateLimit, TokenBucketRateLimiter } from "@/lib/rateLimit";
import { jsonSuccess, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

// Rate limit: 10 requests per minute per IP
const assistantRateLimiter = new TokenBucketRateLimiter({
  capacity: 10,
  refillRate: 10,
  windowMs: 60 * 1000,
});

const assistantRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(500, "Message cannot exceed 500 characters"),
  context: userContextSchema,
});

/**
 * POST /api/assistant
 * Handles mobility inquiries, place recommendations, and hazard-aware routing.
 */
export async function POST(request: NextRequest) {
  // 1. Rate limiting
  const { response: rateLimitRes } = await applyRateLimit(request, {
    limiter: assistantRateLimiter,
    keyPrefix: "assistant_post",
  });
  if (rateLimitRes) {
    return rateLimitRes;
  }

  // 2. Validate input
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError(new Error("Invalid JSON body"), 400);
  }

  const parsed = assistantRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(parsed.error, 400);
  }

  const { message, context } = parsed.data;

  // 3. Process inquiry
  const responseData = await processAssistantMessage(message, context);

  return jsonSuccess(responseData, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
