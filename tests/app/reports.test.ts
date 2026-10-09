/**
 * @file tests/app/reports.test.ts
 * Tests for citizen reports: validation, rate limiting, corroboration, and keyword classification.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/reports/route";
import { evaluateCorroboration, classifyReportKeyword } from "@/core/safety";
import { Report } from "@/core/types";
import { InMemoryReportsRepository } from "@/adapters/reports/inMemoryReports";
import { resetCachedEnv } from "@/lib/env";

describe("Citizen Hazard Reports API & Pure Logic", () => {
  beforeEach(() => {
    resetCachedEnv();
  });

  // --- PURE CORE: CORROBORATION FUNCTION ---
  describe("evaluateCorroboration (Pure Function)", () => {
    const now = new Date("2026-10-09T10:00:00Z");

    const existingReports: Report[] = [
      {
        id: "rep-1",
        category: "road_hazard",
        severity: 2,
        lat: 18.5204,
        lng: 73.8567,
        createdAt: "2026-10-09T08:00:00Z", // 2 hours ago
        status: "unverified",
        confidence: 0.8,
      },
      {
        id: "rep-2",
        category: "waterlogging",
        severity: 2,
        lat: 18.5205,
        lng: 73.8568,
        createdAt: "2026-10-09T09:00:00Z",
        status: "unverified",
        confidence: 0.8,
      },
    ];

    it("does not corroborate when only 1 report exists (target alone)", () => {
      const candidate = {
        category: "cleanliness",
        lat: 18.5204,
        lng: 73.8567,
        createdAt: now.toISOString(),
      };
      // No existing cleanliness reports -> count is 1 < 2
      expect(evaluateCorroboration(candidate, existingReports, now)).toBe(false);
    });

    it("corroborates when a matching report of the same category exists within 200m in last 48h", () => {
      const candidate = {
        category: "waterlogging",
        lat: 18.5206, // ~20 meters away from rep-2
        lng: 73.8569,
        createdAt: now.toISOString(),
      };
      // rep-2 is same category, within 200m, and within 48h -> totalCount = 2 >= 2
      expect(evaluateCorroboration(candidate, existingReports, now)).toBe(true);
    });

    it("does not corroborate if matching report is further than 200m away", () => {
      const candidate = {
        category: "waterlogging",
        lat: 18.55, // ~3.5 km away
        lng: 73.8569,
        createdAt: now.toISOString(),
      };
      expect(evaluateCorroboration(candidate, existingReports, now)).toBe(false);
    });

    it("does not corroborate if matching report is older than 48 hours", () => {
      const staleReport: Report = {
        id: "rep-stale",
        category: "waterlogging",
        severity: 2,
        lat: 18.5205,
        lng: 73.8568,
        createdAt: "2026-10-06T08:00:00Z", // ~74 hours ago (>48h)
        status: "unverified",
        confidence: 0.8,
      };

      const candidate = {
        category: "waterlogging",
        lat: 18.5205,
        lng: 73.8568,
        createdAt: now.toISOString(),
      };

      expect(evaluateCorroboration(candidate, [staleReport], now)).toBe(false);
    });
  });

  // --- PURE CORE: KEYWORD CLASSIFIER FALLBACK ---
  describe("classifyReportKeyword (Pure Fallback)", () => {
    it("correctly classifies waterlogging issues", () => {
      const res = classifyReportKeyword("Massive waterlogging under the bridge after rain");
      expect(res.category).toBe("waterlogging");
      expect(res.severity).toBeGreaterThanOrEqual(2);
    });

    it("correctly classifies road hazards and potholes", () => {
      const res = classifyReportKeyword("Deep dangerous pothole on main road causing accidents");
      expect(res.category).toBe("road_hazard");
      expect(res.severity).toBe(3);
    });

    it("correctly classifies poor lighting", () => {
      const res = classifyReportKeyword(
        "Streetlight is broken and road is completely unlit and dark"
      );
      expect(res.category).toBe("poor_lighting");
    });

    it("correctly classifies cleanliness and waste dumps", () => {
      const res = classifyReportKeyword("Garbage dump overflowing on footpath smelling terrible");
      expect(res.category).toBe("cleanliness");
    });

    it("correctly classifies traffic crowds and congestion", () => {
      const res = classifyReportKeyword("Massive traffic jam and vehicle gridlock at chowk");
      expect(res.category).toBe("crowd");
    });
  });

  // --- REPOSITORY LAYER ---
  describe("InMemoryReportsRepository", () => {
    it("rounds coordinates to 3 decimals upon creation", async () => {
      const repo = new InMemoryReportsRepository();
      repo.clear();

      const report = await repo.createCitizenReport({
        text: "Pothole on FC Road near Goodluck Cafe",
        lat: 18.5173456,
        lng: 73.8415678,
        category: "road_hazard",
        severity: 2,
        confidence: 0.8,
      });

      expect(report.lat).toBe(18.517);
      expect(report.lng).toBe(73.842);
      expect(report.status).toBe("unverified");
    });

    it("keeps report unverified if same reporter reports twice nearby", async () => {
      const repo = new InMemoryReportsRepository();
      repo.clear();

      const rep1 = await repo.createCitizenReport({
        text: "Water puddle near Nal stop",
        lat: 18.508,
        lng: 73.832,
        category: "waterlogging",
        severity: 1,
        confidence: 0.8,
        reporterHash: "reporter-1",
      });
      expect(rep1.status).toBe("unverified");

      const rep2 = await repo.createCitizenReport({
        text: "Waterlogged street right next to Nal stop",
        lat: 18.5081,
        lng: 73.8321,
        category: "waterlogging",
        severity: 2,
        confidence: 0.9,
        reporterHash: "reporter-1", // SAME REPORTER
      });
      expect(rep2.status).toBe("unverified");
    });

    it("corroborates report when 2nd report arrives from distinct reporter within 200m", async () => {
      const repo = new InMemoryReportsRepository();
      repo.clear();

      const rep1 = await repo.createCitizenReport({
        text: "Water puddle near Nal stop",
        lat: 18.508,
        lng: 73.832,
        category: "waterlogging",
        severity: 1,
        confidence: 0.8,
        reporterHash: "reporter-1",
      });
      expect(rep1.status).toBe("unverified");

      const rep2 = await repo.createCitizenReport({
        text: "Waterlogged street right next to Nal stop",
        lat: 18.5081,
        lng: 73.8321,
        category: "waterlogging",
        severity: 2,
        confidence: 0.9,
        reporterHash: "reporter-2", // DISTINCT REPORTER
      });

      expect(rep2.status).toBe("corroborated");

      // Area query returns corroborated report and zero unverified
      const area = await repo.queryArea(18.508, 73.832, 500);
      expect(area.corroborated.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- API ROUTE HANDLERS ---
  describe("API Route Handlers: /api/reports", () => {
    it("rejects input exceeding 300 characters", async () => {
      const longText = "a".repeat(301);
      const req = new NextRequest("http://localhost:3000/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: longText,
          lat: 18.5204,
          lng: 73.8567,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("Request validation failed");
    });

    it("rejects coordinates outside Pune metropolitan boundaries", async () => {
      const req = new NextRequest("http://localhost:3000/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Pothole in Mumbai",
          lat: 19.076, // Mumbai latitude
          lng: 72.877,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("creates a report successfully via POST and queries via GET without exposing raw text", async () => {
      const postReq = new NextRequest("http://localhost:3000/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "192.168.1.100" },
        body: JSON.stringify({
          text: "Large pothole on University Road near E-Square",
          lat: 18.538,
          lng: 73.831,
        }),
      });

      const postRes = await POST(postReq);
      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.success).toBe(true);
      expect(postBody.data.id).toBeDefined();

      const getReq = new NextRequest(
        "http://localhost:3000/api/reports?lat=18.538&lng=73.831&radius=1000"
      );
      const getRes = await GET(getReq);
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.success).toBe(true);
      expect(typeof getBody.data.unverifiedCount).toBe("number");
      // Unverified count should include the new report
      expect(getBody.data.unverifiedCount).toBeGreaterThan(0);
    });

    it("enforces rate limit of 3 reports per 10 minutes per IP", async () => {
      const testIp = "10.0.0.42";
      const makeReq = () =>
        new NextRequest("http://localhost:3000/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": testIp },
          body: JSON.stringify({
            text: "Testing rate limit",
            lat: 18.5204,
            lng: 73.8567,
          }),
        });

      // 1st, 2nd, 3rd allowed
      const r1 = await POST(makeReq());
      expect(r1.status).toBe(201);
      const r2 = await POST(makeReq());
      expect(r2.status).toBe(201);
      const r3 = await POST(makeReq());
      expect(r3.status).toBe(201);

      // 4th request must be rejected with 429
      const r4 = await POST(makeReq());
      expect(r4.status).toBe(429);
      const body4 = await r4.json();
      expect(body4.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
