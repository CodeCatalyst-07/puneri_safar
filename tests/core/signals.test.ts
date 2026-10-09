import { describe, it, expect } from "vitest";
import { deriveContextSignals, getKolkataMinutesOfDay } from "@/core/signals";
import { UserContext, WeatherSnapshot } from "@/core/types";

describe("Core Signals: deriveContextSignals", () => {
  const dummyCtx: UserContext = {
    location: { lat: 18.5204, lng: 73.8567 },
    travelMode: "two_wheeler",
    budget: "medium",
    safetyPreference: "balanced",
    accessibilityNeeds: false,
    language: "en",
  };

  const clearWeather: WeatherSnapshot = {
    tempC: 28,
    precipitationMm: 0,
    conditionCode: "clear",
    alerts: [],
  };

  it("extracts exact Kolkata minutes regardless of system host timezone", () => {
    // 12:00 UTC = 17:30 IST = 17 * 60 + 30 = 1050 minutes
    const dateUtcNoon = new Date("2026-10-09T12:00:00Z");
    expect(getKolkataMinutesOfDay(dateUtcNoon)).toBe(1050);
  });

  it("flags night correctly according to 20:00 - 05:30 IST window", () => {
    // 21:00 IST (15:30 UTC) -> Night
    const dateNight = new Date("2026-10-09T15:30:00Z");
    const signalsNight = deriveContextSignals(clearWeather, dummyCtx, dateNight);
    expect(signalsNight.isNight).toBe(true);

    // 04:00 IST (22:30 UTC previous day) -> Night
    const dateEarlyMorning = new Date("2026-10-08T22:30:00Z");
    const signalsEarly = deriveContextSignals(clearWeather, dummyCtx, dateEarlyMorning);
    expect(signalsEarly.isNight).toBe(true);

    // 14:00 IST (08:30 UTC) -> Day
    const dateDay = new Date("2026-10-09T08:30:00Z");
    const signalsDay = deriveContextSignals(clearWeather, dummyCtx, dateDay);
    expect(signalsDay.isNight).toBe(false);
  });

  it("identifies morning and evening peak traffic hours in Pune", () => {
    // Morning peak: 09:30 IST (04:00 UTC)
    const morningPeak = new Date("2026-10-09T04:00:00Z");
    expect(deriveContextSignals(clearWeather, dummyCtx, morningPeak).isPeakTraffic).toBe(true);

    // Evening peak: 18:30 IST (13:00 UTC)
    const eveningPeak = new Date("2026-10-09T13:00:00Z");
    expect(deriveContextSignals(clearWeather, dummyCtx, eveningPeak).isPeakTraffic).toBe(true);

    // Off-peak afternoon: 14:00 IST (08:30 UTC)
    const offPeak = new Date("2026-10-09T08:30:00Z");
    expect(deriveContextSignals(clearWeather, dummyCtx, offPeak).isPeakTraffic).toBe(false);
  });

  it("detects rain and heavy rain thresholds cleanly", () => {
    const midday = new Date("2026-10-09T08:30:00Z");

    const lightRainWeather: WeatherSnapshot = {
      tempC: 25,
      precipitationMm: 2.5,
      conditionCode: "light_rain",
      alerts: [],
    };
    const lightSignals = deriveContextSignals(lightRainWeather, dummyCtx, midday);
    expect(lightSignals.isRaining).toBe(true);
    expect(lightSignals.heavyRain).toBe(false);

    const downpourWeather: WeatherSnapshot = {
      tempC: 23,
      precipitationMm: 15.0, // Above default heavy rain threshold 10.0mm
      conditionCode: "heavy_monsoon_downpour",
      alerts: [],
    };
    const downpourSignals = deriveContextSignals(downpourWeather, dummyCtx, midday);
    expect(downpourSignals.isRaining).toBe(true);
    expect(downpourSignals.heavyRain).toBe(true);
  });

  it("detects heat stress during severe afternoon temperatures", () => {
    const midday = new Date("2026-10-09T08:30:00Z");
    const scorchingWeather: WeatherSnapshot = {
      tempC: 40.5, // > 38.0 C
      precipitationMm: 0,
      conditionCode: "clear_heat",
      alerts: [{ type: "heatwave_warning", severity: "warning" }],
    };

    const signals = deriveContextSignals(scorchingWeather, dummyCtx, midday);
    expect(signals.heatStress).toBe(true);
    expect(signals.hasAlert).toBe(true);
  });
});
