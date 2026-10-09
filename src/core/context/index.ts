/**
 * @file src/core/context/index.ts
 * Pure domain types representing user context in Pune city exploration.
 */

export type TravelMode = "walking" | "two_wheeler" | "auto" | "driving" | "metro" | "bus";

export type TimeOfDay =
  "early_morning" | "morning_peak" | "afternoon" | "evening_peak" | "night" | "late_night";

export type ExplorerPersona =
  | "heritage_enthusiast"
  | "local_foodie"
  | "daily_commuter"
  | "tourist"
  | "safety_conscious_traveler"
  | "budget_explorer";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PuneNeighborhood {
  id: string;
  name: string;
  marathiName?: string;
  zone: "Central" | "East" | "West" | "North" | "South" | "PCMC";
}

export interface UserAccessibilityPreferences {
  requireWheelchairAccess: boolean;
  preferWellLitRoutes: boolean;
  avoidWaterloggedAreas: boolean;
}

/**
 * Composite representation of user context utilized across LLM synthesis,
 * route risk scoring, and place recommendation.
 */
export interface UserContext {
  /** Approximate neighborhood or area in Pune */
  currentNeighborhood?: PuneNeighborhood;
  /** Coarse coordinates for localized insights */
  currentLocation?: GeoPoint;
  travelMode: TravelMode;
  timeOfDay: TimeOfDay;
  persona: ExplorerPersona;
  isMonsoonSeason: boolean;
  accessibility: UserAccessibilityPreferences;
}
