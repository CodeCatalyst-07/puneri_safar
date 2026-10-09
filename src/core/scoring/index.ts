/**
 * @file src/core/scoring/index.ts
 * Pure domain logic types and function contracts for Puneri Safar scoring algorithms.
 *
 * PURE BUSINESS LOGIC:
 * - No network calls
 * - No framework imports (no React, Next.js, or external SDKs)
 * - Deterministic, highly testable mathematics
 */

export interface BlackspotRiskFactor {
  /** Severity score between 1 (minor) and 5 (critical/fatal) */
  severity: 1 | 2 | 3 | 4 | 5;
  /** Distance in meters from the route or point */
  distanceMeters: number;
}

export interface WeatherRiskFactor {
  /** Rain intensity in mm/hr */
  rainIntensityMm: number;
  /** Whether active waterlogging alerts exist on route */
  isWaterloggedArea: boolean;
}

export interface RouteRiskInput {
  routeLengthMeters: number;
  blackspotsNearRoute: BlackspotRiskFactor[];
  weather: WeatherRiskFactor;
  unlitStretchMeters: number;
  activeHazardsCount: number;
}

export interface RouteRiskScore {
  /** Overall risk index normalized from 0 (very safe) to 100 (high hazard) */
  score: number;
  category: "SAFE" | "MODERATE" | "HIGH_RISK";
  breakdown: {
    blackspotPenalty: number;
    weatherPenalty: number;
    lightingPenalty: number;
    hazardPenalty: number;
  };
}

export interface PlaceRankingCriteria {
  rating: number;
  userRatingsTotal: number;
  distanceMeters: number;
  heritageSignificance?: number; // 0 to 10
  safetyScore?: number; // 0 to 100
}

export interface PlaceRankingResult {
  compositeScore: number;
  rank: number;
}

/**
 * Pure function placeholder for route risk assessment.
 * (Will compute weighted penalty against Pune accident blackspots and waterlogging)
 */
export function calculateRouteRiskScore(input: RouteRiskInput): RouteRiskScore {
  let blackspotPenalty = 0;
  for (const bs of input.blackspotsNearRoute) {
    // Inverse distance weighting
    const distanceFactor = Math.max(0.1, 1 - bs.distanceMeters / 500);
    blackspotPenalty += bs.severity * 10 * distanceFactor;
  }

  const weatherPenalty =
    (input.weather.isWaterloggedArea ? 30 : 0) + Math.min(20, input.weather.rainIntensityMm * 2);
  const lightingPenalty = Math.min(25, (input.unlitStretchMeters / 1000) * 15);
  const hazardPenalty = Math.min(25, input.activeHazardsCount * 5);

  const rawScore = blackspotPenalty + weatherPenalty + lightingPenalty + hazardPenalty;
  const score = Math.min(100, Math.round(rawScore));

  const category = score < 30 ? "SAFE" : score < 65 ? "MODERATE" : "HIGH_RISK";

  return {
    score,
    category,
    breakdown: {
      blackspotPenalty: Math.round(blackspotPenalty),
      weatherPenalty: Math.round(weatherPenalty),
      lightingPenalty: Math.round(lightingPenalty),
      hazardPenalty: Math.round(hazardPenalty),
    },
  };
}

/**
 * Pure function placeholder for multi-criteria place ranking (exploration vs best-vs-worst).
 */
export function rankPlaces(places: PlaceRankingCriteria[]): PlaceRankingResult[] {
  return places.map((place, index) => {
    // Normalized rating score (0 - 50 points)
    const ratingScore = (place.rating / 5) * 50;
    // Popularity confidence factor (0 - 20 points)
    const confidenceScore = Math.min(20, Math.log10(Math.max(1, place.userRatingsTotal)) * 5);
    // Distance penalty (0 - 30 points)
    const proximityScore = Math.max(0, 30 - (place.distanceMeters / 1000) * 3);

    const compositeScore = Math.round(ratingScore + confidenceScore + proximityScore);
    return {
      compositeScore,
      rank: index + 1,
    };
  });
}
