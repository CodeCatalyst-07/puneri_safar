/**
 * @file src/core/safety/index.ts
 * Pure known hazard index calculation and route comparison for Pune.
 *
 * PURE BUSINESS LOGIC:
 * - Deterministic: `now: Date` is explicitly injected.
 * - Zero network, zero framework, zero Date.now() / Math.random.
 * - Adheres strictly to the "Known Hazard Index" taxonomy (never "safety score").
 */

import { Blackspot, Report, RouteCandidate, ScoreConfidence, UserContext } from "../types";
import { ContextSignals } from "../signals";
import { pointToPolylineDistanceMeters, haversineMeters } from "../geo";

export const VERIFIED_MATCH_RADIUS_METERS = 150;
export const UNVERIFIED_MATCH_RADIUS_METERS = 300;
export const LOWEST_CRASH_TIER_WEIGHT = 10;

export interface SafetyConfig {
  verifiedMatchRadiusMeters: number;
  unverifiedMatchRadiusMeters: number;
  reportProximityMeters: number;
  reportHalfLifeDays: number;
  reportMaxAgeDays: number;
  heavyRainVulnerableMultiplier: number;
  maxDetourFraction: number; // 0.25 = +25%
  listedOnlyDefaultWeight: number;
}

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  verifiedMatchRadiusMeters: VERIFIED_MATCH_RADIUS_METERS,
  unverifiedMatchRadiusMeters: UNVERIFIED_MATCH_RADIUS_METERS,
  reportProximityMeters: 150,
  reportHalfLifeDays: 7,
  reportMaxAgeDays: 60,
  heavyRainVulnerableMultiplier: 1.5,
  maxDetourFraction: 0.25,
  listedOnlyDefaultWeight: LOWEST_CRASH_TIER_WEIGHT,
};

export interface HazardBreakdownItem {
  contributorId: string;
  name: string;
  type: "blackspot" | "report";
  distanceMeters: number;
  matchRadiusMeters?: number;
  source: string;
  weight: number;
}

export interface RouteHazardAssessment {
  hazardIndex: number; // 0 (no recorded hazards) to 100 (maximum hazard exposure)
  breakdown: HazardBreakdownItem[];
  confidence: ScoreConfidence;
  caveats: string[];
}

export interface RouteChoiceTradeoff {
  minutesAdded: number;
  hazardPointsAvoided: number;
  recommendation: "fastest" | "fewest_hazards";
  rationale: string;
}

export interface RouteChoiceResult {
  fastest: RouteCandidate;
  fewestHazards: RouteCandidate;
  fastestHazardAssessment: RouteHazardAssessment;
  fewestHazardsAssessment: RouteHazardAssessment;
  tradeoff: RouteChoiceTradeoff;
}

/**
 * Calculates crash tier penalty from official crash count and evidence level.
 * 'listed_only' spots and unstated crash counts use the lowest crash-count tier weight (10).
 */
export function getCrashCountTierWeight(
  crashCount?: number | null,
  evidenceLevel?: Blackspot["evidenceLevel"]
): number {
  if (evidenceLevel === "listed_only" || crashCount === null || crashCount === undefined) {
    return LOWEST_CRASH_TIER_WEIGHT;
  }
  if (crashCount >= 30) return 40;
  if (crashCount >= 20) return 30;
  if (crashCount >= 10) return 20;
  return LOWEST_CRASH_TIER_WEIGHT;
}

/**
 * Computes known hazard index (0-100) for a given route polyline.
 */
export function computeRouteHazardIndex(
  route: RouteCandidate,
  blackspots: Blackspot[],
  reports: Report[],
  ctx: UserContext,
  signals: ContextSignals,
  now: Date,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): RouteHazardAssessment {
  const breakdown: HazardBreakdownItem[] = [];
  let rawScore = 0;
  let hasUnverifiedCoordinates = false;

  // 1. Evaluate official blackspots (150m for verified coordinates, 300m for unverified)
  for (const bs of blackspots) {
    const matchRadius = bs.coordinatesVerified
      ? config.verifiedMatchRadiusMeters
      : config.unverifiedMatchRadiusMeters;

    const dist = pointToPolylineDistanceMeters({ lat: bs.lat, lng: bs.lng }, route.polyline);
    if (dist <= matchRadius) {
      if (!bs.coordinatesVerified) {
        hasUnverifiedCoordinates = true;
      }

      const tierWeight = getCrashCountTierWeight(bs.crashCount, bs.evidenceLevel);
      // Proximity scaling within the active match radius buffer
      const proximityFactor = Math.max(0.5, 1 - dist / (matchRadius * 2));
      const weight = Math.round(tierWeight * proximityFactor);

      rawScore += weight;
      breakdown.push({
        contributorId: bs.id,
        name: bs.name,
        type: "blackspot",
        distanceMeters: Math.round(dist),
        matchRadiusMeters: matchRadius,
        source: bs.sourceName,
        weight,
      });
    }
  }

  // 2. Evaluate citizen/municipal hazard reports (ONLY corroborated or official)
  const nowMs = now.getTime();
  for (const r of reports) {
    if (r.status !== "corroborated" && r.status !== "official") {
      continue;
    }

    const reportTimeMs = new Date(r.createdAt).getTime();
    const ageDays = Math.max(0, (nowMs - reportTimeMs) / (1000 * 60 * 60 * 24));

    // Stale reports older than reportMaxAgeDays contribute zero
    if (ageDays > config.reportMaxAgeDays) {
      continue;
    }

    const dist = pointToPolylineDistanceMeters({ lat: r.lat, lng: r.lng }, route.polyline);
    if (dist <= config.reportProximityMeters) {
      // Exponential recency decay: 0.5^(ageDays / halfLifeDays)
      const recencyDecay = Math.pow(0.5, ageDays / config.reportHalfLifeDays);
      const baseWeight = r.severity * 8; // Severity 1=8, 2=16, 3=24
      const weight = Number((baseWeight * recencyDecay).toFixed(1));

      rawScore += weight;
      breakdown.push({
        contributorId: r.id,
        name: `Report: ${r.category.replace(/_/g, " ")}`,
        type: "report",
        distanceMeters: Math.round(dist),
        matchRadiusMeters: config.reportProximityMeters,
        source: `${r.status} report`,
        weight,
      });
    }
  }

  // 3. Environmental multiplier: heavy rain escalates hazard exposure for walking & two-wheelers
  if (signals.heavyRain && (ctx.travelMode === "walk" || ctx.travelMode === "two_wheeler")) {
    rawScore *= config.heavyRainVulnerableMultiplier;
  }

  const hazardIndex = Math.min(100, Math.round(rawScore));

  if (breakdown.length === 0) {
    return {
      hazardIndex: 0,
      breakdown: [],
      confidence: "low",
      caveats: [
        "No recorded hazards is not the same as safe. Official blackspot records and verified citizen reports cover documented corridors only.",
      ],
    };
  }

  const caveats: string[] = [
    `Known hazard index based on ${breakdown.length} verified incident/blackspot record(s) along this route.`,
  ];

  if (hasUnverifiedCoordinates) {
    caveats.push(
      "Includes hazards with approximate location data (evaluated within a 300m radius)."
    );
  }

  return {
    hazardIndex,
    breakdown,
    confidence: "high",
    caveats,
  };
}

/**
 * Compares candidate routes and identifies the tradeoff between fastest transit and minimum hazards.
 */
export function chooseRoutes(
  routes: RouteCandidate[],
  ctx: UserContext,
  signals: ContextSignals,
  blackspots: Blackspot[],
  reports: Report[],
  now: Date,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): RouteChoiceResult {
  if (!routes || routes.length === 0) {
    throw new Error("Cannot choose routes from an empty route candidates list.");
  }

  // 1. Find the fastest route by duration
  let fastest = routes[0];
  for (let i = 1; i < routes.length; i++) {
    if (routes[i].durationSeconds < fastest.durationSeconds) {
      fastest = routes[i];
    }
  }

  // 2. Identify routes within maximum allowable detour (+25% by default)
  const maxDurationAllowed = fastest.durationSeconds * (1 + config.maxDetourFraction);
  const eligibleRoutes = routes.filter((r) => r.durationSeconds <= maxDurationAllowed);

  // 3. Assess hazard index for all eligible routes
  let fewestHazards = fastest;
  let fewestAssessment = computeRouteHazardIndex(
    fastest,
    blackspots,
    reports,
    ctx,
    signals,
    now,
    config
  );
  const fastestAssessment = fewestAssessment;

  for (const candidate of eligibleRoutes) {
    if (candidate.id === fastest.id) continue;

    const assessment = computeRouteHazardIndex(
      candidate,
      blackspots,
      reports,
      ctx,
      signals,
      now,
      config
    );

    if (assessment.hazardIndex < fewestAssessment.hazardIndex) {
      fewestHazards = candidate;
      fewestAssessment = assessment;
    }
  }

  const durationDelta = fewestHazards.durationSeconds - fastest.durationSeconds;
  const minutesAdded = Math.max(0, Math.round(durationDelta / 60));
  const hazardPointsAvoided = Math.max(
    0,
    fastestAssessment.hazardIndex - fewestAssessment.hazardIndex
  );

  let recommendation: "fastest" | "fewest_hazards" = "fastest";
  let rationale = "Fastest route has equivalent or lower known hazard exposure.";

  if (hazardPointsAvoided > 0) {
    recommendation = "fewest_hazards";
    rationale = `Taking the safer corridor adds ${minutesAdded} minute(s) but reduces known hazard index by ${hazardPointsAvoided} point(s).`;
  }

  return {
    fastest,
    fewestHazards,
    fastestHazardAssessment: fastestAssessment,
    fewestHazardsAssessment: fewestAssessment,
    tradeoff: {
      minutesAdded,
      hazardPointsAvoided,
      recommendation,
      rationale,
    },
  };
}

export interface ClassifiedReportInfo {
  category: "road_hazard" | "waterlogging" | "poor_lighting" | "cleanliness" | "crowd" | "other";
  severity: 1 | 2 | 3;
  confidence: number;
  summary: string;
}

/**
 * Deterministic keyword-based fallback classifier for citizen reports.
 */
export function classifyReportKeyword(text: string): ClassifiedReportInfo {
  const normalized = (text || "").toLowerCase();

  let category: ClassifiedReportInfo["category"] = "other";
  let confidence = 0.5;

  if (
    /(waterlog|water\s*logging|flood|drainage|submerged|water\s*overflow|deep\s*puddle)/.test(
      normalized
    )
  ) {
    category = "waterlogging";
    confidence = 0.85;
  } else if (
    /(pothole|road\s*work|crack|crater|accident|speed\s*breaker|broken\s*road|debris)/.test(
      normalized
    )
  ) {
    category = "road_hazard";
    confidence = 0.85;
  } else if (/(streetlight|light|unlit|dark|no\s*light|broken\s*bulb|darkness)/.test(normalized)) {
    category = "poor_lighting";
    confidence = 0.85;
  } else if (/(garbage|trash|waste|dump|litter|filth|cleanliness|smell|stench)/.test(normalized)) {
    category = "cleanliness";
    confidence = 0.85;
  } else if (/(crowd|jam|traffic|chokepoint|congestion|stampede|gridlock)/.test(normalized)) {
    category = "crowd";
    confidence = 0.85;
  }

  let severity: 1 | 2 | 3 = 1;
  if (
    /(emergency|fatal|danger|severe|huge|massive|deep crater|major|completely)/.test(normalized)
  ) {
    severity = 3;
  } else if (
    /(moderate|medium|slow|growing|bad)/.test(normalized) ||
    category === "waterlogging" ||
    category === "road_hazard"
  ) {
    severity = 2;
  }

  const summary = text.length > 80 ? `${text.slice(0, 77)}...` : text;

  return {
    category,
    severity,
    confidence,
    summary: summary || "Citizen hazard report",
  };
}

/**
 * Evaluates whether a report has reached 'corroborated' status.
 * A report becomes corroborated when 2 or more reports of the same category
 * exist within 200m in the last 48 hours.
 */
export function evaluateCorroboration(
  report: {
    id?: string;
    category: string;
    lat: number;
    lng: number;
    createdAt: string;
    reporterHash?: string;
  },
  existingReports: Array<Report & { reporterHash?: string }>,
  now: Date,
  windowHours = 48,
  radiusMeters = 200,
  minThreshold = 2
): boolean {
  const windowMs = windowHours * 60 * 60 * 1000;
  const nowMs = now.getTime();

  const matching = existingReports.filter((r) => {
    if (r.category !== report.category) return false;
    const rTime = new Date(r.createdAt).getTime();
    const ageMs = nowMs - rTime;
    if (ageMs < 0 || ageMs > windowMs) return false;
    const dist = haversineMeters({ lat: report.lat, lng: report.lng }, { lat: r.lat, lng: r.lng });
    return dist <= radiusMeters;
  });

  // Distinct reporter corroboration check
  const hasHashes = Boolean(report.reporterHash || matching.some((r) => Boolean(r.reporterHash)));

  if (hasHashes) {
    const distinctReporters = new Set<string>();
    if (report.reporterHash) {
      distinctReporters.add(report.reporterHash);
    }
    for (const m of matching) {
      if (m.reporterHash) {
        distinctReporters.add(m.reporterHash);
      }
    }
    return distinctReporters.size >= minThreshold;
  }

  const containsTarget = report.id && matching.some((m) => m.id === report.id);
  const totalCount = containsTarget ? matching.length : matching.length + 1;

  return totalCount >= minThreshold;
}
