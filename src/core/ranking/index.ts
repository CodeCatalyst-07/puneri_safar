/**
 * @file src/core/ranking/index.ts
 * Multi-criteria place ranking engine with Bayesian smoothing and missing-data renormalization.
 *
 * PURE BUSINESS LOGIC:
 * - Deterministic, floating-point evaluation.
 * - Missing data is NEVER silently scored 0; weights are renormalized dynamically.
 * - Stable tie-breaking guarantees reproducible ordering across identical runs.
 */

import { Blackspot, PlaceCandidate, ScoreConfidence, UserContext } from "../types";
import { ContextSignals } from "../signals";
import { haversineMeters } from "../geo";

export interface CriterionBreakdown {
  criterion: string;
  value?: number; // 0.0 to 1.0 when available
  weight: number; // Effective normalized weight
  confidence: ScoreConfidence;
  reason: string;
}

export interface RankedPlace {
  place: PlaceCandidate;
  score: number; // 0 to 100
  confidence: ScoreConfidence;
  breakdown: CriterionBreakdown[];
  reasons: string[];
}

export interface RankingConfig {
  bayesianPriorReviewCount: number; // m in (v*R + m*C)/(v+m)
  defaultMeanRating: number; // Fallback C if candidate set has no ratings
  maxDistanceDecayMeters: number;
  hazardBufferMeters: number;
  baseWeights: {
    rating: number;
    affordability: number;
    accessibility: number;
    distance: number;
    weatherSuitability: number;
    openNow: number;
    nearbyHazards: number;
  };
  nightHazardBoost: number;
  cautiousSafetyBoost: number;
  accessibilityNeedsBoost: number;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  bayesianPriorReviewCount: 20,
  defaultMeanRating: 3.8,
  maxDistanceDecayMeters: 10000, // 10 km
  hazardBufferMeters: 500,
  baseWeights: {
    rating: 0.25,
    affordability: 0.2,
    accessibility: 0.15,
    distance: 0.15,
    weatherSuitability: 0.1,
    openNow: 0.05,
    nearbyHazards: 0.1,
  },
  nightHazardBoost: 0.08,
  cautiousSafetyBoost: 0.12,
  accessibilityNeedsBoost: 0.1,
};

/**
 * Calculates mean rating of the candidate set (C).
 */
function calculateCandidateMeanRating(candidates: PlaceCandidate[], defaultMean: number): number {
  const rated = candidates.filter((c) => typeof c.rating === "number" && c.rating > 0);
  if (rated.length === 0) return defaultMean;
  // Blend with prior mean to avoid extreme small-sample skew
  const sum = rated.reduce((acc, c) => acc + (c.rating as number), 0) + defaultMean;
  return sum / (rated.length + 1);
}

/**
 * Scores affordability fit (0-1) against user budget and optional max price constraint.
 */
function scoreAffordability(
  priceLevel: number | undefined,
  budget: "low" | "medium" | "high",
  maxPriceLevel?: number
): { value?: number; confidence: ScoreConfidence; reason: string } {
  if (priceLevel === undefined) {
    return {
      value: undefined,
      confidence: "unknown",
      reason: "Price level data unavailable; excluded from scoring.",
    };
  }

  if (maxPriceLevel !== undefined && priceLevel > maxPriceLevel) {
    return {
      value: 0.1,
      confidence: "high",
      reason: `Exceeds user maximum price level cap (${priceLevel} > ${maxPriceLevel}).`,
    };
  }

  let val = 0.5;
  if (budget === "low") {
    val = priceLevel <= 1 ? 1.0 : priceLevel === 2 ? 0.6 : 0.2;
  } else if (budget === "medium") {
    val = priceLevel === 1 || priceLevel === 2 ? 1.0 : priceLevel === 0 ? 0.8 : 0.4;
  } else {
    // high budget
    val = priceLevel >= 2 ? 1.0 : 0.7;
  }

  return {
    value: val,
    confidence: "high",
    reason: `Price tier (${priceLevel}/4) aligned with ${budget} budget preference.`,
  };
}

/**
 * Evaluates weather suitability based on indoor/outdoor attributes and current rain/heat.
 */
function scoreWeatherSuitability(
  isIndoor: boolean | undefined,
  signals: ContextSignals,
  distanceMeters: number
): { value?: number; confidence: ScoreConfidence; reason: string } {
  if (isIndoor === undefined) {
    return {
      value: undefined,
      confidence: "unknown",
      reason: "Indoor/outdoor environment data unavailable; excluded from scoring.",
    };
  }

  if (signals.isRaining || signals.heavyRain) {
    if (isIndoor) {
      return {
        value: 1.0,
        confidence: "high",
        reason: "Indoor facility provides sheltered comfort during Pune monsoon rain.",
      };
    }
    return {
      value: 0.2,
      confidence: "high",
      reason: "Outdoor location penalized due to active rain/downpour conditions.",
    };
  }

  if (signals.heatStress && distanceMeters > 500) {
    if (!isIndoor) {
      return {
        value: 0.3,
        confidence: "high",
        reason: "Outdoor daytime walking penalized due to severe Pune heat advisory.",
      };
    }
    return {
      value: 1.0,
      confidence: "high",
      reason: "Air-conditioned or sheltered venue favored during extreme afternoon heat.",
    };
  }

  return {
    value: 1.0,
    confidence: "high",
    reason: "Current weather conditions are pleasant for this destination.",
  };
}

/**
 * Ranks place candidates based on multi-criteria Bayesian evaluation.
 */
export function rankPlaces(
  candidates: PlaceCandidate[],
  ctx: UserContext,
  signals: ContextSignals,
  _now: Date,
  blackspotsOrConfig?: Blackspot[] | RankingConfig,
  maybeConfig?: RankingConfig
): RankedPlace[] {
  if (!candidates || candidates.length === 0) {
    return [];
  }

  const blackspots: Blackspot[] = Array.isArray(blackspotsOrConfig) ? blackspotsOrConfig : [];
  const config: RankingConfig =
    blackspotsOrConfig && !Array.isArray(blackspotsOrConfig) && "baseWeights" in blackspotsOrConfig
      ? blackspotsOrConfig
      : (maybeConfig ?? DEFAULT_RANKING_CONFIG);

  const C = calculateCandidateMeanRating(candidates, config.defaultMeanRating);
  const m = config.bayesianPriorReviewCount;

  const results: RankedPlace[] = candidates.map((place) => {
    const rawBreakdown: CriterionBreakdown[] = [];
    const reasons: string[] = [];

    // 1. Bayesian Smoothed Rating: (v*R + m*C)/(v+m)
    if (typeof place.rating === "number") {
      const v = place.ratingCount ?? 1;
      const R = place.rating;
      const smoothed = (v * R + m * C) / (v + m);
      const normalizedRating = Math.max(0, Math.min(1, smoothed / 5.0));

      rawBreakdown.push({
        criterion: "Rating (Bayesian)",
        value: Number(normalizedRating.toFixed(3)),
        weight: config.baseWeights.rating,
        confidence: v > 10 ? "high" : "low",
        reason: `Rating ${R.toFixed(1)}/5 (${v} reviews) Bayesian-smoothed to ${smoothed.toFixed(2)}.`,
      });

      if (normalizedRating >= 0.8) {
        reasons.push("Strong community rating and review consensus");
      }
    } else {
      rawBreakdown.push({
        criterion: "Rating (Bayesian)",
        value: undefined,
        weight: 0,
        confidence: "unknown",
        reason: "No ratings provided; excluded from scoring.",
      });
    }

    // 2. Affordability
    const aff = scoreAffordability(place.priceLevel, ctx.budget, ctx.maxPriceLevel);
    rawBreakdown.push({
      criterion: "Affordability",
      value: aff.value,
      weight: aff.value !== undefined ? config.baseWeights.affordability : 0,
      confidence: aff.confidence,
      reason: aff.reason,
    });
    if (aff.value !== undefined && aff.value >= 0.9) {
      reasons.push("Excellent budget match");
    }

    // 3. Accessibility Match (evaluated only if user requested accessibility needs)
    if (ctx.accessibilityNeeds) {
      const accWeight = config.baseWeights.accessibility + config.accessibilityNeedsBoost;

      if (place.accessibility) {
        let accScore = 0.5;
        if (place.accessibility.wheelchairEntrance) accScore += 0.3;
        if (place.accessibility.wheelchairRestroom) accScore += 0.2;
        accScore = Math.min(1.0, accScore);

        rawBreakdown.push({
          criterion: "Accessibility",
          value: Number(accScore.toFixed(2)),
          weight: accWeight,
          confidence: "high",
          reason: `Verified accessibility features matching user mobility criteria.`,
        });
        if (accScore >= 0.8) {
          reasons.push("Wheelchair accessible entrance and facilities");
        }
      } else {
        rawBreakdown.push({
          criterion: "Accessibility",
          value: undefined,
          weight: 0,
          confidence: "unknown",
          reason: "Accessibility attributes unverified for this place; excluded.",
        });
      }
    }

    // 4. Proximity / Distance Decay
    const distanceMeters =
      place.distanceMeters ?? haversineMeters(ctx.location, { lat: place.lat, lng: place.lng });

    const distanceDecay = Math.max(0, 1 - distanceMeters / config.maxDistanceDecayMeters);
    rawBreakdown.push({
      criterion: "Proximity",
      value: Number(distanceDecay.toFixed(3)),
      weight: config.baseWeights.distance,
      confidence: "high",
      reason: `Located ${(distanceMeters / 1000).toFixed(1)} km from your current spot.`,
    });
    if (distanceMeters < 1500) {
      reasons.push("Nearby and convenient to reach");
    }

    // 5. Weather Suitability
    const weatherRes = scoreWeatherSuitability(place.isIndoor, signals, distanceMeters);
    rawBreakdown.push({
      criterion: "Weather Suitability",
      value: weatherRes.value,
      weight: weatherRes.value !== undefined ? config.baseWeights.weatherSuitability : 0,
      confidence: weatherRes.confidence,
      reason: weatherRes.reason,
    });
    if (weatherRes.value !== undefined && weatherRes.value >= 0.9 && signals.isRaining) {
      reasons.push("Weather-sheltered indoor environment");
    }

    // 6. Open Now Status
    if (typeof place.openNow === "boolean") {
      const openVal = place.openNow ? 1.0 : 0.1;
      rawBreakdown.push({
        criterion: "Operating Hours",
        value: openVal,
        weight: config.baseWeights.openNow,
        confidence: "high",
        reason: place.openNow ? "Verified open right now." : "Currently closed or opening later.",
      });
      if (place.openNow) {
        reasons.push("Open now");
      }
    } else {
      rawBreakdown.push({
        criterion: "Operating Hours",
        value: undefined,
        weight: 0,
        confidence: "unknown",
        reason: "Live opening hours unavailable; excluded from scoring.",
      });
    }

    // 7. Nearby Hazards / Blackspot Exposure
    if (blackspots.length > 0) {
      let hazardWeight = config.baseWeights.nearbyHazards;
      if (signals.isNight) {
        hazardWeight += config.nightHazardBoost;
      }
      if (ctx.safetyPreference === "cautious") {
        hazardWeight += config.cautiousSafetyBoost;
      }

      const nearbyCount = blackspots.filter((b) => {
        const d = haversineMeters({ lat: place.lat, lng: place.lng }, { lat: b.lat, lng: b.lng });
        return d <= config.hazardBufferMeters;
      }).length;

      let hazardScore = 1.0;
      if (nearbyCount === 1) hazardScore = 0.6;
      else if (nearbyCount === 2) hazardScore = 0.3;
      else if (nearbyCount >= 3) hazardScore = 0.0;

      rawBreakdown.push({
        criterion: "Hazard Avoidance",
        value: hazardScore,
        weight: hazardWeight,
        confidence: "high",
        reason:
          nearbyCount === 0
            ? "Located away from known Pune Police accident blackspots."
            : `Proximity to ${nearbyCount} documented accident blackspot(s).`,
      });
      if (hazardScore >= 0.8) {
        reasons.push("Safe location away from accident blackspots");
      }
    } else {
      rawBreakdown.push({
        criterion: "Hazard Avoidance",
        value: undefined,
        weight: 0,
        confidence: "unknown",
        reason: "Accident blackspot data unavailable; excluded from scoring.",
      });
    }

    // --- MISSING DATA RENORMALIZATION RULE ---
    // Only criteria with defined values contribute to total active weight.
    const validCriteria = rawBreakdown.filter((c) => typeof c.value === "number");
    const totalValidWeight = validCriteria.reduce((sum, c) => sum + c.weight, 0);

    let finalScore = 50; // Neutral baseline if no criteria valid
    let overallConfidence: ScoreConfidence = "high";

    if (totalValidWeight > 0) {
      const weightedSum = validCriteria.reduce(
        (sum, c) => sum + (c.value as number) * (c.weight / totalValidWeight),
        0
      );
      finalScore = Math.round(weightedSum * 100);
    } else {
      overallConfidence = "unknown";
    }

    // If more than 50% of criteria were missing, downgrade confidence
    const missingCount = rawBreakdown.filter((c) => c.confidence === "unknown").length;
    if (missingCount >= 4) {
      overallConfidence = "low";
    }

    // Reflect normalized weights back in breakdown
    const finalizedBreakdown = rawBreakdown.map((item) => ({
      ...item,
      weight:
        totalValidWeight > 0 && typeof item.value === "number"
          ? Number((item.weight / totalValidWeight).toFixed(3))
          : 0,
    }));

    return {
      place,
      score: finalScore,
      confidence: overallConfidence,
      breakdown: finalizedBreakdown,
      reasons: reasons.slice(0, 3),
    };
  });

  // Stable deterministic sorting: Score descending, ID ascending for ties
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.place.id.localeCompare(b.place.id);
  });

  return results;
}
