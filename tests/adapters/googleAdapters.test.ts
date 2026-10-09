/**
 * @file tests/adapters/googleAdapters.test.ts
 * Unit tests with mocked fetch for Google Places, Routes, and Weather adapters.
 * Covers: success, empty, malformed, 429, timeout, and demo key limitations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { searchPlaces } from "@/adapters/places/googlePlaces";
import { computeRoutes } from "@/adapters/routes/googleRoutes";
import { getWeather } from "@/adapters/weather/googleWeather";
import { clearGoogleFetchCache } from "@/lib/googleFetch";

describe("Google Adapters (Places, Routes, Weather) Offline Unit Tests", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearGoogleFetchCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // --- PLACES ADAPTER ---
  describe("Places API (New) Adapter", () => {
    const validPlacesJson = {
      places: [
        {
          id: "place-shaniwar-wada",
          displayName: { text: "Shaniwar Wada", languageCode: "en" },
          location: { latitude: 18.5196, longitude: 73.8553 },
          types: ["historical_landmark", "tourist_attraction"],
          rating: 4.5,
          userRatingCount: 42000,
          priceLevel: "PRICE_LEVEL_MODERATE",
          accessibilityOptions: {
            wheelchairAccessibleEntrance: true,
            wheelchairAccessibleRestroom: false,
          },
          currentOpeningHours: { openNow: true },
          formattedAddress: "Shaniwar Peth, Pune",
        },
      ],
    };

    it("parses successful Places response into PlaceCandidate with derived attributes", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validPlacesJson,
      });

      const res = await searchPlaces("Shaniwar Wada", { lat: 18.52, lng: 73.85 }, 5000, "mock-key");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(1);
        const p = res.data[0];
        expect(p.name).toBe("Shaniwar Wada");
        expect(p.priceLevel).toBe(2); // MODERATE mapped to 2
        expect(p.isIndoor).toBe(false); // tourist_attraction derived as outdoor
        expect(p.openNow).toBe(true);
        expect(p.accessibility?.wheelchairEntrance).toBe(true);
        expect(p.distanceMeters).toBeGreaterThan(0);
      }
    });

    it("handles empty places response gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ places: [] }),
      });

      const res = await searchPlaces("Nonexistent Landmark 12345", undefined, 5000, "mock-key");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual([]);
      }
    });

    it("handles malformed JSON structure with typed error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ places: "invalid_not_an_array" }),
      });

      const res = await searchPlaces("Shaniwar Wada", undefined, 5000, "mock-key");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("malformed_response");
      }
    });

    it("handles 429 quota exhaustion gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Quota exceeded",
      });

      const res = await searchPlaces("Shaniwar Wada", undefined, 5000, "mock-key");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("rate_limited");
      }
    });

    it("handles timeout AbortError gracefully", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const res = await searchPlaces("Shaniwar Wada", undefined, 5000, "mock-key");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("timeout");
      }
    });

    it("surfaces clear reason when Demo Key limitation is hit", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Demo API key cannot access Places (New) API without billing",
      });

      const res = await searchPlaces("Shaniwar Wada", undefined, 5000, "mock-key");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("feature unavailable with current key");
      }
    });
  });

  // --- ROUTES ADAPTER ---
  describe("Routes API Adapter", () => {
    const validRoutesJson = {
      routes: [
        {
          duration: "450s",
          distanceMeters: 4200,
          polyline: {
            encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
          },
        },
      ],
    };

    it("parses successful Routes response into RouteCandidate with decoded polylines", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validRoutesJson,
      });

      const res = await computeRoutes(
        { lat: 18.5204, lng: 73.8567 },
        { lat: 18.5304, lng: 73.8467 },
        "two_wheeler",
        "mock-key"
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(1);
        const r = res.data[0];
        expect(r.durationSeconds).toBe(450);
        expect(r.distanceMeters).toBe(4200);
        expect(r.polyline.length).toBe(3);
        expect(r.polyline[0].lat).toBeCloseTo(38.5, 4);
      }
    });

    it("handles empty routes array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ routes: [] }),
      });

      const res = await computeRoutes(
        { lat: 18.52, lng: 73.85 },
        { lat: 18.53, lng: 73.84 },
        "car",
        "mock-key"
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual([]);
      }
    });

    it("handles malformed Routes response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ routes: "not-an-array" }),
      });

      const res = await computeRoutes(
        { lat: 18.52, lng: 73.85 },
        { lat: 18.53, lng: 73.84 },
        "car",
        "mock-key"
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("malformed_response");
      }
    });

    it("handles 429 rate limit on Routes", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Rate Limit Exceeded",
        text: async () => "Quota exhausted",
      });

      const res = await computeRoutes(
        { lat: 18.52, lng: 73.85 },
        { lat: 18.53, lng: 73.84 },
        "car",
        "mock-key"
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("rate_limited");
      }
    });

    it("handles timeout on Routes", async () => {
      const abortError = new Error("Abort");
      abortError.name = "AbortError";
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const res = await computeRoutes(
        { lat: 18.52, lng: 73.85 },
        { lat: 18.53, lng: 73.84 },
        "car",
        "mock-key"
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("timeout");
      }
    });
  });

  // --- WEATHER ADAPTER ---
  describe("Weather API Adapter", () => {
    const validWeatherJson = {
      temperature: { degrees: 31.5 },
      precipitation: { qpf: { quantity: 4.2 } },
      weatherCondition: { type: "RAIN" },
    };

    it("parses successful Weather conditions and empty alerts", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("currentConditions")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => validWeatherJson,
          });
        }
        // alerts endpoint returns 404 (common when unsupported/no alerts)
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: async () => "No alerts active",
        });
      });

      const res = await getWeather(18.5204, 73.8567, "mock-key");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.tempC).toBe(31.5);
        expect(res.data.precipitationMm).toBe(4.2);
        expect(res.data.conditionCode).toBe("rain");
        expect(res.data.alerts).toEqual([]);
      }
    });

    it("parses public monsoon alerts when returned", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("currentConditions")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => validWeatherJson,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            publicAlerts: [
              {
                alertType: "IMD Orange Alert",
                severity: "warning",
                headline: "Heavy Monsoon Rain Warning",
              },
            ],
          }),
        });
      });

      const res = await getWeather(18.5204, 73.8567, "mock-key");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.alerts).toHaveLength(1);
        expect(res.data.alerts[0].severity).toBe("warning");
      }
    });

    it("handles 429 quota limit on Weather", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Rate limit",
      });

      const res = await getWeather(18.5204, 73.8567, "mock-key");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("rate_limited");
      }
    });

    it("handles malformed response on Weather", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ temperature: "not_an_object" }),
      });

      const res = await getWeather(18.5204, 73.8567, "mock-key");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("malformed_response");
      }
    });
  });
});
