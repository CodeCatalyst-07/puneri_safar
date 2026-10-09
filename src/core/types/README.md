# Core Domain Types (`src/core/types`)

Contains foundational domain schemas and types for Puneri Safar:

- `UserContext`: User intent, travel mode, budget, safety preference, accessibility, and locale.
- `WeatherSnapshot`: Rainfall, temperature, and emergency alerts.
- `PlaceCandidate`: Candidate location metadata, ratings, accessibility, and indoor/outdoor traits.
- `Report`: Crowdsourced and municipal road hazard, waterlogging, and safety reports.
- `Blackspot`: Official accident blackspots with citations and verified coordinates.
- `RouteCandidate`: Waypoint paths with distance and duration.
- `ScoreConfidence`: Standard confidence tier ('high' | 'low' | 'unknown') applied across all scored domain outputs.
