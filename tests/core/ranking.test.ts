import { describe, it, expect } from "vitest";
import { rankPlaces } from "@/core/ranking";
import { Blackspot, PlaceCandidate, UserContext } from "@/core/types";
import { ContextSignals } from "@/core/signals";

describe("Core Ranking: Multi-Criteria Bayesian Engine", () => {
  const baseCtx: UserContext = {
    location: { lat: 18.5204, lng: 73.8567 },
    travelMode: "walk",
    budget: "low",
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

  const fixedNow = new Date("2026-10-09T12:00:00Z");

  it("returns empty array when given an empty candidate list", () => {
    expect(rankPlaces([], baseCtx, calmSignals, fixedNow)).toEqual([]);
  });

  it("applies Bayesian rating smoothing so high-volume reviews dominate over low-volume outlier 5.0", () => {
    const candidateA: PlaceCandidate = {
      id: "place-a-popular",
      name: "Popular Misal House",
      lat: 18.521,
      lng: 73.857,
      types: ["restaurant"],
      rating: 4.8,
      ratingCount: 3000, // Highly trusted
      priceLevel: 1,
      openNow: true,
      isIndoor: true,
      distanceMeters: 500,
    };

    const candidateB: PlaceCandidate = {
      id: "place-b-outlier",
      name: "New Unrated Stall",
      lat: 18.521,
      lng: 73.857,
      types: ["restaurant"],
      rating: 5.0,
      ratingCount: 1, // Only 1 review; smoothed down towards mean
      priceLevel: 1,
      openNow: true,
      isIndoor: true,
      distanceMeters: 500,
    };

    const ranked = rankPlaces([candidateA, candidateB], baseCtx, calmSignals, fixedNow);

    expect(ranked[0].place.id).toBe("place-a-popular");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("enforces the MISSING DATA RULE: never silently scores 0 and renormalizes active weights", () => {
    const candidateWithMissingData: PlaceCandidate = {
      id: "place-sparse",
      name: "Sparse Heritage Gate",
      lat: 18.522,
      lng: 73.858,
      types: ["historical_landmark"],
      rating: 4.5,
      ratingCount: 150,
      // priceLevel missing
      // accessibility missing
      // openNow missing
      // isIndoor missing
      distanceMeters: 800,
    };

    const ranked = rankPlaces([candidateWithMissingData], baseCtx, calmSignals, fixedNow);
    expect(ranked).toHaveLength(1);

    const placeResult = ranked[0];
    // Score must be calculated from present criteria (rating + distance) without zero-penalty
    expect(placeResult.score).toBeGreaterThan(60);

    // Missing criteria must have confidence 'unknown' and weight 0
    const missingPrice = placeResult.breakdown.find((b) => b.criterion === "Affordability");
    expect(missingPrice?.confidence).toBe("unknown");
    expect(missingPrice?.value).toBeUndefined();
    expect(missingPrice?.weight).toBe(0);

    // Sum of active normalized weights must equal 1.0
    const activeWeightsSum = placeResult.breakdown
      .filter((b) => typeof b.value === "number")
      .reduce((sum, b) => sum + b.weight, 0);
    expect(activeWeightsSum).toBeCloseTo(1.0, 2);
  });

  it("evaluates accessibility match only when user context requires accessibility", () => {
    const accessiblePlace: PlaceCandidate = {
      id: "place-acc",
      name: "Accessible Museum",
      lat: 18.5204,
      lng: 73.8567,
      types: ["museum"],
      rating: 4.5,
      ratingCount: 200,
      priceLevel: 1,
      accessibility: { wheelchairEntrance: true, wheelchairRestroom: true },
      openNow: true,
      isIndoor: true,
      distanceMeters: 500,
    };

    // When accessibilityNeeds is false
    const withoutAccNeeds = rankPlaces(
      [accessiblePlace],
      { ...baseCtx, accessibilityNeeds: false },
      calmSignals,
      fixedNow
    );
    const accItemWithout = withoutAccNeeds[0].breakdown.find(
      (b) => b.criterion === "Accessibility"
    );
    expect(accItemWithout).toBeUndefined();

    // When accessibilityNeeds is true
    const withAccNeeds = rankPlaces(
      [accessiblePlace],
      { ...baseCtx, accessibilityNeeds: true },
      calmSignals,
      fixedNow
    );
    const accItemWith = withAccNeeds[0].breakdown.find((b) => b.criterion === "Accessibility");
    expect(accItemWith).toBeDefined();
    expect(accItemWith?.value).toBe(1.0);
  });

  it("favors indoor venues during rain and penalizes outdoor walks during heat", () => {
    const indoorCafe: PlaceCandidate = {
      id: "place-indoor",
      name: "Indoor Irani Cafe",
      lat: 18.5204,
      lng: 73.8567,
      types: ["cafe"],
      rating: 4.2,
      ratingCount: 100,
      priceLevel: 1,
      isIndoor: true,
      distanceMeters: 400,
    };

    const outdoorGarden: PlaceCandidate = {
      id: "place-outdoor",
      name: "Open Botanical Park",
      lat: 18.5204,
      lng: 73.8567,
      types: ["park"],
      rating: 4.2,
      ratingCount: 100,
      priceLevel: 1,
      isIndoor: false,
      distanceMeters: 400,
    };

    const rainSignals: ContextSignals = {
      ...calmSignals,
      isRaining: true,
      heavyRain: true,
    };

    const rankedInRain = rankPlaces([indoorCafe, outdoorGarden], baseCtx, rainSignals, fixedNow);
    expect(rankedInRain[0].place.id).toBe("place-indoor");
    expect(rankedInRain[0].score).toBeGreaterThan(rankedInRain[1].score);
  });

  it("performs deterministic, stable tie-breaking by ID when scores are identical", () => {
    const placeZ: PlaceCandidate = {
      id: "z-spot",
      name: "Spot Z",
      lat: 18.5204,
      lng: 73.8567,
      types: ["park"],
      rating: 4.0,
      ratingCount: 50,
      priceLevel: 1,
      distanceMeters: 500,
    };

    const placeA: PlaceCandidate = {
      id: "a-spot",
      name: "Spot A",
      lat: 18.5204,
      lng: 73.8567,
      types: ["park"],
      rating: 4.0,
      ratingCount: 50,
      priceLevel: 1,
      distanceMeters: 500,
    };

    // Both places have identical scores
    const ranked = rankPlaces([placeZ, placeA], baseCtx, calmSignals, fixedNow);
    expect(ranked[0].score).toBe(ranked[1].score);
    // Alphabetical tie-break: a-spot should come before z-spot
    expect(ranked[0].place.id).toBe("a-spot");
    expect(ranked[1].place.id).toBe("z-spot");
  });

  it("raises the hazard avoidance weight at night and under cautious safety preference", () => {
    const testPlace: PlaceCandidate = {
      id: "place-junction",
      name: "Junction Cafe",
      lat: 18.5204,
      lng: 73.8567,
      types: ["cafe"],
      rating: 4.5,
      ratingCount: 100,
      priceLevel: 1,
      distanceMeters: 500,
    };

    const mockBlackspots: Blackspot[] = [
      {
        id: "bs-nearby",
        name: "Swargate Junction",
        lat: 18.5205,
        lng: 73.8568,
        crashCount: 25,
        period: "2022-2024",
        severity: 5,
        hazardFactors: ["pedestrian_conflict"],
        sourceName: "Pune Police",
        sourceUrl: "https://example.com",
        sourceNote: "Audit",
        coordinatesVerified: false,
      },
    ];

    const daySignals: ContextSignals = {
      ...calmSignals,
      isNight: false,
    };

    const nightSignals: ContextSignals = {
      ...calmSignals,
      isNight: true,
    };

    // Daytime ranking
    const dayRanked = rankPlaces([testPlace], baseCtx, daySignals, fixedNow, mockBlackspots);
    const dayHazardBreakdown = dayRanked[0].breakdown.find(
      (b) => b.criterion === "Hazard Avoidance"
    );

    // Nighttime ranking
    const nightRanked = rankPlaces([testPlace], baseCtx, nightSignals, fixedNow, mockBlackspots);
    const nightHazardBreakdown = nightRanked[0].breakdown.find(
      (b) => b.criterion === "Hazard Avoidance"
    );

    // Night hazard weight must be strictly higher than day hazard weight
    expect(nightHazardBreakdown?.weight).toBeGreaterThan(dayHazardBreakdown?.weight as number);

    // Cautious safety preference raises hazard weight even further
    const cautiousCtx: UserContext = {
      ...baseCtx,
      safetyPreference: "cautious",
    };
    const cautiousRanked = rankPlaces(
      [testPlace],
      cautiousCtx,
      nightSignals,
      fixedNow,
      mockBlackspots
    );
    const cautiousHazardBreakdown = cautiousRanked[0].breakdown.find(
      (b) => b.criterion === "Hazard Avoidance"
    );

    expect(cautiousHazardBreakdown?.weight).toBeGreaterThan(nightHazardBreakdown?.weight as number);
  });

  it("penalizes closed venues (openNow: false) and places exceeding max price cap", () => {
    const closedPlace: PlaceCandidate = {
      id: "place-closed",
      name: "Late Night Lounge (Closed)",
      lat: 18.5204,
      lng: 73.8567,
      types: ["cafe"],
      rating: 4.2,
      priceLevel: 3,
      openNow: false,
      distanceMeters: 500,
    };

    const ctxWithPriceCap: UserContext = {
      ...baseCtx,
      maxPriceLevel: 2, // Capped at tier 2, but place is tier 3
    };

    const ranked = rankPlaces([closedPlace], ctxWithPriceCap, calmSignals, fixedNow);
    const openHours = ranked[0].breakdown.find((b) => b.criterion === "Operating Hours");
    expect(openHours?.value).toBe(0.1);

    const afford = ranked[0].breakdown.find((b) => b.criterion === "Affordability");
    expect(afford?.value).toBe(0.1);
  });

  it("evaluates heat stress with indoor favor vs outdoor penalty, and multi-blackspot tiers", () => {
    const heatSignals: ContextSignals = {
      ...calmSignals,
      heatStress: true,
    };

    const longWalkOutdoor: PlaceCandidate = {
      id: "p-outdoor",
      name: "Outdoor Garden",
      lat: 18.5204,
      lng: 73.8567,
      types: ["park"],
      isIndoor: false,
      distanceMeters: 800, // > 500m
    };

    const airConditionedMall: PlaceCandidate = {
      id: "p-indoor",
      name: "Phoenix Mall",
      lat: 18.5204,
      lng: 73.8567,
      types: ["mall"],
      isIndoor: true,
      distanceMeters: 800,
    };

    const ranked = rankPlaces(
      [longWalkOutdoor, airConditionedMall],
      baseCtx,
      heatSignals,
      fixedNow
    );
    const outdoorWeather = ranked
      .find((r) => r.place.id === "p-outdoor")
      ?.breakdown.find((b) => b.criterion === "Weather Suitability");
    const indoorWeather = ranked
      .find((r) => r.place.id === "p-indoor")
      ?.breakdown.find((b) => b.criterion === "Weather Suitability");

    expect(outdoorWeather?.value).toBe(0.3);
    expect(indoorWeather?.value).toBe(1.0);

    // Multi-blackspot tiers: 1 blackspot -> 0.6, 2 blackspots -> 0.3, 3 blackspots -> 0.0
    const place1Bs: PlaceCandidate = {
      id: "p-bs1",
      name: "P1",
      lat: 18.52,
      lng: 73.85,
      types: ["cafe"],
    };
    const place2Bs: PlaceCandidate = {
      id: "p-bs2",
      name: "P2",
      lat: 18.53,
      lng: 73.86,
      types: ["cafe"],
    };
    const place3Bs: PlaceCandidate = {
      id: "p-bs3",
      name: "P3",
      lat: 18.54,
      lng: 73.87,
      types: ["cafe"],
    };

    const blackspotsCluster: Blackspot[] = [
      {
        id: "b1",
        name: "B1",
        lat: 18.5201,
        lng: 73.8501,
        period: "2024",
        severity: 4,
        hazardFactors: [],
        sourceName: "S",
        sourceUrl: "U",
        sourceNote: "N",
        coordinatesVerified: false,
      },
      {
        id: "b2",
        name: "B2",
        lat: 18.5301,
        lng: 73.8601,
        period: "2024",
        severity: 4,
        hazardFactors: [],
        sourceName: "S",
        sourceUrl: "U",
        sourceNote: "N",
        coordinatesVerified: false,
      },
      {
        id: "b3",
        name: "B3",
        lat: 18.5302,
        lng: 73.8602,
        period: "2024",
        severity: 4,
        hazardFactors: [],
        sourceName: "S",
        sourceUrl: "U",
        sourceNote: "N",
        coordinatesVerified: false,
      },
      {
        id: "b4",
        name: "B4",
        lat: 18.5401,
        lng: 73.8701,
        period: "2024",
        severity: 4,
        hazardFactors: [],
        sourceName: "S",
        sourceUrl: "U",
        sourceNote: "N",
        coordinatesVerified: false,
      },
      {
        id: "b5",
        name: "B5",
        lat: 18.5402,
        lng: 73.8702,
        period: "2024",
        severity: 4,
        hazardFactors: [],
        sourceName: "S",
        sourceUrl: "U",
        sourceNote: "N",
        coordinatesVerified: false,
      },
      {
        id: "b6",
        name: "B6",
        lat: 18.5403,
        lng: 73.8703,
        period: "2024",
        severity: 4,
        hazardFactors: [],
        sourceName: "S",
        sourceUrl: "U",
        sourceNote: "N",
        coordinatesVerified: false,
      },
    ];

    const rankedBs = rankPlaces(
      [place1Bs, place2Bs, place3Bs],
      baseCtx,
      calmSignals,
      fixedNow,
      blackspotsCluster
    );
    const bs1Score = rankedBs
      .find((r) => r.place.id === "p-bs1")
      ?.breakdown.find((b) => b.criterion === "Hazard Avoidance")?.value;
    const bs2Score = rankedBs
      .find((r) => r.place.id === "p-bs2")
      ?.breakdown.find((b) => b.criterion === "Hazard Avoidance")?.value;
    const bs3Score = rankedBs
      .find((r) => r.place.id === "p-bs3")
      ?.breakdown.find((b) => b.criterion === "Hazard Avoidance")?.value;

    expect(bs1Score).toBe(0.6);
    expect(bs2Score).toBe(0.3);
    expect(bs3Score).toBe(0.0);
  });

  it("handles medium and high budget preferences, missing accessibility data, and zero-criteria candidates", () => {
    const pTier1: PlaceCandidate = {
      id: "p1",
      name: "P1",
      lat: 18.52,
      lng: 73.85,
      types: ["cafe"],
      priceLevel: 1,
    };
    const pTier3: PlaceCandidate = {
      id: "p3",
      name: "P3",
      lat: 18.52,
      lng: 73.85,
      types: ["cafe"],
      priceLevel: 3,
    };

    // Medium budget: tier 1 is value 1.0, tier 3 is 0.4
    const midCtx: UserContext = { ...baseCtx, budget: "medium" };
    const rankedMid = rankPlaces([pTier1, pTier3], midCtx, calmSignals, fixedNow);
    const affP1 = rankedMid
      .find((r) => r.place.id === "p1")
      ?.breakdown.find((b) => b.criterion === "Affordability")?.value;
    const affP3 = rankedMid
      .find((r) => r.place.id === "p3")
      ?.breakdown.find((b) => b.criterion === "Affordability")?.value;
    expect(affP1).toBe(1.0);
    expect(affP3).toBe(0.4);

    // High budget: tier 3 is value 1.0
    const highCtx: UserContext = { ...baseCtx, budget: "high" };
    const rankedHigh = rankPlaces([pTier3], highCtx, calmSignals, fixedNow);
    const affHigh = rankedHigh[0].breakdown.find((b) => b.criterion === "Affordability")?.value;
    expect(affHigh).toBe(1.0);

    // Accessibility requested, but place lacks accessibility data
    const noAccPlace: PlaceCandidate = {
      id: "no-acc",
      name: "Old Stairway Shop",
      lat: 18.52,
      lng: 73.85,
      types: ["shop"],
    };
    const accReqCtx: UserContext = { ...baseCtx, accessibilityNeeds: true };
    const rankedNoAcc = rankPlaces([noAccPlace], accReqCtx, calmSignals, fixedNow);
    const accItem = rankedNoAcc[0].breakdown.find((b) => b.criterion === "Accessibility");
    expect(accItem?.confidence).toBe("unknown");
    expect(accItem?.value).toBeUndefined();

    // Safe place with 0 blackspots adds reason
    const isolatedPlace: PlaceCandidate = {
      id: "isolated",
      name: "Quiet Spot",
      lat: 18.52,
      lng: 73.85,
      types: ["park"],
    };
    const distantBlackspot: Blackspot = {
      id: "bs-far",
      name: "Far Blackspot",
      lat: 18.6,
      lng: 73.95,
      period: "2024",
      severity: 4,
      hazardFactors: [],
      sourceName: "S",
      sourceUrl: "U",
      sourceNote: "N",
      coordinatesVerified: false,
    };
    const rankedSafe = rankPlaces([isolatedPlace], baseCtx, calmSignals, fixedNow, [
      distantBlackspot,
    ]);
    expect(rankedSafe[0].reasons).toContain("Safe location away from accident blackspots");
  });
});
