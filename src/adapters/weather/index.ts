/**
 * @file src/adapters/weather/index.ts
 * Interface and contracts for meteorological insights for Pune.
 */

export interface WeatherCoordinates {
  latitude: number;
  longitude: number;
}

export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "overcast"
  | "light_rain"
  | "heavy_monsoon_downpour"
  | "thunderstorm"
  | "haze";

export interface CurrentWeather {
  temperatureCelsius: number;
  feelsLikeCelsius: number;
  condition: WeatherCondition;
  humidityPercentage: number;
  windSpeedKmh: number;
  rainIntensityMmPerHour: number;
  observedAt: string;
}

export interface WeatherAlert {
  id: string;
  severity: "advisory" | "warning" | "emergency";
  title: string;
  description: string;
  type: "waterlogging_risk" | "heavy_rain" | "extreme_heat" | "high_wind";
  issuedAt: string;
  expiresAt: string;
}

export interface HourlyForecast {
  timestamp: string;
  temperatureCelsius: number;
  condition: WeatherCondition;
  precipitationProbability: number;
  rainIntensityMm: number;
}

/**
 * Weather Client contract.
 * Supplies real-time weather and monsoon hazard warnings for Pune.
 */
export interface WeatherClient {
  /**
   * Fetches real-time weather conditions for a Pune location.
   */
  getCurrentWeather(location: WeatherCoordinates): Promise<CurrentWeather>;

  /**
   * Retrieves active weather alerts (such as IMD red/orange monsoon warnings).
   */
  getMonsoonAlerts(location: WeatherCoordinates): Promise<WeatherAlert[]>;

  /**
   * Retrieves short-term hourly forecast for travel risk planning.
   */
  getHourlyForecast(location: WeatherCoordinates, hours?: number): Promise<HourlyForecast[]>;
}

export * from "./googleWeather";
