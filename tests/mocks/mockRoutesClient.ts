import {
  RoutesClient,
  ComputeRouteOptions,
  ComputedRoute,
  RouteComparisonResult,
} from "@/adapters/routes";

/**
 * Trivial offline mock for Google Routes operations.
 */
export class MockRoutesClient implements RoutesClient {
  async computeRoute(options: ComputeRouteOptions): Promise<ComputedRoute> {
    return {
      routeToken: "mock-route-token-abc-123",
      distanceMeters: 5200,
      durationSeconds: 900,
      staticDurationSeconds: 780,
      encodedPolyline: "mock_encoded_polyline_pune_junction",
      travelMode: options.travelMode,
      steps: [
        {
          distanceMeters: 1200,
          staticDurationSeconds: 200,
          instructions: "Head east on JM Road toward Balgandharva",
          startLocation: options.origin,
          endLocation: { latitude: 18.525, longitude: 73.848 },
        },
        {
          distanceMeters: 4000,
          staticDurationSeconds: 700,
          instructions: "Continue onto Sancheti Chowk and proceed to destination",
          startLocation: { latitude: 18.525, longitude: 73.848 },
          endLocation: options.destination,
        },
      ],
      warnings: ["Moderate monsoon surface water on low-lying bridge sections"],
    };
  }

  async compareRoutes(options: RouteComparisonResult): Promise<RouteComparisonResult> {
    return options;
  }
}
