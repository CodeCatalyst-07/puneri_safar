/**
 * @file src/adapters/routes/googleRoutes.ts
 * Google Routes API adapter requesting alternative routes with minimal field mask.
 */

import { z } from "zod";
import { LatLng, RouteCandidate, routeCandidateSchema } from "@/core/types";
import { decodePolyline } from "@/core/geo";
import { googleFetch, GoogleApiResult } from "@/lib/googleFetch";
import { env } from "@/lib/env";

const ROUTES_COMPUTE_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ROUTES_FIELD_MASK = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

export type TravelModeInput =
  | "walk"
  | "two_wheeler"
  | "car"
  | "transit"
  | "DRIVE"
  | "TWO_WHEELER"
  | "WALK"
  | "TRANSIT"
  | "BICYCLE";

function normalizeTravelMode(mode: TravelModeInput): string {
  switch (mode) {
    case "walk":
    case "WALK":
      return "WALK";
    case "two_wheeler":
    case "TWO_WHEELER":
      return "TWO_WHEELER";
    case "transit":
    case "TRANSIT":
      return "TRANSIT";
    case "car":
    case "DRIVE":
    default:
      return "DRIVE";
  }
}

const rawRoutesResponseSchema = z.object({
  routes: z
    .array(
      z.object({
        duration: z.string().optional(),
        distanceMeters: z.number().optional(),
        polyline: z
          .object({
            encodedPolyline: z.string().optional(),
          })
          .optional(),
      })
    )
    .optional(),
});

/**
 * Computes primary and alternative routes between two points.
 * Cached for 5 minutes (300,000 ms).
 */
export async function computeRoutes(
  origin: LatLng,
  destination: LatLng,
  mode: TravelModeInput = "car",
  apiKeyOverride?: string
): Promise<GoogleApiResult<RouteCandidate[]>> {
  const apiKey = apiKeyOverride ?? env.server.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  const travelMode = normalizeTravelMode(mode);

  const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
    travelMode,
    computeAlternativeRoutes: true,
  };

  const fetchResult = await googleFetch<unknown>({
    url: ROUTES_COMPUTE_URL,
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": ROUTES_FIELD_MASK,
    },
    body: requestBody,
    ttlMs: 5 * 60 * 1000, // 5 minutes cache
  });

  if (!fetchResult.ok) {
    return fetchResult;
  }

  const parsed = rawRoutesResponseSchema.safeParse(fetchResult.data);
  if (!parsed.success) {
    return { ok: false, reason: "malformed_response" };
  }

  const rawRoutes = parsed.data.routes ?? [];
  if (rawRoutes.length === 0) {
    return { ok: true, data: [] };
  }

  const candidates: RouteCandidate[] = [];

  rawRoutes.forEach((r, idx) => {
    const durationSeconds = parseInt(r.duration?.replace("s", "") ?? "0", 10);
    const distanceMeters = r.distanceMeters ?? 0;
    const decoded = decodePolyline(r.polyline?.encodedPolyline ?? "");
    const polyline = decoded.length > 0 ? decoded : [origin, destination];

    const candidate: RouteCandidate = {
      id: `route-${idx + 1}`,
      durationSeconds,
      distanceMeters,
      polyline,
    };

    const validCandidate = routeCandidateSchema.safeParse(candidate);
    if (validCandidate.success) {
      candidates.push(validCandidate.data);
    }
  });

  return { ok: true, data: candidates };
}
