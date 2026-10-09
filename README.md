# Puneri Safar

> Explore, experience and navigate Pune - smarter and safer.

---

## 1. Problem Statement

> **City Life: Exploring, Experiencing & Navigating the Chaos We Call Home** &mdash; build a smart, interactive city exploration platform that turns real-world city data into useful insights across exploration and hospitality, history and culture, safety and security, best-vs-worst comparison, and smart city insights.

Pune is a rapidly expanding metropolis where centuries of Maratha heritage coexist alongside heavy traffic bottlenecks, sudden monsoon waterlogging, and tech corridors. Citizens and visitors often lack unified, context-aware intelligence that bridges cultural exploration with everyday urban realities (e.g. route safety, lighting, and flood chokepoints). **Puneri Safar** solves this by harmonizing municipal datasets, Google Maps services, meteorological reports, and generative AI into an accessible, privacy-respecting website.

---

## 2. Quick Start ("Run It")

To run Puneri Safar locally in under 2 minutes:

```bash
# 1. Clone repository
git clone https://github.com/CodeCatalyst-07/puneri_safar.git
cd puneri_safar

# 2. Install dependencies
npm install

# 3. Configure environment keys
cp .env.example .env.local
```

### Essential API Keys in `.env.local`

| Key                           | Scope          | Purpose                                                                   |
| :---------------------------- | :------------- | :------------------------------------------------------------------------ |
| `GEMINI_API_KEY`              | Server-only    | Generative AI assistant tool-calling and structured report classification |
| `GOOGLE_MAPS_SERVER_KEY`      | Server-only    | Places (New), Routes, and Weather APIs                                    |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Client browser | Interactive vector map canvas rendering                                   |

```bash
# 4. Start development server
npm run dev
# Open http://localhost:3000 in your browser
```

---

## 3. Features Mapped to the 5 Problem-Statement Areas

Puneri Safar maps directly to each of the 5 city life evaluation criteria:

| Area                             | Feature Implementation                                                                                                                                                      | Problem Solved                                                                                                  |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| **1. Exploration & Hospitality** | Bayesian-smoothed venue recommendations (`src/core/ranking`), price tiers, and opening status via Google Places API (New).                                                  | Eliminates review count bias so authentic Pune dining spots are surfaced reliably.                              |
| **2. History & Culture**         | Curated Peshwa and Maratha landmark registry (`src/data/heritage.json`) with ASI/PMC records, verified physical accessibility attributes, and background citations.         | Connects residents and tourists to Pune's heritage with step-free wheelchair accessibility indicators.          |
| **3. Safety & Hazards**          | Corroborated Pune Police accident blackspots registry (`src/data/blackspots.json`) and citizen hazard reporting with distinct-reporter SHA-256 IP hashing (`/api/reports`). | Provides real-world road safety intelligence for two-wheelers and pedestrians while respecting citizen privacy. |
| **4. Best-vs-Worst Comparison**  | Deterministic Multi-Criteria Decision Analysis (MCDA) route tradeoff evaluation (`fastest` vs `fewest_hazards`) with transparent minutes added and hazard points avoided.   | Helps commuters make informed trade-offs rather than forcing a single opaque routing option.                    |
| **5. Smart City & Weather**      | Real-time weather signals via Google Weather API integrated into transit advisories with clear data honesty caveats and text-first accessible fallbacks.                    | Advises commuters on monsoon rain, waterlogging hazards, and heat advisory implications.                        |

---

## 4. 5-Step Demo Script for Judges

Follow these 5 steps to verify all core capabilities in 60 seconds:

1. **Step 1: Context & Location Detection**
   - Open [http://localhost:3000](http://localhost:3000).
   - In the **"Your Pune Context"** panel, click **"Use My Location"**.
   - If outside Pune or denied, observe the automatic graceful fallback to **Shivajinagar (`18.5314, 73.8446`)** with a clear user status message. Toggle transit modes (two-wheeler, walk, car, transit).
2. **Step 2: Road Hazard Route Evaluation (Part A1)**
   - Click the example chip: `"Safer way from Katraj to Hinjewadi"`.
   - Observe the instant **"Answered by rules"** badge (0ms LLM latency, zero hallucination).
   - Review the two route cards: **Option A (Fastest)** vs **Option B (Fewest Known Hazards)** showing minutes added, hazard points avoided, and documented blackspot corridors (e.g. Navale Bridge Chowk, Katraj Chowk).
   - Notice the selected route highlighted dynamically on the map canvas.
3. **Step 3: Exploration & Bayesian Ranking**
   - Click the example chip: `"Cheap vegetarian dinner near me tonight"`.
   - Review ranked place cards with Bayesian ratings, price level symbols (e.g. `₹`), and step-free accessibility tags.
   - Click **"Why this? (MCDA Criteria Breakdown)"** on any card to see exact multi-factor scoring.
   - Note: Missing data is strictly labeled `"No data"` &mdash; never misleadingly displayed as `0`.
4. **Step 4: Citizen Hazard Reporting & Corroboration (Part A2)**
   - Scroll down to the **"Report an Issue or Hazard"** section (`#report`).
   - Type a hazard description (note the live 300-char counter and ~100m privacy rounding indicator).
   - Submit the form and see the plain-language status: _"Thanks - saved as unverified; it influences routes only after another person reports the same issue nearby."_
5. **Step 5: Data Honesty & Provenance Page**
   - Click **"About & data honesty"** in the header (`/about`).
   - Read the dataset verification table distinguishing official police blackspots (`counted` vs `listed_only`) from citizen reports.
   - Note the prominent safety clarification: **road-traffic collision safety only, not crime or personal safety (no open crime feeds exist for Pune)**.

---

## 7. Environment Variables

Create a `.env.local` file by copying the provided `.env.example`:

```bash
cp .env.example .env.local
```

### Keys Breakdown (Required vs Optional)

| Variable                      | Scope  | Required | Default / Fallback | Description                                                                 |
| :---------------------------- | :----- | :------- | :----------------- | :-------------------------------------------------------------------------- |
| `GEMINI_API_KEY`              | Server | **Yes**  | None               | Official Google Gemini API key for assistant & report classification        |
| `GEMINI_MODEL`                | Server | **Yes**  | `gemini-2.5-flash` | Configurable model identifier (read dynamically; never hardcoded)           |
| `GOOGLE_MAPS_SERVER_KEY`      | Server | **Yes**  | None               | Restricted server key for Places (New), Routes, and Weather APIs            |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Client | **Yes**  | None               | Referrer-restricted key for browser Google Maps JavaScript API              |
| `LLM_PROVIDER`                | Server | No       | `gemini`           | Active LLM provider selection (`gemini` or `groq`)                          |
| `GROQ_API_KEY`                | Server | No       | `undefined`        | Optional API key for Groq fast inference fallback provider                  |
| `FIREBASE_PROJECT_ID`         | Server | No       | `undefined`        | Optional Firebase project ID for Firestore citizen reports                  |
| `FIREBASE_CLIENT_EMAIL`       | Server | No       | `undefined`        | Optional Firebase service account client email                              |
| `FIREBASE_PRIVATE_KEY`        | Server | No       | `undefined`        | Optional Firebase PEM private key; falls back to in-memory store if omitted |
| `NODE_ENV`                    | Shared | No       | `development`      | Runtime environment (`development`, `test`, `production`)                   |

> **Security Rule**: Server-only keys must NEVER use the `NEXT_PUBLIC_` prefix. Environment access is strictly validated via Zod in `src/lib/env.ts`. `SKIP_ENV_VALIDATION` is strictly restricted to `next build` and ignored during live server execution.
>
> **Graceful Degradation**: If Firebase credentials are not provided or contain invalid placeholders, the platform automatically logs a single warning and uses an in-memory repository for citizen hazard reports. No unhandled 500 errors occur.

---

## 8. Testing

Puneri Safar uses **Vitest** with `@vitest/coverage-v8` for unit and contract testing. All external services are mocked in `tests/mocks/`, enabling 100% offline test execution.

```bash
# Run test suite once with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Code linting
npm run lint
```

---

## 9. Security Notes

- **Content Security Policy (CSP)**: Configured in `next.config.ts` to allow Google Maps scripts, Google Fonts, and tile assets while blocking inline script injection vulnerabilities (`XSS`).
- **Token-Bucket Rate Limiter**: Implemented in `src/lib/rateLimit.ts` to protect API endpoints against denial-of-service and brute force abuse, returning standard `Retry-After` headers.
- **Secret Isolation**: Server keys are runtime-guarded; any client-side access throws a security violation.
- **GPS Coordinate Redaction**: `src/lib/logger.ts` redacts high-precision latitude/longitude pairs to prevent logging raw user locations.
- **Fail-Safe HTTP Responses**: `src/lib/http.ts` prevents leaking internal database errors and stack traces in API responses.

---

## 10. Accessibility Implementation (WCAG 2.1 AA)

Puneri Safar is built strictly according to WCAG 2.1 AA standards without third-party UI framework bloat:

- **Semantic Landmarks & Heading Hierarchy**: Clean single `<h1>` per page, hierarchical `<h2>` and `<h3>` tags, and standard ARIA landmarks (`<header role="banner">`, `<nav aria-label="...">`, `<main id="main-content">`, `<section aria-labelledby="...">`, `<footer role="contentinfo">`).
- **Skip Links & Bypass Blocks (WCAG 2.4.1)**:
  - Top-level `Skip to main content` mechanism.
  - Dedicated `Skip map to results list` anchor above the vector map.
- **Keyboard Navigation & Visible Focus (WCAG 2.4.7)**: All interactive elements (buttons, selects, textareas, chips, route cards) are fully keyboard-navigable with high-visibility 3px `:focus-visible` rings.
- **Accessible Form Controls (WCAG 3.3.2)**: Real `<label>` associations, `<fieldset>` and `<legend>` groupings, live counters linked via `aria-describedby`, and error announcements via `aria-live="polite"`.
- **Dynamic Focus Management (WCAG 2.4.3)**: Programmatically transfers user focus to the `#assistant-results` live region after a query completes.
- **Adequate Touch Targets (WCAG 2.5.5)**: All interactive controls have min-heights and touch targets $\ge 44 \times 44\text{px}$.
- **Motion Sensitivity (WCAG 2.3.3)**: Global CSS media query `prefers-reduced-motion: reduce` neutralizes all CSS animations and transitions for users with vestibular disorders.
- **Information Not Conveyed by Color Alone (WCAG 1.4.1)**: Shapes and icons accompany all colors (e.g. ▲ triangle warning icons for blackspots, ➔ directional arrows for reports, solid vs dashed route polylines).
- **Text-First Resiliency**: The interactive map is supplementary. All places, blackspots, and routes render complete text data cards side-by-side with graceful fallback if the Google Maps JavaScript API is blocked or offline.
- **No Deceptive Missing Data**: Missing attributes (ratings, price levels, accessibility) strictly render as `"No data"` &mdash; never as `0`.

---

## 11. Data Honesty & Transparency

Data honesty is a foundational principle of Puneri Safar. Nothing is invented, embellished, or labelled "verified" without an attributable primary source.

### Datasets, Sources & Evidence Levels

1. **Traffic Accident Blackspots (`src/data/blackspots.json`)**:
   - **Source A — Pune City Police Road Safety Report (Summarized Jan 2026 via Punekar News `https://www.punekarnews.in/?p=225932`)**:
     Identified 20 MoRTH-definition black spots for 2022–2024. Explicitly stated crash counts are present for:
     - Katraj Chowk, Pune-Satara Road: 22 crashes (evidenceLevel: `counted`)
     - Perne Phata, Pune-Ahmednagar Road: 22 crashes (evidenceLevel: `counted`)
   - **Source B — Punekar News Road Safety Report (15 Jan 2022 via `https://www.punekarnews.in/?p=104358`)**:
     Names 19 accident-prone locations based on 2021 Pune Police traffic data without publishing specific crash totals per spot. The 13 identified spots are cataloged strictly with evidenceLevel `listed_only` and null crash counts:
     - New Katraj Tunnel Road, Dari Pul bridge Road, Navale Bridge Chowk, Bhumkar Bridge Chowk, Vaiduwadi Chowk, Phursungi Phata Chowk, Phursungi Railway bridge Road, Saswad Road near IBM Company, Mutha River Bridge Chowk, Dukkarkhind Road, Mai Mangeshkar Hospital Road, Tata Guard Room Chowk, Kharadi Bypass Chowk.
   - **Source C — Pune Police Road Safety Factsheet 2019–2022 (`https://admin.punepolice.gov.in/files/CitizenAlert/182.pdf`)**:
     Used exclusively as a corroborating citation where applicable. No unverified figures or totals are copied.
   - **Exclusions**: Hadapsar Police Station, Warje Flyover, Kirloskar Pneumatic, Navale Bridge "84 crashes", and Khadi Machine Chowk entries and unverified numbers were purged because they were not corroborated by official source documentation.

2. **Heritage Landmarks (`src/data/heritage.json`)**:
   - Sourced from Wikidata (P625 coordinate claims) and Archaeological Survey of India (ASI) protected monument registers.
   - Coordinates are linked to Wikidata entries (`https://www.wikidata.org/wiki/Q1351060`, `https://www.wikidata.org/wiki/Q7144204`, `https://www.wikidata.org/wiki/Q2344976`).
   - Descriptions are strictly factual paraphrases of public records. All entries set `coordinatesVerified: false` because field survey verification was not performed.

### Approximate Coordinate Handling & Safety Radii

- **Coordinates are NOT Human-Verified**: Coordinates are either resolved via OpenStreetMap Nominatim (`coordinateSource: "geocoded_osm"`), Wikidata (`coordinateSource: "wikidata"`), or marked as estimates (`coordinateSource: "estimated"`). None are marked `coordinatesVerified: true`.
- **Dynamic Matching Buffer**:
  - `coordinatesVerified === true`: 150-meter matching buffer (`VERIFIED_MATCH_RADIUS_METERS`).
  - `coordinatesVerified === false`: 300-meter matching buffer (`UNVERIFIED_MATCH_RADIUS_METERS`).
- **Prominent User Caveats**: Whenever an unverified hazard is matched along a route, the assessment explicitly outputs the caveat: `"Includes hazards with approximate location data (evaluated within a 300m radius)."`.
- **Weighting for Listed Spots**: Spots with `evidenceLevel: 'listed_only'` or null crash counts default to the lowest tier weight (`10`), avoiding unwarranted risk inflation.

### What is NOT Covered

- **Zero Open Geocoded Crime Data**: Pune Municipal Corporation and Pune Police do **not** publish open, geocoded crime incidence feeds.
- **Road Safety Only, NOT Personal Safety**: The **Known Hazard Index** measures solely documented road traffic collision spots and physical environmental risks (e.g. monsoon waterlogging). **It is NOT a measure of crime, personal security, or neighborhood safety.**
- **No Recorded Hazards ≠ Safe**: A route with a hazard index of 0 indicates only that no documented blackspots or verified incident reports fall within the corridor buffer; it does not guarantee the road is safe.
