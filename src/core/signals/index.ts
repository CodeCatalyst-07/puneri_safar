/**
 * @file src/core/signals/index.ts
 * Temporal, environmental, and meteorological signal extraction for Pune.
 *
 * PURE BUSINESS LOGIC:
 * - Deterministic: `now: Date` is explicitly injected.
 * - Time calculations use Asia/Kolkata (IST = UTC+05:30) timezone.
 * - Zero magic numbers; all thresholds defined in configuration objects.
 */

import { UserContext, WeatherSnapshot } from "../types";

export interface SignalsConfig {
  nightStartMinutes: number; // 20:00 = 1200
  nightEndMinutes: number; // 05:30 = 330
  morningPeakStartMinutes: number; // 08:00 = 480
  morningPeakEndMinutes: number; // 11:00 = 660
  eveningPeakStartMinutes: number; // 17:00 = 1020
  eveningPeakEndMinutes: number; // 21:00 = 1260
  heavyRainThresholdMm: number; // mm of rain per hour
  heatStressThresholdC: number; // degrees Celsius
  rainDetectionThresholdMm: number;
}

export const DEFAULT_SIGNALS_CONFIG: SignalsConfig = {
  nightStartMinutes: 20 * 60, // 20:00 (8:00 PM)
  nightEndMinutes: 5 * 60 + 30, // 05:30 (5:30 AM)
  morningPeakStartMinutes: 8 * 60, // 08:00 (8:00 AM)
  morningPeakEndMinutes: 11 * 60, // 11:00 (11:00 AM)
  eveningPeakStartMinutes: 17 * 60, // 17:00 (5:00 PM)
  eveningPeakEndMinutes: 21 * 60, // 21:00 (9:00 PM)
  heavyRainThresholdMm: 10.0,
  heatStressThresholdC: 38.0,
  rainDetectionThresholdMm: 0.2,
};

export interface ContextSignals {
  isNight: boolean;
  isRaining: boolean;
  heavyRain: boolean;
  heatStress: boolean;
  isPeakTraffic: boolean;
  hasAlert: boolean;
}

/**
 * Extracts minutes from midnight (0 to 1439) in Asia/Kolkata (UTC+5:30).
 */
export function getKolkataMinutesOfDay(now: Date): number {
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const totalUtcMinutes = utcHours * 60 + utcMinutes;
  const kolkataMinutes = totalUtcMinutes + 330; // +5h 30m offset
  return ((kolkataMinutes % 1440) + 1440) % 1440;
}

/**
 * Derives discrete behavioral and risk signals from weather, user context, and time.
 */
export function deriveContextSignals(
  weather: WeatherSnapshot,
  _ctx: UserContext,
  now: Date,
  config: SignalsConfig = DEFAULT_SIGNALS_CONFIG
): ContextSignals {
  const minutes = getKolkataMinutesOfDay(now);

  // Night is between 20:00 and 05:30
  const isNight = minutes >= config.nightStartMinutes || minutes < config.nightEndMinutes;

  // Peak traffic: morning 08:00-11:00 or evening 17:00-21:00
  const isMorningPeak =
    minutes >= config.morningPeakStartMinutes && minutes < config.morningPeakEndMinutes;
  const isEveningPeak =
    minutes >= config.eveningPeakStartMinutes && minutes < config.eveningPeakEndMinutes;
  const isPeakTraffic = isMorningPeak || isEveningPeak;

  const isRaining =
    weather.precipitationMm >= config.rainDetectionThresholdMm ||
    weather.conditionCode.toLowerCase().includes("rain") ||
    weather.conditionCode.toLowerCase().includes("drizzle") ||
    weather.conditionCode.toLowerCase().includes("downpour");

  const heavyRain = weather.precipitationMm >= config.heavyRainThresholdMm;
  const heatStress = weather.tempC >= config.heatStressThresholdC;
  const hasAlert = Array.isArray(weather.alerts) && weather.alerts.length > 0;

  return {
    isNight,
    isRaining,
    heavyRain,
    heatStress,
    isPeakTraffic,
    hasAlert,
  };
}
