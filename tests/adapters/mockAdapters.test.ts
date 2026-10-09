import { describe, it, expect } from "vitest";
import {
  MockLLMProvider,
  MockPlacesClient,
  MockWeatherClient,
  MockRoutesClient,
  MockReportsRepository,
} from "../mocks";

describe("Offline Mock Adapters Contract Compliance", () => {
  it("MockLLMProvider generates text and structured results offline", async () => {
    const llm = new MockLLMProvider();
    const textRes = await llm.generateText({ prompt: "Top 3 historical places in Pune" });
    expect(textRes.text).toContain("Mock LLM response");
    expect(textRes.usage).toBeDefined();

    const structRes = await llm.generateStructured<{ mock: boolean }>({
      prompt: "Extract places",
    });
    expect(structRes.data.mock).toBe(true);
  });

  it("MockPlacesClient searches places and returns details offline", async () => {
    const places = new MockPlacesClient();
    const searchRes = await places.searchPlaces({ query: "Shaniwar" });
    expect(searchRes.places.length).toBeGreaterThan(0);
    expect(searchRes.places[0].name).toBe("Shaniwar Wada");

    const details = await places.getPlaceDetails("place-shaniwar-wada");
    expect(details?.editorialSummary).toBeDefined();
    expect(details?.wheelchairAccessibleEntrance).toBe(true);
  });

  it("MockWeatherClient provides current weather and monsoon alerts offline", async () => {
    const weather = new MockWeatherClient();
    const current = await weather.getCurrentWeather({ latitude: 18.5204, longitude: 73.8567 });
    expect(current.temperatureCelsius).toBeGreaterThan(0);
    expect(current.humidityPercentage).toBeDefined();

    const alerts = await weather.getMonsoonAlerts({ latitude: 18.5204, longitude: 73.8567 });
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe("waterlogging_risk");
  });

  it("MockRoutesClient computes route and steps offline", async () => {
    const routes = new MockRoutesClient();
    const route = await routes.computeRoute({
      origin: { latitude: 18.5204, longitude: 73.8567 },
      destination: { latitude: 18.5304, longitude: 73.8467 },
      travelMode: "TWO_WHEELER",
    });
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.steps.length).toBe(2);
  });

  it("MockReportsRepository creates, queries, upvotes, and resolves hazards offline", async () => {
    const repo = new MockReportsRepository();

    const initialReports = await repo.getReportsInArea({
      center: { latitude: 18.52, longitude: 73.85 },
      radiusMeters: 5000,
    });
    expect(initialReports.length).toBe(2);

    const newReport = await repo.createReport({
      type: "pothole",
      severity: "medium",
      description: "Pothole near Senapati Bapat Road junction",
      location: { latitude: 18.535, longitude: 73.829 },
      neighborhood: "Shivajinagar",
      anonymousUserId: "user-test",
    });
    expect(newReport.id).toBeDefined();

    const upvoted = await repo.upvoteReport(newReport.id);
    expect(upvoted.upvotesCount).toBe(2);

    const resolved = await repo.resolveReport(newReport.id);
    expect(resolved.status).toBe("resolved");
  });
});
