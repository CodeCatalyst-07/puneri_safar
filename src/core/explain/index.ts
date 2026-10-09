/**
 * @file src/core/explain/index.ts
 * Fact synthesizer turning deterministic core metrics into structured, verbalizable facts.
 *
 * PURE BUSINESS LOGIC:
 * - Deterministic: `now: Date` is explicitly injected.
 * - The LLM is NEVER the source of numbers; this module generates verified ground facts
 *   that the generative AI later verbalizes in plain language.
 */

import { ScoreConfidence } from "../types";
import { RouteChoiceResult } from "../safety";
import { RankedPlace } from "../ranking";
import { PlaceComparisonResult } from "../comparison";

export interface ExplanationFacts {
  summary: string;
  topReasons: string[];
  tradeoffs: string[];
  dataQualityNotes: string[];
  verifiedMetrics: {
    primaryScore?: number;
    hazardIndex?: number;
    minutesAdded?: number;
    hazardPointsAvoided?: number;
    placesEvaluated?: number;
    confidence: ScoreConfidence;
    timestampIso: string;
  };
}

/**
 * Builds factual structured explanation for route safety tradeoff.
 */
export function buildRouteExplanationFacts(choice: RouteChoiceResult, now: Date): ExplanationFacts {
  const topReasons: string[] = [];
  const tradeoffs: string[] = [];
  const dataQualityNotes: string[] = [];

  const safestHazards = choice.fewestHazardsAssessment.hazardIndex;

  if (
    choice.tradeoff.recommendation === "fewest_hazards" &&
    choice.tradeoff.hazardPointsAvoided > 0
  ) {
    topReasons.push(
      `Safer corridor avoids ${choice.tradeoff.hazardPointsAvoided} hazard points compared to the fastest route.`
    );
    tradeoffs.push(
      `Adds approximately ${choice.tradeoff.minutesAdded} minute(s) of travel time for improved safety.`
    );
  } else {
    topReasons.push("Fastest route has minimal known hazard exposure.");
    tradeoffs.push("No significant safety advantage found on alternative detours.");
  }

  if (choice.fewestHazardsAssessment.breakdown.length > 0) {
    const blackspotCount = choice.fewestHazardsAssessment.breakdown.filter(
      (b) => b.type === "blackspot"
    ).length;
    if (blackspotCount > 0) {
      topReasons.push(
        `Route runs near ${blackspotCount} documented Pune Police accident blackspot(s).`
      );
    }
  }

  dataQualityNotes.push(...choice.fewestHazardsAssessment.caveats);

  return {
    summary: choice.tradeoff.rationale,
    topReasons,
    tradeoffs,
    dataQualityNotes,
    verifiedMetrics: {
      hazardIndex: safestHazards,
      minutesAdded: choice.tradeoff.minutesAdded,
      hazardPointsAvoided: choice.tradeoff.hazardPointsAvoided,
      confidence: choice.fewestHazardsAssessment.confidence,
      timestampIso: now.toISOString(),
    },
  };
}

/**
 * Builds factual structured explanation for place ranking decisions.
 */
export function buildRankingExplanationFacts(ranked: RankedPlace[], now: Date): ExplanationFacts {
  if (ranked.length === 0) {
    return {
      summary: "No candidate places available for evaluation.",
      topReasons: [],
      tradeoffs: [],
      dataQualityNotes: ["Candidate list was empty."],
      verifiedMetrics: {
        placesEvaluated: 0,
        confidence: "unknown",
        timestampIso: now.toISOString(),
      },
    };
  }

  const top = ranked[0];
  const topReasons = [...top.reasons];
  const tradeoffs: string[] = [];
  const dataQualityNotes: string[] = [];

  // Add runner-up tradeoff if available
  if (ranked.length > 1) {
    const runnerUp = ranked[1];
    tradeoffs.push(
      `${top.place.name} leads with score ${top.score}/100 over ${runnerUp.place.name} (${runnerUp.score}/100).`
    );
  }

  const unknownCriteria = top.breakdown.filter((b) => b.confidence === "unknown");
  if (unknownCriteria.length > 0) {
    dataQualityNotes.push(
      `${unknownCriteria.length} criteria were unverified or missing and were renormalized without penalty.`
    );
  }

  return {
    summary: `${top.place.name} is the highest ranked recommendation (${top.score}/100).`,
    topReasons,
    tradeoffs,
    dataQualityNotes,
    verifiedMetrics: {
      primaryScore: top.score,
      placesEvaluated: ranked.length,
      confidence: top.confidence,
      timestampIso: now.toISOString(),
    },
  };
}

/**
 * Builds factual structured explanation for place comparisons.
 */
export function buildComparisonExplanationFacts(
  comparison: PlaceComparisonResult,
  now: Date
): ExplanationFacts {
  const topReasons: string[] = [];
  const tradeoffs: string[] = [];
  const dataQualityNotes: string[] = [];

  for (const dim of comparison.dimensions) {
    if (dim.status === "conclusive" && dim.bestPlace) {
      topReasons.push(
        `${dim.dimension.replace(/_/g, " ")}: ${dim.bestPlace.placeName} wins (${dim.bestPlace.metricLabel}).`
      );
    } else if (dim.status === "insufficient_data") {
      dataQualityNotes.push(`${dim.dimension.replace(/_/g, " ")}: ${dim.details}`);
    }
  }

  tradeoffs.push(comparison.overallSummary);

  return {
    summary: comparison.overallSummary,
    topReasons,
    tradeoffs,
    dataQualityNotes,
    verifiedMetrics: {
      placesEvaluated: comparison.placesCount,
      confidence: comparison.confidence,
      timestampIso: now.toISOString(),
    },
  };
}
