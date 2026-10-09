/**
 * @file src/core/intent/index.ts
 * Deterministic rules-first user intent classifier and parameter extractor.
 *
 * PURE BUSINESS LOGIC:
 * - Zero LLM dependencies: fast, predictable, and 100% testable.
 * - Multi-language config map (English defaults, prepared for Hindi/Marathi).
 * - Resilient against prompt injection / adversarial strings.
 */

import { ScoreConfidence } from "../types";

export type UserIntent =
  | "find_food"
  | "find_stay"
  | "find_attraction"
  | "heritage_info"
  | "route_hazards"
  | "weather_now"
  | "report_issue"
  | "compare_places"
  | "unknown";

export interface ExtractedParams {
  budget?: "low" | "medium" | "high";
  maxPriceNumber?: number;
  accessibility?: boolean;
  timePreference?: "now" | "tonight" | "tomorrow" | "weekend";
  origin?: string;
  destination?: string;
}

export interface IntentClassificationResult {
  intent: UserIntent;
  confidence: ScoreConfidence;
  params: ExtractedParams;
  matchedKeywords: string[];
  reason: string;
}

export interface IntentKeywordMap {
  intents: Record<UserIntent, string[]>;
  budgetKeywords: {
    low: string[];
    medium: string[];
    high: string[];
  };
  accessibilityKeywords: string[];
  timeKeywords: Record<"now" | "tonight" | "tomorrow" | "weekend", string[]>;
  adversarialPatterns: RegExp[];
}

export const ENGLISH_KEYWORD_CONFIG: IntentKeywordMap = {
  intents: {
    find_food: [
      "food",
      "restaurant",
      "cafe",
      "coffee",
      "dinner",
      "lunch",
      "breakfast",
      "misal",
      "snack",
      "eat",
      "dining",
      "bakery",
      "biryani",
      "chaat",
    ],
    find_stay: [
      "hotel",
      "stay",
      "hostel",
      "resort",
      "lodge",
      "room",
      "accommodation",
      "homestay",
      "bnb",
    ],
    find_attraction: [
      "attraction",
      "sightseeing",
      "places to see",
      "explore",
      "visit",
      "park",
      "garden",
      "museum",
      "viewpoint",
      "trek",
      "fort",
    ],
    heritage_info: [
      "heritage",
      "history",
      "historical",
      "wada",
      "peshwa",
      "maratha",
      "monument",
      "shaniwar wada",
      "pataleshwar",
      "aga khan",
      "lal mahal",
      "ancient",
      "temple",
    ],
    route_hazards: [
      "hazard",
      "route hazard",
      "blackspot",
      "pothole",
      "accident",
      "dangerous road",
      "safe route",
      "waterlogging",
      "chokepoint",
      "avoid",
    ],
    weather_now: [
      "weather",
      "rain",
      "raining",
      "temperature",
      "monsoon",
      "downpour",
      "forecast",
      "cloudy",
      "heat",
      "climate",
    ],
    report_issue: [
      "report",
      "file report",
      "submit hazard",
      "broken light",
      "waterlogged street",
      "complain",
      "new pothole",
    ],
    compare_places: [
      "compare",
      "vs",
      "versus",
      "which is better",
      "best vs worst",
      "difference between",
      "better option",
    ],
    unknown: [],
  },
  budgetKeywords: {
    low: ["cheap", "budget", "affordable", "pocket-friendly", "low cost", "inexpensive"],
    medium: ["mid-range", "moderate", "medium budget", "decent"],
    high: ["luxury", "fine dining", "expensive", "premium", "high end", "upscale"],
  },
  accessibilityKeywords: [
    "wheelchair",
    "accessible",
    "handicap",
    "step-free",
    "ramp",
    "mobility",
    "disabled",
  ],
  timeKeywords: {
    now: ["now", "right now", "currently", "immediate"],
    tonight: ["tonight", "this evening", "night"],
    tomorrow: ["tomorrow", "next morning"],
    weekend: ["weekend", "saturday", "sunday"],
  },
  adversarialPatterns: [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /system\s*prompt/i,
    /you\s+are\s+now\s+in\s+dan\s+mode/i,
    /<script.*?>.*?<\/script>/i,
    /drop\s+table/i,
  ],
};

/**
 * Deterministically classifies user text intent and extracts simple constraints.
 */
export function classifyIntent(
  text: string,
  config: IntentKeywordMap = ENGLISH_KEYWORD_CONFIG
): IntentClassificationResult {
  const normalized = (text || "").trim().toLowerCase();

  // 1. Guard against prompt injection or empty inputs
  if (!normalized) {
    return {
      intent: "unknown",
      confidence: "unknown",
      params: {},
      matchedKeywords: [],
      reason: "Input text is empty.",
    };
  }

  for (const pattern of config.adversarialPatterns) {
    if (pattern.test(normalized)) {
      return {
        intent: "unknown",
        confidence: "unknown",
        params: {},
        matchedKeywords: [],
        reason: "Input matched adversarial prompt pattern; quarantined safely.",
      };
    }
  }

  // 2. Deterministic route rule: "(safer|safe|fewer hazards) (way|route) from X to Y" / "route from X to Y"
  const routeMatch = normalized.match(
    /(?:(?:(?:show\s+(?:me\s+)?(?:a\s+)?)?(?:safer|safe|fewer\s+hazards|fewest\s+hazards|best|quickest)?\s*(?:way|route|path|directions)\s+from)|(?:how\s+(?:can|do)\s+(?:i|we)\s+(?:go|get)\s+from)|from)\s+([a-z0-9\s'-]+?)\s+(?:to|towards)\s+([a-z0-9\s'-]+)/i
  );

  if (routeMatch && routeMatch[1] && routeMatch[2]) {
    const rawOrigin = routeMatch[1].replace(/^(?:the\s+)/i, "").trim();
    const rawDest = routeMatch[2]
      .replace(/\s+(?:please|now|today|tonight)$/i, "")
      .replace(/[?.!,;]+$/, "")
      .trim();

    if (rawOrigin.length >= 2 && rawDest.length >= 2) {
      return {
        intent: "route_hazards",
        confidence: "high",
        params: {
          origin: rawOrigin,
          destination: rawDest,
        },
        matchedKeywords: ["route", "from", "to"],
        reason: `Deterministic route request extracted from "${rawOrigin}" to "${rawDest}".`,
      };
    }
  }

  // 3. Score each intent category by keyword matching
  const intentScores: Array<{ intent: UserIntent; count: number; matches: string[] }> = [];

  for (const [intentKey, keywords] of Object.entries(config.intents)) {
    if (intentKey === "unknown") continue;

    const matches: string[] = [];
    for (const kw of keywords) {
      // Word boundary match
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(normalized)) {
        matches.push(kw);
      }
    }

    if (matches.length > 0) {
      intentScores.push({
        intent: intentKey as UserIntent,
        count: matches.length,
        matches,
      });
    }
  }

  // Sort matched intents by score descending
  intentScores.sort((a, b) => b.count - a.count);

  let selectedIntent: UserIntent = "unknown";
  let confidence: ScoreConfidence = "unknown";
  let matchedKeywords: string[] = [];
  let reason = "No confident keyword match; fallback to LLM agent recommended.";

  if (intentScores.length > 0) {
    const top = intentScores[0];
    selectedIntent = top.intent;
    matchedKeywords = top.matches;

    // High confidence if clear winner (>= 1 unique matches and no tie with second)
    if (intentScores.length === 1 || top.count > intentScores[1].count) {
      confidence = "high";
      reason = `Classified as ${selectedIntent} based on matching: [${matchedKeywords.join(", ")}].`;
    } else {
      confidence = "low";
      reason = `Ambiguous intent match between ${top.intent} and ${intentScores[1].intent}.`;
    }
  }

  // 3. Extract simple parameters: budget, accessibility, time
  const params: ExtractedParams = {};

  // Budget
  for (const kw of config.budgetKeywords.low) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(normalized)) {
      params.budget = "low";
      break;
    }
  }
  if (!params.budget) {
    for (const kw of config.budgetKeywords.high) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(normalized)) {
        params.budget = "high";
        break;
      }
    }
  }
  if (!params.budget) {
    for (const kw of config.budgetKeywords.medium) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(normalized)) {
        params.budget = "medium";
        break;
      }
    }
  }

  // Numerical price constraint ("under 500", "below 1000")
  const underPriceMatch = normalized.match(/(?:under|below|less\s+than)\s+(\d+)/i);
  if (underPriceMatch && underPriceMatch[1]) {
    params.maxPriceNumber = parseInt(underPriceMatch[1], 10);
  }

  // Accessibility
  for (const kw of config.accessibilityKeywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(normalized)) {
      params.accessibility = true;
      break;
    }
  }

  // Time preference
  for (const [timeKey, timeWords] of Object.entries(config.timeKeywords)) {
    for (const tw of timeWords) {
      if (new RegExp(`\\b${tw}\\b`, "i").test(normalized)) {
        params.timePreference = timeKey as ExtractedParams["timePreference"];
        break;
      }
    }
    if (params.timePreference) break;
  }

  return {
    intent: selectedIntent,
    confidence,
    params,
    matchedKeywords,
    reason,
  };
}
