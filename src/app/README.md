# App Layer (`src/app`)

Next.js App Router layer containing routes, layouts, and API route handlers.

## Layering Rules

- **Thin Controller Pattern**: Route handlers and page components must contain **zero business logic**.
- **Orchestration Only**: Routes parse incoming requests, authenticate/rate limit, call domain services in `src/core/` and `src/adapters/`, and return responses.
- **No Direct Database or Vendor SDK Calls**: All external communication must pass through adapter interfaces defined in `src/adapters/`.
