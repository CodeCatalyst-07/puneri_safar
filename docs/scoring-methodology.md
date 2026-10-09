# Puneri Safar &mdash; Scoring Methodology & Mathematical Specifications

This document defines the mathematical formulas, Bayesian priors, scoring weights, environmental thresholds, and uncertainty handling rules implemented in `src/core/`.

Reviewers can verify and audit all platform algorithms against this reference without inspecting source code.

---

## 1. Core Principles

1. **Pure Domain Logic**: All calculations in `src/core/` are deterministic pure functions with **zero side effects**, zero external framework dependencies, and zero direct system clock calls (`Date.now()` is prohibited; `now: Date` is injected as a parameter).
2. **Ground Truth Separation**: Large Language Models (LLMs) are **never** the source of quantitative numbers or ratings. Deterministic engines compute all metrics and synthesize verified factual statements (`src/core/explain/`), which generative models only verbalize.
3. **Honesty & Missing-Data Handling**: Missing data is **never** silently scored as zero. Incomplete criteria are omitted from scoring, active weights are dynamically renormalized, and data limitations are reported with confidence `'unknown'`.
4. **Safety Realism**: The route safety engine evaluates a **Known Hazard Index** rather than a subjective "safety score". A lack of recorded incident data yields a score of 0 with confidence `'low'` and an explicit caveat: _"No recorded hazards is not the same as safe."_

---

## 2. Geodesic Foundations (`src/core/geo`)

### 2.1 Haversine Distance Formula

Great-circle distance $d$ in meters between points $(\phi_1, \lambda_1)$ and $(\phi_2, \lambda_2)$:

$$\Delta\phi = \text{radians}(\phi_2 - \phi_1)$$
$$\Delta\lambda = \text{radians}(\lambda_2 - \lambda_1)$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \arctan2(\sqrt{a}, \sqrt{1 - a})$$
$$d = R_{\text{Earth}} \cdot c \quad \text{where } R_{\text{Earth}} = 6{,}371{,}000\text{ m}$$

### 2.2 Point-to-Polyline Shortest Distance

For a polyline composed of consecutive segments $S_i = (A_i, B_i)$:

1. Vector projection scalar $t$:
   $$t = \frac{(P - A) \cdot (B - A)}{\|B - A\|^2}$$
2. Clamping to finite segment endpoints:
   - If $t \le 0$: distance is $\text{haversine}(P, A)$.
   - If $t \ge 1$: distance is $\text{haversine}(P, B)$.
   - If $0 < t < 1$: distance is $\text{haversine}(P, \text{projPoint})$ where $\text{projPoint} = A + t(B - A)$.
3. Distance to the polyline is $\min_i d(P, S_i)$. Returns $\infty$ for empty polylines and $\text{haversine}(P, \text{polyline}[0])$ for single-point polylines.

### 2.3 Pune Metropolitan Boundaries (PMRDA Jurisdiction)

Coordinates must satisfy:

- Latitude: $18.25^\circ\text{N} \le \text{lat} \le 18.75^\circ\text{N}$
- Longitude: $73.65^\circ\text{E} \le \text{lng} \le 74.15^\circ\text{E}$

---

## 3. Context Signals Engine (`src/core/signals`)

Time is converted deterministically into Asia/Kolkata (IST, UTC+5:30) minutes of the day $M \in [0, 1439]$:

$$M = (\text{utcHours} \cdot 60 + \text{utcMinutes} + 330) \pmod{1440}$$

| Signal          | Active Condition                                                                     | Default Parameter             |
| :-------------- | :----------------------------------------------------------------------------------- | :---------------------------- |
| `isNight`       | $M \ge 1200$ (20:00 IST) OR $M \le 330$ (05:30 IST)                                  | 20:00 &mdash; 05:30 IST       |
| `isPeakTraffic` | $480 \le M \le 660$ (08:00&ndash;11:00) OR $1020 \le M \le 1260$ (17:00&ndash;21:00) | Morning & Evening commute     |
| `isRaining`     | $\text{precipitationMm} > 0.5\text{ mm/hr}$ OR rain condition code                   | $> 0.5\text{ mm}$             |
| `heavyRain`     | $\text{precipitationMm} \ge 10.0\text{ mm/hr}$ OR heavy monsoon downpour code        | $\ge 10.0\text{ mm}$          |
| `heatStress`    | $\text{tempC} \ge 38.0^\circ\text{C}$ OR active heat advisory alert                  | $\ge 38.0^\circ\text{C}$      |
| `hasAlert`      | $\text{alerts.length} > 0$                                                           | Meteorological alerts present |

---

## 4. Known Hazard Index & Route Safety Engine (`src/core/safety`)

### 4.1 Hazard Corridor Buffer

Accident blackspots and citizen reports are evaluated using dynamic matching radii based on coordinate verification:

- **Verified Coordinates (`coordinatesVerified: true`)**: Evaluated within a **$150\text{ meter}$** corridor buffer (`VERIFIED_MATCH_RADIUS_METERS`).
- **Unverified / Geocoded Coordinates (`coordinatesVerified: false`)**: Evaluated within an expanded **$300\text{ meter}$** corridor buffer (`UNVERIFIED_MATCH_RADIUS_METERS`) to account for geographic spatial uncertainty, accompanied by the explicit caveat `"Includes hazards with approximate location data (evaluated within a 300m radius)."`.
- **Corroborated Citizen Reports**: Evaluated within a **$150\text{ meter}$** buffer.

### 4.2 Blackspot Crash Tiers

Weight contributed by an official accident blackspot within its active buffer:

| Historical Crash Count / Evidence Level | Hazard Weight                       |
| :-------------------------------------- | :---------------------------------- |
| $\ge 30$ crashes                        | 40                                  |
| $20 - 29$ crashes                       | 30                                  |
| $10 - 19$ crashes                       | 20                                  |
| $1 - 9$ crashes                         | 10                                  |
| `listed_only` or unstated crash count   | 10 (Documented lowest-tier default) |

### 4.3 Citizen Report Decay & Filtering

- **Status Filter**: Reports with status `'unverified'` contribute **0 weight**. Only `'corroborated'` and `'official'` reports are scored.
- **Max Age Limit**: Reports with age $> 60\text{ days}$ contribute **0 weight**.
- **Exponential Recency Decay** (7-day half-life):
  $$\text{ageDays} = \frac{\text{now} - \text{reportCreatedAt}}{86{,}400{,}000}$$
  $$\text{recencyDecay} = 0.5^{(\text{ageDays} / 7.0)}$$
  $$\text{reportWeight} = \text{severity} \cdot 10 \cdot \text{recencyDecay} \quad (\text{severity} \in \{1, 2, 3\})$$

### 4.4 Environmental Multiplier

During `heavyRain` conditions, vulnerable travel modes (`two_wheeler`, `walk`) receive a multiplier of **$1.35\times$** on total hazard weight to reflect heightened exposure to hidden potholes and waterlogged manholes.

### 4.5 Index Normalization & Confidence

$$\text{HazardIndex} = \min(100, \text{round}(\text{rawHazardSum}))$$

- If $\text{breakdown.length} = 0$: $\text{HazardIndex} = 0$, confidence = `'low'`, caveat = _"No recorded hazards is not the same as safe."_
- If $\text{breakdown.length} > 0$: confidence = `'high'`.

### 4.6 Route Choice & Detour Tradeoff (`chooseRoutes`)

$$\text{MaxAllowedDuration} = \text{Duration}_{\text{fastest}} \cdot (1 + \text{maxDetourFraction}) \quad (\text{default maxDetourFraction} = 0.25)$$

1. Routes exceeding $+25\%$ detour are ineligible for safe-route recommendation.
2. The route with the lowest hazard index among eligible candidates is selected as `fewestHazards`.
3. Output explicitly details `minutesAdded` and `hazardPointsAvoided`.

---

## 5. Bayesian Multi-Criteria Place Ranking (`src/core/ranking`)

### 5.1 Base Weights & Context Boosts

| Criterion               | Base Weight | Context Adjustment                                                     |
| :---------------------- | :---------- | :--------------------------------------------------------------------- |
| **Rating (Bayesian)**   | 0.25        | Fixed                                                                  |
| **Affordability Fit**   | 0.20        | Fixed                                                                  |
| **Accessibility Match** | 0.15        | $+0.10$ boost when `ctx.accessibilityNeeds === true`                   |
| **Proximity Decay**     | 0.15        | Fixed (decay across 10 km)                                             |
| **Weather Suitability** | 0.10        | Penalizes outdoor in rain/heat; favors indoor shelter                  |
| **Operating Hours**     | 0.05        | Open now ($1.0$) vs closed ($0.1$)                                     |
| **Hazard Avoidance**    | 0.10        | $+0.08$ boost at night; $+0.12$ boost for `cautious` safety preference |

### 5.2 Bayesian Smoothed Rating Formula

To prevent single-review 5-star outliers from outranking established favorites:

$$R_{\text{Bayes}} = \frac{v \cdot R + m \cdot C}{v + m}$$

- $v$: Place review count (`ratingCount`).
- $R$: Place average review rating (1.0 &ndash; 5.0).
- $m$: Prior review count weight (default $m = 20$).
- $C$: Prior mean rating. Computed by blending candidate set ratings with baseline prior ($3.8$):
  $$C = \frac{\sum_{i=1}^n R_i + 3.8}{n + 1}$$
- Normalized to $0.0 - 1.0$: $\text{NormalizedRating} = R_{\text{Bayes}} / 5.0$.

### 5.3 Proximity Decay

$$\text{ProximityScore} = \max\left(0, 1 - \frac{\text{distanceMeters}}{10{,}000}\right)$$

### 5.4 Weather Suitability

- In monsoon rain: Indoor venues score $1.0$; outdoor venues score $0.2$.
- In heat stress ($> 38^\circ\text{C}$): Outdoor walks $> 500\text{m}$ score $0.3$; indoor venues score $1.0$.
- Normal conditions: All venues score $1.0$.

### 5.5 Hazard Avoidance

Within 500m buffer of place:

- 0 blackspots: $1.0$ (safe)
- 1 blackspot: $0.6$
- 2 blackspots: $0.3$
- $\ge 3$ blackspots: $0.0$

### 5.6 Missing Data Renormalization Rule

Any criterion lacking verified data is assigned `value: undefined` and `weight: 0`. It is **never** scored 0.

$$\text{TotalActiveWeight} = \sum_{i \in \text{valid}} w_i$$
$$w_i' = \frac{w_i}{\text{TotalActiveWeight}}$$
$$\text{Score} = \text{round}\left(100 \cdot \sum_{i \in \text{valid}} v_i \cdot w_i'\right)$$

If $\ge 4$ criteria are missing, place confidence is downgraded to `'low'`.

### 5.7 Stable Deterministic Tie-Breaking

Candidates are sorted by `score` descending. Exact score ties are broken alphabetically by `place.id` ascending, ensuring identical results across runs.

---

## 6. Multi-Dimensional Best-vs-Worst Comparison (`src/core/comparison`)

Compares candidates across 5 explicit dimensions:

1. **Rating**: Highest vs lowest Bayesian rating.
2. **Affordability**: Lowest price tier for low/medium budget; highest price tier for luxury budget.
3. **Accessibility**: Number of verified accessibility features (step-free entrance, accessible restroom, accessible parking).
4. **Safety / Hazard Exposure**: Proximity count of Pune Police accident blackspots within 500m.
5. **Cleanliness**: Proximity count of citizen cleanliness complaints within 500m.

### Data Sufficiency Rule for Cleanliness

Cleanliness comparison requires $\ge 2$ unique citizen reports in the vicinity (`config.minReportsForCleanliness = 2`). If fewer than 2 reports exist, status is `'insufficient_data'`, confidence is `'unknown'`, and no best/worst is declared.

---

## 7. Deterministic Rules-First Intent Classification (`src/core/intent`)

Fast, predictable keyword-scoring router with prompt-injection defenses:

- **Intents**: `find_food`, `find_stay`, `find_attraction`, `heritage_info`, `route_hazards`, `weather_now`, `report_issue`, `compare_places`, `unknown`.
- **Constraint Extraction**: Budget (`low`, `medium`, `high`, numerical `under N`), accessibility needs, time preference (`now`, `tonight`, `tomorrow`, `weekend`).
- **Prompt Injection Defense**: Regex patterns (`ignore previous instructions`, `system prompt`, `dan mode`, `<script>`, `drop table`) are quarantined to `intent: 'unknown'` and confidence `'unknown'` without crashing.
- **Ambiguity Rule**: Tied keyword matches degrade confidence to `'low'`, directing downstream controllers to consult the LLM fallback.

---

## 8. Transparent Verbalization Facts Synthesizer (`src/core/explain`)

Turns raw numerical output into structured explanation records:

- `summary`: Plain-language top-line takeaway.
- `topReasons`: Bulleted positive factors derived from verified metrics.
- `tradeoffs`: Explicit time-versus-safety trade-off (minutes added vs hazard points avoided).
- `dataQualityNotes`: Explicit notices of unverified coordinates, missing datasets, or sparse citizen report volumes.
- `verifiedMetrics`: Exact numbers passed to the generative verbalizer.
