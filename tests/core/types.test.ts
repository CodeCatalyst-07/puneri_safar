import { describe, it, expect } from "vitest";
import {
  userContextSchema,
  weatherSnapshotSchema,
  placeCandidateSchema,
  reportSchema,
  blackspotSchema,
  routeCandidateSchema,
} from "@/core/types";

describe("Core Types: Zod Schema Validation", () => {
  it("validates a compliant UserContext object", () => {
    const validCtx = {
      location: { lat: 18.5204, lng: 73.8567 },
      travelMode: "two_wheeler",
      budget: "medium",
      safetyPreference: "cautious",
      accessibilityNeeds: true,
      accessibilityFlags: { wheelchairAccess: true },
      language: "mr",
    };

    const parsed = userContextSchema.parse(validCtx);
    expect(parsed.travelMode).toBe("two_wheeler");
    expect(parsed.language).toBe("mr");
  });

  it("rejects invalid UserContext properties", () => {
    const invalidCtx = {
      location: { lat: 100, lng: 200 }, // Invalid lat/lng
      travelMode: "helicopter", // Invalid mode
      budget: "free",
    };

    expect(() => userContextSchema.parse(invalidCtx)).toThrow();
  });

  it("validates a compliant WeatherSnapshot", () => {
    const validWeather = {
      tempC: 27.5,
      precipitationMm: 12.0,
      conditionCode: "monsoon_rain",
      alerts: [{ type: "waterlogging", severity: "warning" }],
    };

    const parsed = weatherSnapshotSchema.parse(validWeather);
    expect(parsed.precipitationMm).toBe(12.0);
    expect(parsed.alerts).toHaveLength(1);
  });

  it("validates a compliant PlaceCandidate", () => {
    const validPlace = {
      id: "place-sample",
      name: "Sample Cafe",
      lat: 18.5204,
      lng: 73.8567,
      types: ["cafe", "food"],
      rating: 4.5,
      ratingCount: 120,
      priceLevel: 1,
      openNow: true,
      isIndoor: true,
    };

    const parsed = placeCandidateSchema.parse(validPlace);
    expect(parsed.id).toBe("place-sample");
  });

  it("validates a compliant Citizen Report", () => {
    const validReport = {
      id: "rep-101",
      category: "waterlogging",
      severity: 3,
      lat: 18.5204,
      lng: 73.8567,
      createdAt: "2026-10-09T08:00:00Z",
      status: "corroborated",
      confidence: 0.85,
    };

    const parsed = reportSchema.parse(validReport);
    expect(parsed.category).toBe("waterlogging");
    expect(parsed.severity).toBe(3);
  });

  it("validates a compliant Blackspot and RouteCandidate", () => {
    const validBlackspot = {
      id: "bs-sample",
      name: "Sample Blackspot",
      lat: 18.5204,
      lng: 73.8567,
      crashCount: 22,
      period: "2022-2024",
      severity: 4,
      hazardFactors: ["speeding"],
      sourceName: "Pune Police",
      sourceUrl: "https://example.com",
      sourceNote: "Audit record",
      evidenceLevel: "counted",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
    };
    expect(blackspotSchema.parse(validBlackspot).crashCount).toBe(22);

    const validRoute = {
      id: "route-1",
      durationSeconds: 900,
      distanceMeters: 4500,
      polyline: [
        { lat: 18.52, lng: 73.85 },
        { lat: 18.525, lng: 73.855 },
      ],
    };
    expect(routeCandidateSchema.parse(validRoute).durationSeconds).toBe(900);
  });
});
