/**
 * @file src/adapters/weather/googleWeather.ts
 * Google Weather API adapter with ~1km grid caching and public alerts handling.
 */

import { z } from "zod";
import { WeatherSnapshot, weatherSnapshotSchema } from "@/core/types";
import { googleFetch, GoogleApiResult } from "@/lib/googleFetch";
import { env } from "@/lib/env";

const CURRENT_CONDITIONS_URL = "https://weather.googleapis.com/v1/currentConditions:lookup";
const PUBLIC_ALERTS_URL = "https://weather.googleapis.com/v1/publicAlerts:lookup";

const rawCurrentConditionsSchema = z.object({
  temperature: z.object({ degrees: z.number() }).optional(),
  precipitation: z
    .object({
      qpf: z.object({ quantity: z.number().optional() }).optional(),
      probability: z.object({ percent: z.number().optional() }).optional(),
    })
    .optional(),
  currentConditionsHistory: z
    .object({
      qpf: z.object({ quantity: z.number().optional() }).optional(),
    })
    .optional(),
  weatherCondition: z
    .object({
      type: z.string().optional(),
      description: z.object({ text: z.string().optional() }).optional(),
    })
    .optional(),
});

const rawAlertsSchema = z.object({
  publicAlerts: z
    .array(
      z.object({
        alertType: z.string().optional(),
        severity: z.string().optional(),
        headline: z.string().optional(),
      })
    )
    .optional(),
});

function normalizeSeverity(raw?: string): "advisory" | "warning" | "emergency" {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("emergency") || lower.includes("extreme") || lower.includes("red")) {
    return "emergency";
  }
  if (lower.includes("warning") || lower.includes("orange") || lower.includes("severe")) {
    return "warning";
  }
  return "advisory";
}

/**
 * Rounds coordinate to approximately 1 km grid cell (~0.01 degrees).
 */
export function roundToGridCell(coord: number): number {
  return Math.round(coord * 100) / 100;
}

/**
 * Retrieves real-time weather and active alerts for a location.
 * Cached for 10 minutes per ~1 km grid cell.
 */
export async function getWeather(
  lat: number,
  lng: number,
  apiKeyOverride?: string
): Promise<GoogleApiResult<WeatherSnapshot>> {
  const apiKey = apiKeyOverride ?? env.server.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  const gridLat = roundToGridCell(lat);
  const gridLng = roundToGridCell(lng);

  const conditionsUrl = `${CURRENT_CONDITIONS_URL}?key=${apiKey}&location.latitude=${gridLat}&location.longitude=${gridLng}`;

  const conditionsResult = await googleFetch<unknown>({
    url: conditionsUrl,
    method: "GET",
    ttlMs: 10 * 60 * 1000, // 10 minutes cache
  });

  if (!conditionsResult.ok) {
    return conditionsResult;
  }

  const parsedConditions = rawCurrentConditionsSchema.safeParse(conditionsResult.data);
  if (!parsedConditions.success) {
    return { ok: false, reason: "malformed_response" };
  }

  const current = parsedConditions.data;
  const tempC = current.temperature?.degrees ?? 28;
  const precipitationMm = Math.max(
    0,
    current.precipitation?.qpf?.quantity ?? current.currentConditionsHistory?.qpf?.quantity ?? 0
  );
  const conditionCode = current.weatherCondition?.type?.toLowerCase() ?? "clear";

  // Optionally query alerts (non-blocking fallback to empty if unavailable/unsupported)
  const alertsUrl = `${PUBLIC_ALERTS_URL}?key=${apiKey}&location.latitude=${gridLat}&location.longitude=${gridLng}`;
  const alertsResult = await googleFetch<unknown>({
    url: alertsUrl,
    method: "GET",
    ttlMs: 10 * 60 * 1000,
  });

  const alerts: Array<{ type: string; severity: "advisory" | "warning" | "emergency" }> = [];

  if (alertsResult.ok) {
    const parsedAlerts = rawAlertsSchema.safeParse(alertsResult.data);
    if (parsedAlerts.success && parsedAlerts.data.publicAlerts) {
      for (const a of parsedAlerts.data.publicAlerts) {
        alerts.push({
          type: a.alertType ?? a.headline ?? "weather_advisory",
          severity: normalizeSeverity(a.severity),
        });
      }
    }
  }

  const snapshot: WeatherSnapshot = {
    tempC,
    precipitationMm,
    conditionCode,
    alerts,
  };

  const validSnapshot = weatherSnapshotSchema.safeParse(snapshot);
  if (!validSnapshot.success) {
    return { ok: false, reason: "malformed_response" };
  }

  return { ok: true, data: validSnapshot.data };
}
