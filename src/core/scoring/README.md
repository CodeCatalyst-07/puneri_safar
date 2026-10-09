# Core Scoring Module (`src/core/scoring`)

Contains pure algorithmic risk and ranking evaluation for Pune city navigation:

- Route safety indexing: evaluates proximity to Pune accident blackspots, waterlogged monsoon spots, road lighting, and community hazards.
- Place multi-criteria ranking: balances Google Place ratings, review count confidence, and distance.

## Architectural Rules

- PURE domain logic only.
- ZERO dependencies on Next.js, network, or external databases.
