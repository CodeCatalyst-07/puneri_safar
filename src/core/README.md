# Core Domain Layer (`src/core`)

This directory houses **pure business logic and domain entities**.

## Architectural Law (Layering Rule)

1. **Pure Business Logic**: Core contains deterministic algorithms, domain types, and pure functions.
2. **Zero Framework Dependencies**: Must NOT import Next.js, React, Node.js internals, or external libraries.
3. **Zero Network or I/O**: Must NOT import `adapters/`, `app/`, `fs`, `fetch`, or any database clients.
4. **Dependency Inversion**: Outer layers (`src/app/`, `src/adapters/`) depend on `src/core/`, never the inverse.
