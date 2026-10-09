# Test Suite (`tests/`)

Mirrors the `src/` directory hierarchy for testability:

- `lib/`: Unit tests for environment parsing, structured logger sanitization, rate limiting, and HTTP response handling.
- `core/`: Pure unit tests for scoring algorithms (route risk, place ranking).
- `adapters/`: Offline contract tests verifying mock adapters fulfill interface requirements.
- `app/`: Route tests for API endpoints.
- `mocks/`: Offline, in-memory implementations of all adapter interfaces.
