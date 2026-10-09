/**
 * @file src/adapters/places/index.ts
 * Interface and contracts for Google Places API (New) adapter.
 */

export interface PlaceCoordinates {
  latitude: number;
  longitude: number;
}

export type PlaceCategory =
  | "heritage"
  | "food_and_dining"
  | "cultural_landmark"
  | "public_park"
  | "transit_hub"
  | "hospital"
  | "police_station"
  | "market";

export interface PlacePhoto {
  photoReference: string;
  width: number;
  height: number;
  attributions?: string[];
}

export interface PlaceSummary {
  id: string;
  name: string;
  primaryType: string;
  category: PlaceCategory;
  formattedAddress: string;
  location: PlaceCoordinates;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  isOpenNow?: boolean;
  coverPhoto?: PlacePhoto;
}

export interface PlaceDetails extends PlaceSummary {
  editorialSummary?: string;
  regularOpeningHours?: string[];
  phoneNumber?: string;
  websiteUri?: string;
  wheelchairAccessibleEntrance?: boolean;
  reviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    relativePublishTimeDescription: string;
  }>;
}

export interface PlaceSearchOptions {
  query: string;
  locationBias?: {
    center: PlaceCoordinates;
    radiusMeters: number;
  };
  category?: PlaceCategory;
  maxResults?: number;
  languageCode?: string;
}

export interface NearbyPlacesOptions {
  location: PlaceCoordinates;
  radiusMeters: number;
  includedTypes?: string[];
  maxResults?: number;
}

export interface PlaceSearchResult {
  places: PlaceSummary[];
  nextPageToken?: string;
  totalFound: number;
}

/**
 * Places Adapter Client contract.
 * Hides Google Places Web API endpoints behind an offline-testable boundary.
 */
export interface PlacesClient {
  /**
   * Performs text-based semantic search for places within Pune.
   */
  searchPlaces(options: PlaceSearchOptions): Promise<PlaceSearchResult>;

  /**
   * Retrieves comprehensive metadata for a specific place by ID.
   */
  getPlaceDetails(placeId: string, fields?: string[]): Promise<PlaceDetails | null>;

  /**
   * Discovers places in proximity to a given coordinate point.
   */
  getNearbyPlaces(options: NearbyPlacesOptions): Promise<PlaceSummary[]>;
}

export * from "./googlePlaces";
