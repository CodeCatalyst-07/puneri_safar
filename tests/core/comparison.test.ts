import { describe, it, expect } from "vitest";
import { compareBestWorst } from "@/core/comparison";
import { Blackspot, PlaceCandidate, Report, UserContext } from "@/core/types";
import { ContextSignals } from "@/core/signals";

describe("Core Comparison: compareBestWorst", () => {
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

  const placeA: PlaceCandidate = {
    id: "place-a",
    name: "Cafe Goodluck",
    lat: 18.512,
    lng: 73.8415,
    types: ["cafe"],
    rating: 4.5,
    ratingCount: 12000,
    priceLevel: 1,
    accessibility: {
      wheelchairEntrance: true,
      wheelchairRestroom: true,
      wheelchairParking: true,
    },
    openNow: true,
    isIndoor: true,
  };

  const placeB: PlaceCandidate = {
    id: "place-b",
    name: "Vaishali Restaurant",
    lat: 18.5215,
    lng: 73.8402,
    types: ["restaurant"],
    rating: 4.2,
    ratingCount: 18000,
    priceLevel: 2,
    accessibility: {
      wheelchairEntrance: false,
      wheelchairRestroom: false,
      wheelchairParking: false,
    },
    openNow: true,
    isIndoor: true,
  };

  it("throws an error when provided fewer than 2 candidates", () => {
    expect(() => compareBestWorst([], baseCtx, calmSignals, [], [], fixedNow)).toThrowError(
      /at least 2 place candidates/
    );

    expect(() => compareBestWorst([placeA], baseCtx, calmSignals, [], [], fixedNow)).toThrowError(
      /at least 2 place candidates/
    );
  });

  it("returns conclusive results across dimensions when full data is available", () => {
    const cleanlinessReports: Report[] = [
      {
        id: "rep-clean-1",
        category: "cleanliness",
        severity: 2,
        lat: 18.5215,
        lng: 73.8402, // Near place B
        createdAt: "2026-10-08T10:00:00Z",
        status: "corroborated",
        confidence: 0.9,
      },
      {
        id: "rep-clean-2",
        category: "cleanliness",
        severity: 2,
        lat: 18.5216,
        lng: 73.8403, // Near place B
        createdAt: "2026-10-08T11:00:00Z",
        status: "official",
        confidence: 1.0,
      },
    ];

    const blackspots: Blackspot[] = [
      {
        id: "bs-fc-road",
        name: "FC Road Junction",
        lat: 18.5216,
        lng: 73.8404, // Near place B
        crashCount: 15,
        period: "2022-2024",
        severity: 4,
        hazardFactors: ["pedestrian_conflict"],
        sourceName: "Pune Police",
        sourceUrl: "https://example.com",
        sourceNote: "Audit",
        coordinatesVerified: false,
      },
    ];

    const result = compareBestWorst(
      [placeA, placeB],
      baseCtx,
      calmSignals,
      cleanlinessReports,
      blackspots,
      fixedNow
    );

    expect(result.placesCount).toBe(2);
    expect(result.dimensions).toHaveLength(5);
    expect(result.confidence).toBe("high");

    // Rating dimension
    const ratingDim = result.dimensions.find((d) => d.dimension === "rating");
    expect(ratingDim?.status).toBe("conclusive");
    expect(ratingDim?.bestPlace?.placeId).toBe("place-a"); // 4.5 > 4.2
    expect(ratingDim?.worstPlace?.placeId).toBe("place-b");

    // Affordability dimension (low budget preference: tier 1 is better than tier 2)
    const affordDim = result.dimensions.find((d) => d.dimension === "affordability");
    expect(affordDim?.status).toBe("conclusive");
    expect(affordDim?.bestPlace?.placeId).toBe("place-a"); // priceLevel 1 vs 2
    expect(affordDim?.worstPlace?.placeId).toBe("place-b");

    // Accessibility dimension
    const accessDim = result.dimensions.find((d) => d.dimension === "accessibility");
    expect(accessDim?.status).toBe("conclusive");
    expect(accessDim?.bestPlace?.placeId).toBe("place-a"); // 2 features vs 0
    expect(accessDim?.worstPlace?.placeId).toBe("place-b");

    // Safety hazard dimension
    const safetyDim = result.dimensions.find((d) => d.dimension === "safety_hazard");
    expect(safetyDim?.status).toBe("conclusive");
    expect(safetyDim?.bestPlace?.placeId).toBe("place-a"); // 0 blackspots vs 1
    expect(safetyDim?.worstPlace?.placeId).toBe("place-b");

    // Cleanliness dimension
    const cleanDim = result.dimensions.find((d) => d.dimension === "cleanliness");
    expect(cleanDim?.status).toBe("conclusive");
    expect(cleanDim?.bestPlace?.placeId).toBe("place-a"); // 0 reports vs 2
    expect(cleanDim?.worstPlace?.placeId).toBe("place-b");
  });

  it("marks cleanliness as 'insufficient_data' when reports count is below threshold (< 2)", () => {
    // Only 1 cleanliness report in the entire area
    const singleReport: Report[] = [
      {
        id: "rep-clean-1",
        category: "cleanliness",
        severity: 1,
        lat: 18.5173,
        lng: 73.8415,
        createdAt: "2026-10-08T10:00:00Z",
        status: "corroborated",
        confidence: 0.9,
      },
    ];

    const result = compareBestWorst(
      [placeA, placeB],
      baseCtx,
      calmSignals,
      singleReport,
      [],
      fixedNow
    );

    const cleanDim = result.dimensions.find((d) => d.dimension === "cleanliness");
    expect(cleanDim?.status).toBe("insufficient_data");
    expect(cleanDim?.confidence).toBe("unknown");
    expect(cleanDim?.details).toContain("< 2");
  });

  it("handles identical metrics across candidates with 'tied' status", () => {
    const identicalPlace1: PlaceCandidate = {
      id: "place-1",
      name: "Heritage Wada 1",
      lat: 18.519,
      lng: 73.855,
      types: ["historical_landmark"],
      rating: 4.4,
      priceLevel: 0,
      accessibility: { wheelchairEntrance: true },
    };

    const identicalPlace2: PlaceCandidate = {
      id: "place-2",
      name: "Heritage Wada 2",
      lat: 18.5191,
      lng: 73.8551,
      types: ["historical_landmark"],
      rating: 4.4,
      priceLevel: 0,
      accessibility: { wheelchairEntrance: true },
    };

    const result = compareBestWorst(
      [identicalPlace1, identicalPlace2],
      baseCtx,
      calmSignals,
      [],
      [],
      fixedNow
    );

    const ratingDim = result.dimensions.find((d) => d.dimension === "rating");
    expect(ratingDim?.status).toBe("tied");

    const affordDim = result.dimensions.find((d) => d.dimension === "affordability");
    expect(affordDim?.status).toBe("tied");

    const accessDim = result.dimensions.find((d) => d.dimension === "accessibility");
    expect(accessDim?.status).toBe("tied");

    const safetyDim = result.dimensions.find((d) => d.dimension === "safety_hazard");
    expect(safetyDim?.status).toBe("tied");
  });

  it("reverses affordability preference for high budget users (luxury tier 4 preferred over tier 1)", () => {
    const budgetPlace: PlaceCandidate = {
      id: "cheap-eats",
      name: "Street Stall",
      lat: 18.52,
      lng: 73.85,
      types: ["restaurant"],
      priceLevel: 1,
    };

    const luxuryPlace: PlaceCandidate = {
      id: "luxury-dining",
      name: "Rooftop Fine Dining",
      lat: 18.52,
      lng: 73.85,
      types: ["restaurant"],
      priceLevel: 4,
    };

    const highBudgetCtx: UserContext = {
      ...baseCtx,
      budget: "high",
    };

    const result = compareBestWorst(
      [budgetPlace, luxuryPlace],
      highBudgetCtx,
      calmSignals,
      [],
      [],
      fixedNow
    );

    const affordDim = result.dimensions.find((d) => d.dimension === "affordability");
    expect(affordDim?.status).toBe("conclusive");
    expect(affordDim?.bestPlace?.placeId).toBe("luxury-dining");
    expect(affordDim?.worstPlace?.placeId).toBe("cheap-eats");
  });

  it("marks rating and accessibility as 'insufficient_data' when data is missing across candidates", () => {
    const unratedPlace1: PlaceCandidate = {
      id: "unrated-1",
      name: "Hidden Spot 1",
      lat: 18.52,
      lng: 73.85,
      types: ["park"],
    };

    const unratedPlace2: PlaceCandidate = {
      id: "unrated-2",
      name: "Hidden Spot 2",
      lat: 18.52,
      lng: 73.85,
      types: ["park"],
    };

    const result = compareBestWorst(
      [unratedPlace1, unratedPlace2],
      baseCtx,
      calmSignals,
      [],
      [],
      fixedNow
    );

    const ratingDim = result.dimensions.find((d) => d.dimension === "rating");
    expect(ratingDim?.status).toBe("insufficient_data");

    const accessDim = result.dimensions.find((d) => d.dimension === "accessibility");
    expect(accessDim?.status).toBe("insufficient_data");

    const affordDim = result.dimensions.find((d) => d.dimension === "affordability");
    expect(affordDim?.status).toBe("insufficient_data");

    // Low confidence overall when insufficient conclusive dimensions
    expect(result.confidence).toBe("low");
  });
});
