import {
  WeatherClient,
  WeatherCoordinates,
  CurrentWeather,
  WeatherAlert,
  HourlyForecast,
} from "@/adapters/weather";

/**
 * Trivial offline mock for weather operations.
 */
export class MockWeatherClient implements WeatherClient {
  async getCurrentWeather(_location: WeatherCoordinates): Promise<CurrentWeather> {
    return {
      temperatureCelsius: 28.5,
      feelsLikeCelsius: 30.1,
      condition: "light_rain",
      humidityPercentage: 78,
      windSpeedKmh: 14.2,
      rainIntensityMmPerHour: 4.5,
      observedAt: new Date().toISOString(),
    };
  }

  async getMonsoonAlerts(_location: WeatherCoordinates): Promise<WeatherAlert[]> {
    return [
      {
        id: "alert-pune-monsoon-1",
        severity: "warning",
        title: "Monsoon Waterlogging Caution - Deccan Gymkhana",
        description:
          "Heavy localized rain may cause water accumulation near Z-bridge and Deccan riverbed.",
        type: "waterlogging_risk",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 14400000).toISOString(),
      },
    ];
  }

  async getHourlyForecast(_location: WeatherCoordinates, hours = 6): Promise<HourlyForecast[]> {
    const forecasts: HourlyForecast[] = [];
    const now = Date.now();

    for (let i = 0; i < hours; i++) {
      forecasts.push({
        timestamp: new Date(now + i * 3600000).toISOString(),
        temperatureCelsius: 28 - i * 0.5,
        condition: i < 2 ? "light_rain" : "partly_cloudy",
        precipitationProbability: Math.max(10, 80 - i * 15),
        rainIntensityMm: Math.max(0, 5 - i),
      });
    }

    return forecasts;
  }
}
