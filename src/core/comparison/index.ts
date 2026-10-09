/**
 * @file src/core/comparison/index.ts
 * Multi-factor Best-vs-Worst place comparative analysis engine for Pune.
 *
 * PURE BUSINESS LOGIC:
 * - Deterministic: `now: Date` is explicitly injected.
 * - Handles 'insufficient data' gracefully without making up metrics.
 */

import { Blackspot, PlaceCandidate, Report, ScoreConfidence, UserContext } from "../types";
import { ContextSignals } from "../signals";
import { haversineMeters } from "../geo";

export interface ComparisonConfig {
  minReportsForCleanliness: number;
  hazardBufferMeters: number;
  cleanlinessBufferMeters: number;
}

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  minReportsForCleanliness: 2,
  hazardBufferMeters: 500,
  cleanlinessBufferMeters: 500,
};

export interface PlaceDimensionComparison {
  dimension: "safety_hazard" | "cleanliness" | "affordability" | "rating" | "accessibility";
  status: "conclusive" | "insufficient_data" | "tied";
  bestPlace?: {
    placeId: string;
    placeName: string;
    metricLabel: string;
    reason: string;
  };
  worstPlace?: {
    placeId: string;
    placeName: string;
    metricLabel: string;
    reason: string;
  };
  confidence: ScoreConfidence;
  details: string;
}

export interface PlaceComparisonResult {
  placesCount: number;
  dimensions: PlaceDimensionComparison[];
  overallSummary: string;
  confidence: ScoreConfidence;
  timestampIso: string;
}

/**
 * Compares a list of candidate places across multiple dimensions, returning clear best and worst designations.
 */
export function compareBestWorst(
  places: PlaceCandidate[],
  ctx: UserContext,
  _signals: ContextSignals,
  reports: Report[],
  blackspots: Blackspot[],
  now: Date,
  config: ComparisonConfig = DEFAULT_COMPARISON_CONFIG
): PlaceComparisonResult {
  if (!places || places.length < 2) {
    throw new Error("Best-vs-worst comparison requires at least 2 place candidates.");
  }

  const dimensions: PlaceDimensionComparison[] = [];

  // --- Dimension 1: Rating Comparison ---
  const ratedPlaces = places.filter((p) => typeof p.rating === "number");
  if (ratedPlaces.length < 2) {
    dimensions.push({
      dimension: "rating",
      status: "insufficient_data",
      confidence: "unknown",
      details: "Insufficient community ratings to compare places objectively.",
    });
  } else {
    const sorted = [...ratedPlaces].sort((a, b) => (b.rating as number) - (a.rating as number));
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    if (highest.rating === lowest.rating) {
      dimensions.push({
        dimension: "rating",
        status: "tied",
        confidence: "high",
        details: `All candidates share an identical rating of ${highest.rating}/5.`,
      });
    } else {
      dimensions.push({
        dimension: "rating",
        status: "conclusive",
        bestPlace: {
          placeId: highest.id,
          placeName: highest.name,
          metricLabel: `${highest.rating}/5`,
          reason: `Highest rated with ${highest.ratingCount ?? 0} verified reviews.`,
        },
        worstPlace: {
          placeId: lowest.id,
          placeName: lowest.name,
          metricLabel: `${lowest.rating}/5`,
          reason: `Lowest customer satisfaction score among candidates.`,
        },
        confidence: "high",
        details: `${highest.name} leads with a ${highest.rating}/5 rating vs ${lowest.name} at ${lowest.rating}/5.`,
      });
    }
  }

  // --- Dimension 2: Affordability Comparison ---
  const pricedPlaces = places.filter((p) => typeof p.priceLevel === "number");
  if (pricedPlaces.length < 2) {
    dimensions.push({
      dimension: "affordability",
      status: "insufficient_data",
      confidence: "unknown",
      details: "Price tier data unavailable for one or more candidates.",
    });
  } else {
    // For low/medium budget, lowest price tier is best. For high budget, luxury (highest) is preferred.
    const sorted = [...pricedPlaces].sort((a, b) => {
      const aVal = a.priceLevel as number;
      const bVal = b.priceLevel as number;
      return ctx.budget === "high" ? bVal - aVal : aVal - bVal;
    });

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best.priceLevel === worst.priceLevel) {
      dimensions.push({
        dimension: "affordability",
        status: "tied",
        confidence: "high",
        details: `Both locations fall into identical price tier ${best.priceLevel}/4.`,
      });
    } else {
      dimensions.push({
        dimension: "affordability",
        status: "conclusive",
        bestPlace: {
          placeId: best.id,
          placeName: best.name,
          metricLabel: `Tier ${best.priceLevel}/4`,
          reason: `Best aligned with ${ctx.budget} budget preference.`,
        },
        worstPlace: {
          placeId: worst.id,
          placeName: worst.name,
          metricLabel: `Tier ${worst.priceLevel}/4`,
          reason: `Least compatible with selected budget criteria.`,
        },
        confidence: "high",
        details: `${best.name} offers superior budget alignment for your preference.`,
      });
    }
  }

  // --- Dimension 3: Accessibility Comparison ---
  const placesWithAccData = places.filter((p) => p.accessibility !== undefined);
  if (placesWithAccData.length < 2) {
    dimensions.push({
      dimension: "accessibility",
      status: "insufficient_data",
      confidence: "unknown",
      details: "Accessibility audit data incomplete across candidates.",
    });
  } else {
    const scoredAcc = placesWithAccData.map((p) => {
      let count = 0;
      if (p.accessibility?.wheelchairEntrance) count++;
      if (p.accessibility?.wheelchairRestroom) count++;
      if (p.accessibility?.wheelchairParking) count++;
      return { place: p, count };
    });

    scoredAcc.sort((a, b) => b.count - a.count);
    const bestAcc = scoredAcc[0];
    const worstAcc = scoredAcc[scoredAcc.length - 1];

    if (bestAcc.count === worstAcc.count) {
      dimensions.push({
        dimension: "accessibility",
        status: "tied",
        confidence: "high",
        details: `Both locations possess comparable accessibility features (${bestAcc.count} verified amenities).`,
      });
    } else {
      dimensions.push({
        dimension: "accessibility",
        status: "conclusive",
        bestPlace: {
          placeId: bestAcc.place.id,
          placeName: bestAcc.place.name,
          metricLabel: `${bestAcc.count} features verified`,
          reason: "Equipped with step-free entrance and accessible facilities.",
        },
        worstPlace: {
          placeId: worstAcc.place.id,
          placeName: worstAcc.place.name,
          metricLabel: `${worstAcc.count} features verified`,
          reason: "Lacks step-free access or accessible restrooms.",
        },
        confidence: "high",
        details: `${bestAcc.place.name} is significantly more accessible for wheelchair visitors.`,
      });
    }
  }

  // --- Dimension 4: Safety / Hazard Proximity ---
  const placeHazardScores = places.map((place) => {
    let nearbyBlackspots = 0;
    for (const b of blackspots) {
      const dist = haversineMeters({ lat: place.lat, lng: place.lng }, { lat: b.lat, lng: b.lng });
      if (dist <= config.hazardBufferMeters) {
        nearbyBlackspots++;
      }
    }
    return { place, nearbyBlackspots };
  });

  placeHazardScores.sort((a, b) => a.nearbyBlackspots - b.nearbyBlackspots);
  const safest = placeHazardScores[0];
  const riskiest = placeHazardScores[placeHazardScores.length - 1];

  if (safest.nearbyBlackspots === riskiest.nearbyBlackspots) {
    dimensions.push({
      dimension: "safety_hazard",
      status: "tied",
      confidence: "high",
      details: `Candidates have identical proximity exposure to official accident blackspots (${safest.nearbyBlackspots} within 500m).`,
    });
  } else {
    dimensions.push({
      dimension: "safety_hazard",
      status: "conclusive",
      bestPlace: {
        placeId: safest.place.id,
        placeName: safest.place.name,
        metricLabel: `${safest.nearbyBlackspots} blackspot(s) nearby`,
        reason: "Located away from known Pune Traffic Police high-crash junctions.",
      },
      worstPlace: {
        placeId: riskiest.place.id,
        placeName: riskiest.place.name,
        metricLabel: `${riskiest.nearbyBlackspots} blackspot(s) nearby`,
        reason: "Located in close proximity to documented accident blackspot stretches.",
      },
      confidence: "high",
      details: `${safest.place.name} has lower documented traffic crash exposure than ${riskiest.place.name}.`,
    });
  }

  // --- Dimension 5: Cleanliness Proximity ---
  // Requires minimum number of recent citizen cleanliness reports
  const cleanlinessReports = reports.filter((r) => r.category === "cleanliness");
  const uniqueNearbyReportIds = new Set<string>();

  const placeCleanlinessReports = places.map((p) => {
    const nearby = cleanlinessReports.filter((r) => {
      const d = haversineMeters({ lat: p.lat, lng: p.lng }, { lat: r.lat, lng: r.lng });
      if (d <= config.cleanlinessBufferMeters) {
        uniqueNearbyReportIds.add(r.id);
        return true;
      }
      return false;
    });
    return { place: p, count: nearby.length };
  });

  if (uniqueNearbyReportIds.size < config.minReportsForCleanliness) {
    dimensions.push({
      dimension: "cleanliness",
      status: "insufficient_data",
      confidence: "unknown",
      details: `Insufficient citizen cleanliness reports (${uniqueNearbyReportIds.size} < ${config.minReportsForCleanliness}) in the surrounding 500m area to evaluate cleanliness fairly.`,
    });
  } else {
    // Fewer cleanliness complaints = better
    placeCleanlinessReports.sort((a, b) => a.count - b.count);
    const cleanest = placeCleanlinessReports[0];
    const leastClean = placeCleanlinessReports[placeCleanlinessReports.length - 1];

    dimensions.push({
      dimension: "cleanliness",
      status: "conclusive",
      bestPlace: {
        placeId: cleanest.place.id,
        placeName: cleanest.place.name,
        metricLabel: `${cleanest.count} cleanliness issues reported`,
        reason: "Fewest citizen litter or sanitation complaints.",
      },
      worstPlace: {
        placeId: leastClean.place.id,
        placeName: leastClean.place.name,
        metricLabel: `${leastClean.count} cleanliness issues reported`,
        reason: "Highest cluster of sanitation/garbage complaints.",
      },
      confidence: "high",
      details: `${cleanest.place.name} has fewer recorded citizen cleanliness reports.`,
    });
  }

  // Build composite summary
  const conclusiveDimensions = dimensions.filter((d) => d.status === "conclusive");
  const overallSummary =
    conclusiveDimensions.length > 0
      ? `Compared across ${dimensions.length} criteria with ${conclusiveDimensions.length} conclusive dimensions and ${dimensions.length - conclusiveDimensions.length} requiring further data.`
      : "Insufficient comparative data across candidates.";

  return {
    placesCount: places.length,
    dimensions,
    overallSummary,
    confidence: conclusiveDimensions.length >= 2 ? "high" : "low",
    timestampIso: now.toISOString(),
  };
}
