import { describe, it, expect } from "vitest";
import {
  staticBlackspots,
  staticHeritageSites,
  validateDatasets,
  blackspotDataSchema,
} from "@/data";

describe("Dataset Integrity & Honesty Audit", () => {
  it("successfully passes runtime Zod dataset validation for loaded datasets", () => {
    const { blackspots, heritageSites } = validateDatasets();
    expect(blackspots.length).toBeGreaterThan(0);
    expect(heritageSites.length).toBeGreaterThan(0);
  });

  it("ensures all blackspots adhere to data honesty requirements", () => {
    const ids = new Set<string>();

    for (const spot of staticBlackspots) {
      // Unique ID check
      expect(ids.has(spot.id)).toBe(false);
      ids.add(spot.id);

      // Pune geographic boundary check [18.2 - 18.8 Lat, 73.6 - 74.2 Lng]
      expect(spot.lat).toBeGreaterThanOrEqual(18.2);
      expect(spot.lat).toBeLessThanOrEqual(18.8);
      expect(spot.lng).toBeGreaterThanOrEqual(73.6);
      expect(spot.lng).toBeLessThanOrEqual(74.2);

      // Non-empty official source attribution
      expect(spot.sourceName.trim().length).toBeGreaterThan(0);
      expect(spot.sourceUrl.trim().length).toBeGreaterThan(0);
      expect(spot.sourceNote.trim().length).toBeGreaterThan(0);

      // Counted spots must have crashCount and period
      if (spot.evidenceLevel === "counted") {
        expect(spot.crashCount).not.toBeNull();
        expect(spot.crashCount).toBeDefined();
        expect(spot.period).not.toBeNull();
        expect(spot.period).toBeDefined();
        expect(spot.period!.trim().length).toBeGreaterThan(0);
      }

      // Listed-only spots must not have a crashCount
      if (spot.evidenceLevel === "listed_only") {
        expect(spot.crashCount).toBeNull();
      }

      // Verified coordinates require a sourceUrl
      if (spot.coordinatesVerified) {
        expect(spot.sourceUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  it("fails schema validation if evidenceLevel 'counted' lacks crashCount or period", () => {
    const missingCrashCount = {
      id: "bs-test-counted-1",
      name: "Test Spot",
      lat: 18.5,
      lng: 73.8,
      evidenceLevel: "counted",
      crashCount: null,
      period: "2022-2024",
      sourceName: "Source",
      sourceUrl: "https://example.com",
      sourceNote: "Note",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
    };
    expect(() => blackspotDataSchema.parse(missingCrashCount)).toThrow();

    const missingPeriod = {
      ...missingCrashCount,
      crashCount: 10,
      period: null,
    };
    expect(() => blackspotDataSchema.parse(missingPeriod)).toThrow();
  });

  it("fails schema validation if evidenceLevel 'listed_only' has a crashCount", () => {
    const invalidListed = {
      id: "bs-test-listed-1",
      name: "Test Spot",
      lat: 18.5,
      lng: 73.8,
      evidenceLevel: "listed_only",
      crashCount: 12,
      period: "2021",
      sourceName: "Source",
      sourceUrl: "https://example.com",
      sourceNote: "Note",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
    };
    expect(() => blackspotDataSchema.parse(invalidListed)).toThrow();
  });

  it("fails schema validation if coordinatesVerified=true without a sourceUrl", () => {
    const verifiedNoUrl = {
      id: "bs-test-verified-1",
      name: "Test Spot",
      lat: 18.5,
      lng: 73.8,
      evidenceLevel: "counted",
      crashCount: 10,
      period: "2022-2024",
      sourceName: "Source",
      sourceUrl: "",
      sourceNote: "Note",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: true,
    };
    expect(() => blackspotDataSchema.parse(verifiedNoUrl)).toThrow();
  });

  it("fails schema validation if any sourceNote is empty", () => {
    const emptyNote = {
      id: "bs-test-empty-note",
      name: "Test Spot",
      lat: 18.5,
      lng: 73.8,
      evidenceLevel: "counted",
      crashCount: 10,
      period: "2022-2024",
      sourceName: "Source",
      sourceUrl: "https://example.com",
      sourceNote: "",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
    };
    expect(() => blackspotDataSchema.parse(emptyNote)).toThrow();
  });

  it("fails schema validation if coordinates are outside Pune boundaries", () => {
    const outOfBounds = {
      id: "bs-test-oob",
      name: "Test Spot",
      lat: 19.5, // Outside Pune
      lng: 73.8,
      evidenceLevel: "counted",
      crashCount: 10,
      period: "2022-2024",
      sourceName: "Source",
      sourceUrl: "https://example.com",
      sourceNote: "Note",
      coordinateSource: "geocoded_osm",
      coordinatesVerified: false,
    };
    expect(() => blackspotDataSchema.parse(outOfBounds)).toThrow();
  });

  it("ensures all heritage sites have unique IDs and coordinates within Pune boundaries", () => {
    const ids = new Set<string>();

    for (const site of staticHeritageSites) {
      expect(ids.has(site.id)).toBe(false);
      ids.add(site.id);

      expect(site.lat).toBeGreaterThanOrEqual(18.2);
      expect(site.lat).toBeLessThanOrEqual(18.8);
      expect(site.lng).toBeGreaterThanOrEqual(73.6);
      expect(site.lng).toBeLessThanOrEqual(74.2);

      expect(site.sourceName.trim().length).toBeGreaterThan(0);
      expect(site.sourceUrl.trim().length).toBeGreaterThan(0);
      expect(site.sourceNote.trim().length).toBeGreaterThan(0);

      // Verify no claim of ASI survey records verification
      expect(site.sourceNote).not.toContain("ASI survey records");
      expect(site.coordinatesVerified).toBe(false);
      expect(site.coordinateSource).toBe("wikidata");
    }
  });
});
