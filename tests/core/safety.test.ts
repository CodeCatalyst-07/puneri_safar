import { describe, it, expect } from "vitest";
import {
  computeRouteHazardIndex,
  chooseRoutes,
  evaluateCorroboration,
  VERIFIED_MATCH_RADIUS_METERS,
  UNVERIFIED_MATCH_RADIUS_METERS,
  LOWEST_CRASH_TIER_WEIGHT,
} from "@/core/safety";
import { Blackspot, Report, RouteCandidate, UserContext } from "@/core/types";
import { ContextSignals } from "@/core/signals";

describe("Core Safety: Known Hazard Index", () => {
  const baseCtx: UserContext = {
    location: { lat: 18.5204, lng: 73.8567 },
    travelMode: "two_wheeler",
    budget: "medium",
    safetyPreference: "balanced",
    accessibilityNeeds: false,
    language: "en",
  };

  const calmSignals: ContextSignals = {
    isNight: false,
    isRaining: false,
    heavyRain: false,
    heatStress: false,
    isPeakTraffic: false,
    hasAlert: false,
  };

  const fixedNow = new Date("2026-10-09T10:00:00Z");

  const sampleRoute: RouteCandidate = {
    id: "route-jm-road",
    distanceMeters: 4000,
    durationSeconds: 600,
    polyline: [
      { lat: 18.52, lng: 73.85 },
      { lat: 18.525, lng: 73.855 },
      { lat: 18.53, lng: 73.86 },
    ],
  };

  it("returns hazardIndex 0 and confidence 'low' when no recorded hazards exist nearby", () => {
    const assessment = computeRouteHazardIndex(
      sampleRoute,
      [], // no blackspots
      [], // no reports
      baseCtx,
      calmSignals,
      fixedNow
    );

    expect(assessment.hazardIndex).toBe(0);
    expect(assessment.confidence).toBe("low");
    expect(assessment.caveats[0]).toContain("No recorded hazards is not the same as safe");
    expect(assessment.breakdown).toHaveLength(0);
  });

  it("applies 150m matching radius for verified coordinates and 300m for unverified", () => {
    // Distance ~220m from vertex (18.5250, 73.8550)
    // 0.002 lat is ~222 meters
    const spot220mVerified: Blackspot = {
      id: "bs-verified-220m",
      name: "Verified Spot at 220m",
      lat: 18.527,
      lng: 73.855,
      crashCount: 25,
      period: "2022-2024",
      evidenceLevel: "counted",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: true,
      sourceName: "Police Report",
      sourceUrl: "https://example.com/source",
      sourceNote: "Official audit",
    };

    const spot220mUnverified: Blackspot = {
      id: "bs-unverified-220m",
      name: "Unverified Spot at 220m",
      lat: 18.527,
      lng: 73.855,
      crashCount: 25,
      period: "2022-2024",
      evidenceLevel: "counted",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
      sourceName: "Police Report",
      sourceUrl: "https://example.com/source",
      sourceNote: "Official audit",
    };

    // Verified spot with 150m radius should NOT match at 220m
    const assessmentVerified = computeRouteHazardIndex(
      sampleRoute,
      [spot220mVerified],
      [],
      baseCtx,
      calmSignals,
      fixedNow
    );
    expect(assessmentVerified.breakdown).toHaveLength(0);

    // Unverified spot with 300m radius SHOULD match at 220m
    const assessmentUnverified = computeRouteHazardIndex(
      sampleRoute,
      [spot220mUnverified],
      [],
      baseCtx,
      calmSignals,
      fixedNow
    );
    expect(assessmentUnverified.breakdown).toHaveLength(1);
    expect(assessmentUnverified.breakdown[0].matchRadiusMeters).toBe(
      UNVERIFIED_MATCH_RADIUS_METERS
    );
    expect(assessmentUnverified.caveats.some((c) => c.includes("approximate location"))).toBe(true);
  });

  it("adds approximate location caveat whenever unverified coordinates are present in breakdown", () => {
    const unverifiedNearbySpot: Blackspot = {
      id: "bs-approx",
      name: "Approximate Spot",
      lat: 18.5252, // ~25m away
      lng: 73.855,
      crashCount: 22,
      period: "2022-2024",
      evidenceLevel: "counted",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
      sourceName: "Police Report",
      sourceUrl: "https://example.com",
      sourceNote: "Official audit",
    };

    const assessment = computeRouteHazardIndex(
      sampleRoute,
      [unverifiedNearbySpot],
      [],
      baseCtx,
      calmSignals,
      fixedNow
    );

    expect(assessment.breakdown).toHaveLength(1);
    expect(assessment.caveats.some((c) => c.includes("approximate location"))).toBe(true);
  });

  it("does not add approximate location caveat when only verified coordinates are present", () => {
    const verifiedNearbySpot: Blackspot = {
      id: "bs-verified-close",
      name: "Verified Close Spot",
      lat: 18.5252, // ~25m away
      lng: 73.855,
      crashCount: 22,
      period: "2022-2024",
      evidenceLevel: "counted",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: true,
      sourceName: "Police Report",
      sourceUrl: "https://example.com",
      sourceNote: "Official audit",
    };

    const assessment = computeRouteHazardIndex(
      sampleRoute,
      [verifiedNearbySpot],
      [],
      baseCtx,
      calmSignals,
      fixedNow
    );

    expect(assessment.breakdown).toHaveLength(1);
    expect(assessment.breakdown[0].matchRadiusMeters).toBe(VERIFIED_MATCH_RADIUS_METERS);
    expect(assessment.caveats.some((c) => c.includes("approximate location"))).toBe(false);
  });

  it("assigns lowest crash-count tier weight (10) for listed_only, null crash count, and low counts (<10)", () => {
    const listedOnlySpot: Blackspot = {
      id: "bs-listed",
      name: "Listed Only Spot",
      lat: 18.525,
      lng: 73.855,
      crashCount: null,
      period: "2021",
      evidenceLevel: "listed_only",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
      sourceName: "Punekar News",
      sourceUrl: "https://example.com",
      sourceNote: "Listed accident spot",
    };

    const nullCountSpot: Blackspot = {
      id: "bs-null",
      name: "Null Count Spot",
      lat: 18.525,
      lng: 73.855,
      crashCount: null,
      period: "2022",
      evidenceLevel: "counted",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
      sourceName: "Police Report",
      sourceUrl: "https://example.com",
      sourceNote: "Audit",
    };

    const lowCountSpot: Blackspot = {
      id: "bs-low",
      name: "Low Crash Spot",
      lat: 18.525,
      lng: 73.855,
      crashCount: 4,
      period: "2022-2024",
      evidenceLevel: "counted",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
      sourceName: "Police Report",
      sourceUrl: "https://example.com",
      sourceNote: "Audit",
    };

    const resListed = computeRouteHazardIndex(
      sampleRoute,
      [listedOnlySpot],
      [],
      baseCtx,
      calmSignals,
      fixedNow
    );
    expect(resListed.breakdown[0].weight).toBe(LOWEST_CRASH_TIER_WEIGHT);

    const resNull = computeRouteHazardIndex(
      sampleRoute,
      [nullCountSpot],
      [],
      baseCtx,
      calmSignals,
      fixedNow
    );
    expect(resNull.breakdown[0].weight).toBe(LOWEST_CRASH_TIER_WEIGHT);

    const resLow = computeRouteHazardIndex(
      sampleRoute,
      [lowCountSpot],
      [],
      baseCtx,
      calmSignals,
      fixedNow
    );
    expect(resLow.breakdown[0].weight).toBe(LOWEST_CRASH_TIER_WEIGHT);
  });

  it("ignores unverified reports and applies recency decay to corroborated reports", () => {
    const unverifiedReport: Report = {
      id: "rep-unverified",
      category: "road_hazard",
      severity: 3,
      lat: 18.525,
      lng: 73.855,
      createdAt: new Date(fixedNow.getTime() - 1000 * 3600).toISOString(), // 1 hour ago
      status: "unverified",
      confidence: 0.3,
    };

    const freshCorroboratedReport: Report = {
      id: "rep-fresh",
      category: "road_hazard",
      severity: 3,
      lat: 18.525,
      lng: 73.855,
      createdAt: new Date(fixedNow.getTime() - 1000 * 3600 * 24).toISOString(), // 1 day ago
      status: "corroborated",
      confidence: 0.9,
    };

    const staleOfficialReport: Report = {
      id: "rep-stale",
      category: "road_hazard",
      severity: 3,
      lat: 18.525,
      lng: 73.855,
      createdAt: new Date(fixedNow.getTime() - 1000 * 3600 * 24 * 65).toISOString(),
      status: "official",
      confidence: 1.0,
    };

    const assessment = computeRouteHazardIndex(
      sampleRoute,
      [],
      [unverifiedReport, freshCorroboratedReport, staleOfficialReport],
      baseCtx,
      calmSignals,
      fixedNow
    );

    expect(assessment.breakdown).toHaveLength(1);
    expect(assessment.breakdown[0].contributorId).toBe("rep-fresh");
    expect(assessment.breakdown[0].matchRadiusMeters).toBe(150);
  });

  it("multiplies hazard weight during heavy rain for vulnerable modes (two-wheeler & walk)", () => {
    const blackspot: Blackspot = {
      id: "bs-1",
      name: "Waterlogging Blackspot",
      lat: 18.525,
      lng: 73.855,
      crashCount: 20,
      period: "2022-2024",
      evidenceLevel: "counted",
      coordinateSource: "geocoded_osm",
      sourceName: "Pune Police Report",
      sourceUrl: "https://example.com/source",
      sourceNote: "Official audit",
      coordinatesVerified: false,
    };

    const dryAssessment = computeRouteHazardIndex(
      sampleRoute,
      [blackspot],
      [],
      { ...baseCtx, travelMode: "two_wheeler" },
      calmSignals,
      fixedNow
    );

    const heavyRainSignals: ContextSignals = {
      ...calmSignals,
      isRaining: true,
      heavyRain: true,
    };

    const wetAssessment = computeRouteHazardIndex(
      sampleRoute,
      [blackspot],
      [],
      { ...baseCtx, travelMode: "two_wheeler" },
      heavyRainSignals,
      fixedNow
    );

    expect(wetAssessment.hazardIndex).toBeGreaterThan(dryAssessment.hazardIndex);
  });
});

describe("Core Safety: chooseRoutes Tradeoff", () => {
  const baseCtx: UserContext = {
    location: { lat: 18.5204, lng: 73.8567 },
    travelMode: "car",
    budget: "medium",
    safetyPreference: "balanced",
    accessibilityNeeds: false,
    language: "en",
  };

  const calmSignals: ContextSignals = {
    isNight: false,
    isRaining: false,
    heavyRain: false,
    heatStress: false,
    isPeakTraffic: false,
    hasAlert: false,
  };

  const fixedNow = new Date("2026-10-09T10:00:00Z");

  const blackspotAtHighway: Blackspot = {
    id: "bs-highway",
    name: "Highway Blackspot",
    lat: 18.5,
    lng: 73.85,
    crashCount: 35,
    period: "2022-2024",
    evidenceLevel: "counted",
    coordinateSource: "geocoded_osm",
    sourceName: "Pune Police",
    sourceUrl: "https://example.com/source",
    sourceNote: "Audit",
    coordinatesVerified: false,
  };

  const fastestHighwayRoute: RouteCandidate = {
    id: "route-fastest-highway",
    durationSeconds: 1000,
    distanceMeters: 8000,
    polyline: [
      { lat: 18.495, lng: 73.845 },
      { lat: 18.5, lng: 73.85 },
      { lat: 18.505, lng: 73.855 },
    ],
  };

  const saferDetourRoute: RouteCandidate = {
    id: "route-safer-detour",
    durationSeconds: 1180,
    distanceMeters: 9200,
    polyline: [
      { lat: 18.495, lng: 73.82 },
      { lat: 18.505, lng: 73.825 },
    ],
  };

  it("selects fewer hazards when a safer route exists within max detour (+25%)", () => {
    const choice = chooseRoutes(
      [fastestHighwayRoute, saferDetourRoute],
      baseCtx,
      calmSignals,
      [blackspotAtHighway],
      [],
      fixedNow
    );

    expect(choice.fastest.id).toBe("route-fastest-highway");
    expect(choice.fewestHazards.id).toBe("route-safer-detour");
    expect(choice.tradeoff.recommendation).toBe("fewest_hazards");
    expect(choice.tradeoff.hazardPointsAvoided).toBeGreaterThan(0);
    expect(choice.tradeoff.minutesAdded).toBe(3);
  });

  it("throws an error when provided an empty routes candidate list", () => {
    expect(() => chooseRoutes([], baseCtx, calmSignals, [], [], fixedNow)).toThrowError(
      /empty route candidates/
    );
  });

  describe("Distinct-Reporter Corroboration Logic", () => {
    const candidateReport = {
      id: "rep-new",
      category: "road_hazard",
      lat: 18.52,
      lng: 73.85,
      createdAt: fixedNow.toISOString(),
      reporterHash: "hash-reporter-alice",
    };

    it("keeps report unverified if same reporter reports twice nearby within 48h", () => {
      const existingSameReporter: Report & { reporterHash?: string } = {
        id: "rep-existing",
        category: "road_hazard",
        severity: 2,
        lat: 18.5201,
        lng: 73.8501,
        createdAt: new Date(fixedNow.getTime() - 2 * 3600 * 1000).toISOString(),
        status: "unverified",
        confidence: 0.8,
        reporterHash: "hash-reporter-alice", // SAME REPORTER
      };

      const corroborated = evaluateCorroboration(
        candidateReport,
        [existingSameReporter],
        fixedNow,
        48,
        200
      );

      expect(corroborated).toBe(false);
    });

    it("promotes report to corroborated if two distinct reporters submit nearby within 48h", () => {
      const existingOtherReporter: Report & { reporterHash?: string } = {
        id: "rep-existing-2",
        category: "road_hazard",
        severity: 2,
        lat: 18.5201,
        lng: 73.8501,
        createdAt: new Date(fixedNow.getTime() - 2 * 3600 * 1000).toISOString(),
        status: "unverified",
        confidence: 0.8,
        reporterHash: "hash-reporter-bob", // DISTINCT REPORTER
      };

      const corroborated = evaluateCorroboration(
        candidateReport,
        [existingOtherReporter],
        fixedNow,
        48,
        200
      );

      expect(corroborated).toBe(true);
    });
  });
});
