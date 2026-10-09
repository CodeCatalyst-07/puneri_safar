/**
 * @file src/adapters/routes/index.ts
 * Interface and contracts for Google Routes API adapter.
 */

export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

export type RoutingTravelMode = "DRIVE" | "TWO_WHEELER" | "WALK" | "BICYCLE" | "TRANSIT";

export type RoutePreference = "FASTEST" | "SAFEST_AVOID_HAZARDS" | "SHORTEST";

export interface RouteWaypoint {
  location: LatLngPoint;
  isVia?: boolean;
}

export interface RouteLegStep {
  distanceMeters: number;
  staticDurationSeconds: number;
  instructions: string;
  startLocation: LatLngPoint;
  endLocation: LatLngPoint;
}

export interface ComputedRoute {
  routeToken?: string;
  distanceMeters: number;
  durationSeconds: number;
  staticDurationSeconds: number;
  encodedPolyline: string;
  steps: RouteLegStep[];
  warnings?: string[];
  travelMode: RoutingTravelMode;
}

export interface ComputeRouteOptions {
  origin: LatLngPoint;
  destination: LatLngPoint;
  travelMode: RoutingTravelMode;
  intermediates?: RouteWaypoint[];
  preference?: RoutePreference;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

export interface RouteComparisonOptions {
  origin: LatLngPoint;
  destination: LatLngPoint;
  travelMode: RoutingTravelMode;
}

export interface RouteComparisonResult {
  fastestRoute: ComputedRoute;
  safestRoute: ComputedRoute;
  summary: {
    distanceDiffMeters: number;
    durationDiffSeconds: number;
    safetyRiskDiffScore: number;
    recommendedRoute: "fastest" | "safest";
    rationale: string;
  };
}

/**
 * Routes Adapter Client contract.
 * Wraps Google Routes API with safety-aware routing capabilities.
 */
export interface RoutesClient {
  /**
   * Computes primary directional route between two points.
   */
  computeRoute(options: ComputeRouteOptions): Promise<ComputedRoute>;

  /**
   * Compares default fastest route against safety-optimized alternative.
   */
  compareRoutes(options: RouteComparisonResult): Promise<RouteComparisonResult>;
}

export * from "./googleRoutes";
