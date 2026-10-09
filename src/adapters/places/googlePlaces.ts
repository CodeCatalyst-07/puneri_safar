/**
 * @file src/adapters/places/googlePlaces.ts
 * Google Places API (New) adapter using Text Search with strict field mask.
 */

import { z } from "zod";
import { LatLng, PlaceCandidate, placeCandidateSchema } from "@/core/types";
import { haversineMeters } from "@/core/geo";
import { googleFetch, GoogleApiResult } from "@/lib/googleFetch";
import { env } from "@/lib/env";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_FIELD_MASK =
  "places.id,places.displayName,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel,places.accessibilityOptions,places.currentOpeningHours.openNow,places.formattedAddress";

const INDOOR_TYPES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "meal_takeaway",
  "meal_delivery",
  "museum",
  "art_gallery",
  "movie_theater",
  "shopping_mall",
  "store",
  "supermarket",
  "clothing_store",
  "department_store",
  "library",
  "lodging",
  "hotel",
  "hindu_temple",
  "place_of_worship",
  "spa",
  "gym",
  "bank",
]);

const OUTDOOR_TYPES = new Set([
  "park",
  "tourist_attraction",
  "campground",
  "natural_feature",
  "hiking_area",
  "zoo",
  "amusement_park",
  "transit_station",
  "bus_station",
  "bridge",
]);

export function deriveIsIndoor(types: string[]): boolean {
  for (const t of types) {
    if (INDOOR_TYPES.has(t)) return true;
  }
  for (const t of types) {
    if (OUTDOOR_TYPES.has(t)) return false;
  }
  return true;
}

export function convertPriceLevel(rawPriceLevel?: string | number): number | undefined {
  if (typeof rawPriceLevel === "number") {
    return rawPriceLevel >= 0 && rawPriceLevel <= 4 ? rawPriceLevel : undefined;
  }
  if (!rawPriceLevel || typeof rawPriceLevel !== "string") {
    return undefined;
  }
  switch (rawPriceLevel) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return undefined;
  }
}

const rawPlacesResponseSchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }).optional(),
        location: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
        types: z.array(z.string()).optional(),
        rating: z.number().optional(),
        userRatingCount: z.number().optional(),
        priceLevel: z.union([z.string(), z.number()]).optional(),
        accessibilityOptions: z
          .object({
            wheelchairAccessibleEntrance: z.boolean().optional(),
            wheelchairAccessibleRestroom: z.boolean().optional(),
            wheelchairAccessibleSeating: z.boolean().optional(),
            wheelchairAccessibleParking: z.boolean().optional(),
          })
          .optional(),
        currentOpeningHours: z.object({ openNow: z.boolean().optional() }).optional(),
        formattedAddress: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * Searches places in Pune using Places API (New) Text Search.
 * Cached for 10 minutes (600,000 ms).
 */
export async function searchPlaces(
  query: string,
  location?: LatLng,
  radiusMeters = 5000,
  apiKeyOverride?: string
): Promise<GoogleApiResult<PlaceCandidate[]>> {
  const apiKey = apiKeyOverride ?? env.server.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  const requestBody: Record<string, unknown> = {
    textQuery: query,
  };

  if (location) {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius: radiusMeters,
      },
    };
  }

  const fetchResult = await googleFetch<unknown>({
    url: PLACES_SEARCH_URL,
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACES_FIELD_MASK,
    },
    body: requestBody,
    ttlMs: 10 * 60 * 1000, // 10 minutes cache
  });

  if (!fetchResult.ok) {
    return fetchResult;
  }

  const parsed = rawPlacesResponseSchema.safeParse(fetchResult.data);
  if (!parsed.success) {
    return { ok: false, reason: "malformed_response" };
  }

  const rawPlaces = parsed.data.places ?? [];
  const candidates: PlaceCandidate[] = [];

  for (const p of rawPlaces) {
    const lat = p.location?.latitude ?? location?.lat ?? 18.5204;
    const lng = p.location?.longitude ?? location?.lng ?? 73.8567;
    const types = p.types ?? [];

    const candidate: PlaceCandidate = {
      id: p.id,
      name: p.displayName?.text ?? p.id,
      lat,
      lng,
      types,
      rating: p.rating,
      ratingCount: p.userRatingCount,
      priceLevel: convertPriceLevel(p.priceLevel),
      accessibility: p.accessibilityOptions
        ? {
            wheelchairEntrance: p.accessibilityOptions.wheelchairAccessibleEntrance,
            wheelchairRestroom: p.accessibilityOptions.wheelchairAccessibleRestroom,
            wheelchairSeating: p.accessibilityOptions.wheelchairAccessibleSeating,
            wheelchairParking: p.accessibilityOptions.wheelchairAccessibleParking,
          }
        : undefined,
      openNow: p.currentOpeningHours?.openNow,
      isIndoor: deriveIsIndoor(types),
      distanceMeters: location ? haversineMeters(location, { lat, lng }) : undefined,
    };

    const validCandidate = placeCandidateSchema.safeParse(candidate);
    if (validCandidate.success) {
      candidates.push(validCandidate.data);
    }
  }

  return { ok: true, data: candidates };
}
