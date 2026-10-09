# Adapters Layer (`src/adapters`)

This directory houses interfaces and implementations for all **external integrations and third-party services**.

## Purpose & Boundaries

- Defines clean, swappable TypeScript contracts (`LLMProvider`, `PlacesClient`, `WeatherClient`, `RoutesClient`, `ReportsRepository`).
- Isolates vendor-specific dependencies (Google Cloud, Gemini SDK, Groq SDK, OpenWeather/IMD, Firebase Admin SDK).
- Ensures the core application logic and test suites can run 100% offline using mock implementations in `tests/mocks/`.
