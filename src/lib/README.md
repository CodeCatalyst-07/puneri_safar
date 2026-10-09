# Infrastructure Library (`src/lib`)

This directory contains foundational, cross-cutting infrastructure helpers for Puneri Safar.

## Modules

- `env.ts`: Strict Zod validation of server and client environment variables at boot. Prevents server secrets from leaking to client bundles.
- `logger.ts`: Structured JSON logger with automated redaction of sensitive credentials, tokens, and raw high-precision user GPS coordinates.
- `rateLimit.ts`: Swappable Token-Bucket in-memory rate limiter with standard HTTP headers (`Retry-After`, `X-RateLimit-*`) and Next.js route helper.
- `http.ts`: Standardized API response formatters (`jsonSuccess`, `jsonError`) preventing exposure of internal database errors and stack traces.
- `errors.ts`: Machine-readable operational error hierarchy (`AppError`, `ValidationError`, `RateLimitExceededError`, etc.).
