import { describe, it, expect } from "vitest";
import {
  calculateRouteRiskScore,
  rankPlaces,
  RouteRiskInput,
  PlaceRankingCriteria,
} from "@/core/scoring";

describe("Core Domain: Route Risk Scoring", () => {
  it("computes low risk score for route with no hazards or blackspots", () => {
    const input: RouteRiskInput = {
      routeLengthMeters: 3000,
      blackspotsNearRoute: [],
      weather: {
        rainIntensityMm: 0,
        isWaterloggedArea: false,
      },
      unlitStretchMeters: 0,
      activeHazardsCount: 0,
    };

    const result = calculateRouteRiskScore(input);
    expect(result.score).toBe(0);
    expect(result.category).toBe("SAFE");
    expect(result.breakdown.blackspotPenalty).toBe(0);
  });

  it("penalizes high severity blackspots and active monsoon waterlogging", () => {
    const input: RouteRiskInput = {
      routeLengthMeters: 5000,
      blackspotsNearRoute: [
        { severity: 5, distanceMeters: 50 }, // Critical blackspot very close
      ],
      weather: {
        rainIntensityMm: 15,
        isWaterloggedArea: true, // Waterlogged
      },
      unlitStretchMeters: 500,
      activeHazardsCount: 3,
    };

    const result = calculateRouteRiskScore(input);
    expect(result.score).toBeGreaterThan(60);
    expect(result.category).toBe("HIGH_RISK");
    expect(result.breakdown.weatherPenalty).toBeGreaterThanOrEqual(30);
  });

  it("classifies moderate risk score accurately", () => {
    const input: RouteRiskInput = {
      routeLengthMeters: 4000,
      blackspotsNearRoute: [{ severity: 2, distanceMeters: 200 }],
      weather: { rainIntensityMm: 5, isWaterloggedArea: false },
      unlitStretchMeters: 500,
      activeHazardsCount: 1,
    };
    const result = calculateRouteRiskScore(input);
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThan(65);
    expect(result.category).toBe("MODERATE");
  });
});

describe("Core Domain: Place Ranking", () => {
  it("ranks places based on rating, review count, and proximity", () => {
    const places: PlaceRankingCriteria[] = [
      {
        rating: 4.8,
        userRatingsTotal: 5000,
        distanceMeters: 800,
      },
      {
        rating: 3.2,
        userRatingsTotal: 50,
        distanceMeters: 4500,
      },
    ];

    const ranked = rankPlaces(places);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].compositeScore).toBeGreaterThan(ranked[1].compositeScore);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });
});
