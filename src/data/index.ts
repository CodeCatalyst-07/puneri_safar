/**
 * @file src/data/index.ts
 * Strongly-typed accessors and runtime Zod validation for official Pune datasets.
 */

import { z } from "zod";
import rawBlackspots from "./blackspots.json";
import rawHeritage from "./heritage.json";

/**
 * Zod schema for validated accident blackspots.
 */
export const blackspotDataSchema = z
  .object({
    id: z.string().regex(/^bs-[a-z0-9-]+$/, "ID must follow bs-kebab-case"),
    name: z.string().min(3),
    neighborhood: z.string().optional(),
    lat: z.number().min(18.2).max(18.8),
    lng: z.number().min(73.6).max(74.2),
    crashCount: z.number().int().nonnegative().nullable().optional(),
    period: z.string().min(4).nullable().optional(),
    evidenceLevel: z.enum(["counted", "listed_only"]),
    sourceName: z.string().min(2),
    sourceUrl: z.string().url(),
    sourceNote: z.string().min(1),
    coordinateSource: z.enum(["geocoded_osm", "wikidata", "estimated"]),
    coordinatesVerified: z.boolean(),
    severity: z.number().int().min(1).max(5).optional(),
    hazardFactors: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.evidenceLevel === "counted") {
      if (data.crashCount === null || data.crashCount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Counted blackspot must have crashCount",
          path: ["crashCount"],
        });
      }
      if (!data.period || data.period.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Counted blackspot must have period",
          path: ["period"],
        });
      }
    }
    if (data.evidenceLevel === "listed_only") {
      if (data.crashCount !== null && data.crashCount !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Listed-only blackspot must not have crashCount",
          path: ["crashCount"],
        });
      }
    }
    if (data.coordinatesVerified && (!data.sourceUrl || data.sourceUrl.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Verified coordinates require a sourceUrl",
        path: ["sourceUrl"],
      });
    }
    if (!data.sourceNote || data.sourceNote.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source note must not be empty",
        path: ["sourceNote"],
      });
    }
  });

/**
 * Zod schema for validated heritage landmarks.
 */
export const heritageDataSchema = z
  .object({
    id: z.string().regex(/^heritage-[a-z0-9-]+$/, "ID must follow heritage-kebab-case"),
    name: z.string().min(3),
    neighborhood: z.string(),
    lat: z.number().min(18.2).max(18.8),
    lng: z.number().min(73.6).max(74.2),
    era: z.string(),
    yearEstablished: z.string(),
    architecturalStyle: z.string(),
    significance: z.string(),
    accessibility: z.object({
      wheelchairAccessible: z.boolean(),
      restroomsAvailable: z.boolean(),
      audioGuideAvailable: z.boolean().optional(),
    }),
    visitingHours: z.string(),
    entryFeeInr: z.number().nonnegative(),
    sourceName: z.string().min(2),
    sourceUrl: z.string().url(),
    sourceNote: z.string().min(1),
    coordinateSource: z.enum(["geocoded_osm", "wikidata", "estimated"]),
    coordinatesVerified: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.coordinatesVerified && (!data.sourceUrl || data.sourceUrl.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Verified coordinates require a sourceUrl",
        path: ["sourceUrl"],
      });
    }
    if (!data.sourceNote || data.sourceNote.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Source note must not be empty",
        path: ["sourceNote"],
      });
    }
  });

export type StaticBlackspot = z.infer<typeof blackspotDataSchema>;
export type StaticHeritageSite = z.infer<typeof heritageDataSchema>;

/**
 * Validates dataset at load time, failing fast if integrity is compromised.
 */
export function validateDatasets(): {
  blackspots: StaticBlackspot[];
  heritageSites: StaticHeritageSite[];
} {
  const parsedBlackspots = z.array(blackspotDataSchema).parse(rawBlackspots);
  const parsedHeritage = z.array(heritageDataSchema).parse(rawHeritage);

  // Validate ID uniqueness and boundary compliance for blackspots
  const blackspotIds = new Set<string>();
  for (const b of parsedBlackspots) {
    if (blackspotIds.has(b.id)) {
      throw new Error(`Duplicate blackspot ID detected: ${b.id}`);
    }
    blackspotIds.add(b.id);

    if (b.lat < 18.2 || b.lat > 18.8 || b.lng < 73.6 || b.lng > 74.2) {
      throw new Error(`Blackspot ${b.id} coordinate outside Pune boundaries`);
    }
  }

  // Validate ID uniqueness and boundary compliance for heritage sites
  const heritageIds = new Set<string>();
  for (const h of parsedHeritage) {
    if (heritageIds.has(h.id)) {
      throw new Error(`Duplicate heritage ID detected: ${h.id}`);
    }
    heritageIds.add(h.id);

    if (h.lat < 18.2 || h.lat > 18.8 || h.lng < 73.6 || h.lng > 74.2) {
      throw new Error(`Heritage site ${h.id} coordinate outside Pune boundaries`);
    }
  }

  return {
    blackspots: parsedBlackspots,
    heritageSites: parsedHeritage,
  };
}

const validated = validateDatasets();

export const staticBlackspots: StaticBlackspot[] = validated.blackspots;
export const staticHeritageSites: StaticHeritageSite[] = validated.heritageSites;
