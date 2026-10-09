/**
 * @file tests/app/assistant.test.ts
 * Integration tests for the POST /api/assistant route handler.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/assistant/route";
import { clearGoogleFetchCache } from "@/lib/googleFetch";
import { resetCachedEnv } from "@/lib/env";

describe("POST /api/assistant Route Handler", () => {
  const originalFetch = globalThis.fetch;

  const validContext = {
    location: { lat: 18.5204, lng: 73.8567 },
    travelMode: "two_wheeler" as const,
    budget: "low" as const,
    safetyPreference: "cautious" as const,
    accessibilityNeeds: false,
    language: "en" as const,
  };

  beforeEach(() => {
    resetCachedEnv();
    clearGoogleFetchCache();

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("places:searchText")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            places: [
              {
                id: "place-1",
                displayName: { text: "FC Road Cafe", languageCode: "en" },
                location: { latitude: 18.528, longitude: 73.841 },
                types: ["restaurant", "cafe"],
                rating: 4.5,
                userRatingCount: 5000,
                priceLevel: "PRICE_LEVEL_INEXPENSIVE",
                currentOpeningHours: { openNow: true },
                formattedAddress: "FC Road, Shivajinagar, Pune",
              },
            ],
          }),
        });
      }

      if (url.includes("currentConditions")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            temperature: { degrees: 28 },
            precipitation: { qpf: { quantity: 0 } },
            weatherCondition: { type: "CLEAR" },
          }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 404,
        text: async () => "Not found",
      });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects messages exceeding 500 characters with 400 validation error", async () => {
    const longMessage = "a".repeat(501);
    const req = new NextRequest("http://localhost:3000/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: longMessage,
        context: validContext,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toContain("Request validation failed");
  });

  it("rejects empty messages with 400 validation error", async () => {
    const req = new NextRequest("http://localhost:3000/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "   ",
        context: validContext,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with structured fact-grounded response for valid query", async () => {
    const req = new NextRequest("http://localhost:3000/api/assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "192.168.1.50",
      },
      body: JSON.stringify({
        message: "cheap vegetarian dinner near Shivajinagar tonight",
        context: validContext,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.answer).toBeDefined();
    expect(body.data.answer.length).toBeGreaterThan(0);
    expect(Array.isArray(body.data.caveats)).toBe(true);
    expect(Array.isArray(body.data.sources)).toBe(true);
    expect(typeof body.data.usedLlm).toBe("boolean");
  });

  it("enforces rate limit of 10 requests per minute per IP", async () => {
    const testIp = "10.0.0.99";
    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIp,
        },
        body: JSON.stringify({
          message: "weather now",
          context: validContext,
        }),
      });

    // Make 10 permitted requests
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq());
      expect(res.status).toBe(200);
    }

    // 11th request must receive 429
    const limitRes = await POST(makeReq());
    expect(limitRes.status).toBe(429);
    const body = await limitRes.json();
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
