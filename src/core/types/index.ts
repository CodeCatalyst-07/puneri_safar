/**
 * @file src/core/types/index.ts
 * Domain models, Zod validation schemas, and inferred TypeScript types for Puneri Safar.
 *
 * PURE DOMAIN TYPES:
 * - No framework or external network dependencies.
 * - Strict schema validation with Zod.
 */

import { z } from "zod";

/**
 * Standard confidence rating for all scoring and evaluation outputs.
 */
export const scoreConfidenceSchema = z.enum(["high", "low", "unknown"]);
export type ScoreConfidence = z.infer<typeof scoreConfidenceSchema>;

/**
 * Geographical coordinate pair.
 */
export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLngSchema>;

/**
 * User contextual input driving routing, place ranking, and safety evaluation.
 */
export const userContextSchema = z.object({
  location: latLngSchema,
  travelMode: z.enum(["walk", "two_wheeler", "car", "transit"]),
  budget: z.enum(["low", "medium", "high"]),
  maxPriceLevel: z.number().int().min(0).max(4).optional(),
  safetyPreference: z.enum(["relaxed", "balanced", "cautious"]),
  accessibilityNeeds: z.boolean(),
  accessibilityFlags: z
    .object({
      wheelchair: z.boolean().optional(),
      stepFree: z.boolean().optional(),
      visualAid: z.boolean().optional(),
    })
    .optional(),
  language: z.enum(["en", "hi", "mr"]).default("en"),
});
export type UserContext = z.infer<typeof userContextSchema>;

/**
 * Real-time meteorological snapshot injected into pure domain logic.
 */
export const weatherSnapshotSchema = z.object({
  tempC: z.number(),
  precipitationMm: z.number().nonnegative(),
  conditionCode: z.string(),
  alerts: z.array(
    z.object({
      type: z.string(),
      severity: z.enum(["advisory", "warning", "emergency"]),
    })
  ),
});
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;

/**
 * Candidate destination for ranking or comparison.
 */
export const placeAccessibilitySchema = z.object({
  wheelchairEntrance: z.boolean().optional(),
  wheelchairRestroom: z.boolean().optional(),
  wheelchairSeating: z.boolean().optional(),
  wheelchairParking: z.boolean().optional(),
});
export type PlaceAccessibility = z.infer<typeof placeAccessibilitySchema>;

export const placeCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  types: z.array(z.string()),
  rating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().nonnegative().optional(),
  priceLevel: z.number().int().min(0).max(4).optional(),
  accessibility: placeAccessibilitySchema.optional(),
  openNow: z.boolean().optional(),
  isIndoor: z.boolean().optional(),
  distanceMeters: z.number().nonnegative().optional(),
});
export type PlaceCandidate = z.infer<typeof placeCandidateSchema>;

/**
 * Citizen or official ground report.
 */
export const reportCategorySchema = z.enum([
  "road_hazard",
  "waterlogging",
  "poor_lighting",
  "cleanliness",
  "crowd",
  "other",
]);
export type ReportCategory = z.infer<typeof reportCategorySchema>;

export const reportStatusSchema = z.enum(["unverified", "corroborated", "official"]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportSchema = z.object({
  id: z.string(),
  category: reportCategorySchema,
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lat: z.number(),
  lng: z.number(),
  createdAt: z.string().datetime(),
  status: reportStatusSchema,
  confidence: z.number().min(0).max(1),
});
export type Report = z.infer<typeof reportSchema>;

/**
 * Blackspot evidence classification and coordinate provenance.
 */
export const blackspotEvidenceLevelSchema = z.enum(["counted", "listed_only"]);
export type BlackspotEvidenceLevel = z.infer<typeof blackspotEvidenceLevelSchema>;

export const coordinateSourceSchema = z.enum(["geocoded_osm", "wikidata", "estimated"]);
export type CoordinateSource = z.infer<typeof coordinateSourceSchema>;

/**
 * Blackspot entity matching official municipal road safety records.
 */
export const blackspotSchema = z.object({
  id: z.string(),
  name: z.string(),
  neighborhood: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  crashCount: z.number().int().nonnegative().nullable().optional(),
  period: z.string().nullable().optional(),
  evidenceLevel: blackspotEvidenceLevelSchema.default("counted").optional(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  sourceNote: z.string(),
  coordinateSource: coordinateSourceSchema.default("geocoded_osm").optional(),
  coordinatesVerified: z.boolean(),
  severity: z.number().int().min(1).max(5).optional(),
  hazardFactors: z.array(z.string()).optional(),
});
export type Blackspot = z.infer<typeof blackspotSchema>;

/**
 * Candidate route for safety and travel comparison.
 */
export const routeCandidateSchema = z.object({
  id: z.string(),
  durationSeconds: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative(),
  polyline: z.array(latLngSchema).min(1),
});
export type RouteCandidate = z.infer<typeof routeCandidateSchema>;
