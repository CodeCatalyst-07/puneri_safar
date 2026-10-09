import {
  PlacesClient,
  PlaceSearchOptions,
  PlaceSearchResult,
  PlaceDetails,
  NearbyPlacesOptions,
  PlaceSummary,
} from "@/adapters/places";

/**
 * Trivial offline mock for Google Places queries.
 */
export class MockPlacesClient implements PlacesClient {
  private mockPlaces: PlaceSummary[] = [
    {
      id: "place-shaniwar-wada",
      name: "Shaniwar Wada",
      primaryType: "historical_landmark",
      category: "heritage",
      formattedAddress: "Shaniwar Peth, Pune, Maharashtra 411030",
      location: { latitude: 18.5196, longitude: 73.8553 },
      rating: 4.5,
      userRatingCount: 42000,
      isOpenNow: true,
    },
    {
      id: "place-fc-road",
      name: "FC Road Food Trail",
      primaryType: "restaurant",
      category: "food_and_dining",
      formattedAddress: "Fergusson College Rd, Shivajinagar, Pune 411004",
      location: { latitude: 18.5284, longitude: 73.8415 },
      rating: 4.6,
      userRatingCount: 15400,
      isOpenNow: true,
    },
  ];

  async searchPlaces(options: PlaceSearchOptions): Promise<PlaceSearchResult> {
    const filtered = this.mockPlaces.filter((p) =>
      p.name.toLowerCase().includes(options.query.toLowerCase())
    );

    return {
      places: filtered.length > 0 ? filtered : this.mockPlaces,
      totalFound: filtered.length > 0 ? filtered.length : this.mockPlaces.length,
    };
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    const found = this.mockPlaces.find((p) => p.id === placeId);
    if (!found) return null;

    return {
      ...found,
      editorialSummary: "Iconic historical seat of the Peshwa rulers of the Maratha Empire.",
      regularOpeningHours: ["Monday: 9:30 AM - 5:30 PM", "Tuesday: 9:30 AM - 5:30 PM"],
      phoneNumber: "+91 20 2612 6867",
      wheelchairAccessibleEntrance: true,
    };
  }

  async getNearbyPlaces(options: NearbyPlacesOptions): Promise<PlaceSummary[]> {
    return this.mockPlaces.slice(0, options.maxResults ?? 5);
  }
}
