# Test Mocks (`tests/mocks`)

Provides self-contained, in-memory mock implementations for every adapter interface:

- `MockLLMProvider`: Simulates AI generations without requiring Gemini or Groq API keys.
- `MockPlacesClient`: Returns curated Pune heritage and food places without Google Places API network calls.
- `MockWeatherClient`: Simulates Pune rainfall, AQI, and monsoon flood advisories.
- `MockRoutesClient`: Generates sample route legs and navigation steps offline.
- `MockReportsRepository`: In-memory hazard report store simulating Firestore collections.
