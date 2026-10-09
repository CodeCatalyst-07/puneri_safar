import { describe, it, expect } from "vitest";
import {
  buildRouteExplanationFacts,
  buildRankingExplanationFacts,
  buildComparisonExplanationFacts,
} from "@/core/explain";
import { RouteChoiceResult } from "@/core/safety";
import { RankedPlace } from "@/core/ranking";
import { PlaceComparisonResult } from "@/core/comparison";

describe("Core Explain: Structured Verbalization Facts Synthesizer", () => {
  const fixedNow = new Date("2026-10-09T14:00:00Z");

  describe("buildRouteExplanationFacts", () => {
    it("synthesizes factual tradeoff when recommending safer route with detour", () => {
      const routeChoice: RouteChoiceResult = {
        fastest: {
          id: "route-fast",
          distanceMeters: 5000,
          durationSeconds: 600,
          polyline: [{ lat: 18.52, lng: 73.85 }],
        },
        fewestHazards: {
          id: "route-safe",
          distanceMeters: 5500,
          durationSeconds: 720,
          polyline: [{ lat: 18.52, lng: 73.85 }],
        },
        fastestHazardAssessment: {
          hazardIndex: 45,
          breakdown: [
            {
              contributorId: "bs-1",
              name: "Swargate Blackspot",
              type: "blackspot",
              distanceMeters: 40,
              weight: 45,
              source: "Pune Police",
            },
          ],
          confidence: "high",
          caveats: [],
        },
        fewestHazardsAssessment: {
          hazardIndex: 10,
          breakdown: [
            {
              contributorId: "bs-2",
              name: "Katraj Blackspot",
              type: "blackspot",
              distanceMeters: 50,
              weight: 10,
              source: "Pune Police",
            },
          ],
          confidence: "high",
          caveats: ["Monsoon drainage work reported along corridor."],
        },
        tradeoff: {
          minutesAdded: 2,
          hazardPointsAvoided: 35,
          recommendation: "fewest_hazards",
          rationale: "Safer corridor selected: avoids 35 hazard points with 2 min detour.",
        },
      };

      const facts = buildRouteExplanationFacts(routeChoice, fixedNow);

      expect(facts.summary).toBe(routeChoice.tradeoff.rationale);
      expect(facts.topReasons).toContain(
        "Route runs near 1 documented Pune Police accident blackspot(s)."
      );
      expect(facts.topReasons).toEqual(
        expect.arrayContaining([expect.stringContaining("avoids 35 hazard points")])
      );
      expect(facts.tradeoffs).toEqual(
        expect.arrayContaining([expect.stringContaining("Adds approximately 2 minute(s)")])
      );
      expect(facts.dataQualityNotes).toContain("Monsoon drainage work reported along corridor.");
      expect(facts.verifiedMetrics.hazardIndex).toBe(10);
      expect(facts.verifiedMetrics.minutesAdded).toBe(2);
      expect(facts.verifiedMetrics.hazardPointsAvoided).toBe(35);
      expect(facts.verifiedMetrics.timestampIso).toBe(fixedNow.toISOString());
    });

    it("synthesizes explanation when fastest route is already optimal", () => {
      const routeChoice: RouteChoiceResult = {
        fastest: {
          id: "route-fast",
          distanceMeters: 4000,
          durationSeconds: 500,
          polyline: [{ lat: 18.52, lng: 73.85 }],
        },
        fewestHazards: {
          id: "route-fast",
          distanceMeters: 4000,
          durationSeconds: 500,
          polyline: [{ lat: 18.52, lng: 73.85 }],
        },
        fastestHazardAssessment: {
          hazardIndex: 0,
          breakdown: [],
          confidence: "low",
          caveats: ["No recorded hazards is not the same as safe."],
        },
        fewestHazardsAssessment: {
          hazardIndex: 0,
          breakdown: [],
          confidence: "low",
          caveats: ["No recorded hazards is not the same as safe."],
        },
        tradeoff: {
          minutesAdded: 0,
          hazardPointsAvoided: 0,
          recommendation: "fastest",
          rationale: "Fastest route has no known hazard disadvantage over alternatives.",
        },
      };

      const facts = buildRouteExplanationFacts(routeChoice, fixedNow);
      expect(facts.topReasons).toContain("Fastest route has minimal known hazard exposure.");
      expect(facts.tradeoffs).toContain(
        "No significant safety advantage found on alternative detours."
      );
    });
  });

  describe("buildRankingExplanationFacts", () => {
    it("synthesizes ranking explanation with top winner, runner-up comparison, and data quality notes", () => {
      const mockRanked: RankedPlace[] = [
        {
          place: {
            id: "place-1",
            name: "Shaniwar Wada",
            lat: 18.5196,
            lng: 73.8553,
            types: ["historical_landmark"],
          },
          score: 88,
          confidence: "high",
          reasons: ["Highly acclaimed with 4.7/5 rating", "Optimal low budget match"],
          breakdown: [
            {
              criterion: "Rating",
              value: 0.9,
              weight: 0.5,
              confidence: "high",
              reason: "High community ratings",
            },
            {
              criterion: "Accessibility",
              weight: 0,
              confidence: "unknown",
              reason: "Data unavailable",
            },
          ],
        },
        {
          place: {
            id: "place-2",
            name: "Lal Mahal",
            lat: 18.518,
            lng: 73.856,
            types: ["historical_landmark"],
          },
          score: 75,
          confidence: "high",
          reasons: ["Centrally located"],
          breakdown: [],
        },
      ];

      const facts = buildRankingExplanationFacts(mockRanked, fixedNow);

      expect(facts.summary).toContain(
        "Shaniwar Wada is the highest ranked recommendation (88/100)"
      );
      expect(facts.topReasons).toEqual(mockRanked[0].reasons);
      expect(facts.tradeoffs[0]).toContain(
        "Shaniwar Wada leads with score 88/100 over Lal Mahal (75/100)"
      );
      expect(facts.dataQualityNotes[0]).toContain("renormalized without penalty");
      expect(facts.verifiedMetrics.primaryScore).toBe(88);
      expect(facts.verifiedMetrics.placesEvaluated).toBe(2);
    });

    it("handles empty candidate ranking safely", () => {
      const facts = buildRankingExplanationFacts([], fixedNow);
      expect(facts.summary).toBe("No candidate places available for evaluation.");
      expect(facts.verifiedMetrics.placesEvaluated).toBe(0);
      expect(facts.verifiedMetrics.confidence).toBe("unknown");
    });
  });

  describe("buildComparisonExplanationFacts", () => {
    it("synthesizes comparative insights highlighting winning places and data limitations", () => {
      const mockComparison: PlaceComparisonResult = {
        placesCount: 2,
        dimensions: [
          {
            dimension: "rating",
            status: "conclusive",
            bestPlace: {
              placeId: "place-1",
              placeName: "Goodluck Cafe",
              metricLabel: "4.5/5",
              reason: "Highest rating",
            },
            confidence: "high",
            details: "Goodluck leads in ratings",
          },
          {
            dimension: "cleanliness",
            status: "insufficient_data",
            confidence: "unknown",
            details: "Fewer than 2 citizen reports available in the area.",
          },
        ],
        overallSummary: "Compared across 2 criteria with 1 conclusive dimension.",
        confidence: "high",
        timestampIso: fixedNow.toISOString(),
      };

      const facts = buildComparisonExplanationFacts(mockComparison, fixedNow);

      expect(facts.summary).toBe(mockComparison.overallSummary);
      expect(facts.topReasons).toContain("rating: Goodluck Cafe wins (4.5/5).");
      expect(facts.dataQualityNotes).toContain(
        "cleanliness: Fewer than 2 citizen reports available in the area."
      );
      expect(facts.verifiedMetrics.placesEvaluated).toBe(2);
    });

    it("handles tied dimensions in place comparison", () => {
      const tiedComparison: PlaceComparisonResult = {
        placesCount: 2,
        dimensions: [
          {
            dimension: "safety_hazard",
            status: "tied",
            confidence: "high",
            details: "Both places have 0 blackspots nearby.",
          },
        ],
        overallSummary: "All candidates tied on safety.",
        confidence: "high",
        timestampIso: fixedNow.toISOString(),
      };

      const facts = buildComparisonExplanationFacts(tiedComparison, fixedNow);
      expect(facts.topReasons).toHaveLength(0);
      expect(facts.tradeoffs).toContain("All candidates tied on safety.");
    });
  });

  describe("buildRankingExplanationFacts with single place", () => {
    it("handles ranking with single candidate and complete data", () => {
      const singlePlace: RankedPlace[] = [
        {
          place: { id: "p1", name: "Pataleshwar", lat: 18.52, lng: 73.85, types: ["cave"] },
          score: 95,
          confidence: "high",
          reasons: ["Top heritage monument"],
          breakdown: [
            {
              criterion: "Rating",
              value: 1.0,
              weight: 1.0,
              confidence: "high",
              reason: "5-star rating",
            },
          ],
        },
      ];

      const facts = buildRankingExplanationFacts(singlePlace, fixedNow);
      expect(facts.tradeoffs).toHaveLength(0); // No runner-up
      expect(facts.dataQualityNotes).toHaveLength(0); // No unknown criteria
      expect(facts.verifiedMetrics.primaryScore).toBe(95);
    });
  });
});
