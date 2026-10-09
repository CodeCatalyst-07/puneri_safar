import React from "react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About & Data Honesty | Puneri Safar",
  description:
    "Primary sources, evidence levels, scoring methodology, and Google services used in Puneri Safar.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline"
        >
          <span aria-hidden="true">&larr;</span> Back to Explorer
        </Link>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          About &amp; Data Honesty
        </h1>
        <p className="text-base text-text-muted leading-relaxed">
          At Puneri Safar, data honesty is non-negotiable. We never fabricate numbers, embellish
          safety ratings, or label unverified estimates as official records.
        </p>
      </div>

      {/* Critical Safety Notice Alert */}
      <section
        role="region"
        aria-labelledby="safety-scope-heading"
        className="p-5 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-950 dark:text-red-200 space-y-2"
      >
        <h2 id="safety-scope-heading" className="text-base font-bold flex items-center gap-2">
          <span aria-hidden="true">⚠️</span>
          <span>Important: Road Safety vs. Personal Safety</span>
        </h2>
        <p className="text-xs sm:text-sm leading-relaxed">
          The <strong>Known Hazard Index</strong> in Puneri Safar measures{" "}
          <strong>solely documented road traffic collision blackspots</strong> and physical
          environmental risks (such as monsoon waterlogging).
        </p>
        <p className="text-xs sm:text-sm leading-relaxed font-semibold">
          It is NOT a measure of crime, personal security, or neighborhood safety. Neither the Pune
          Municipal Corporation (PMC) nor the Pune City Police publishes open, geocoded crime feeds.
        </p>
        <p className="text-xs sm:text-sm leading-relaxed">
          A corridor with zero recorded hazards indicates only that no documented blackspots fall
          within the matching buffer; <strong>it does not guarantee that the route is safe</strong>.
        </p>
      </section>

      {/* 1. Primary Datasets & Evidence Levels */}
      <section aria-labelledby="datasets-heading" className="space-y-4">
        <h2 id="datasets-heading" className="text-xl sm:text-2xl font-bold text-foreground">
          1. Datasets &amp; Primary Evidence Levels
        </h2>
        <p className="text-sm text-text-muted leading-relaxed">
          Every point of interest and hazard marker is classified by its source provenance and
          verification status:
        </p>

        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-black/5 dark:bg-white/5 border-b border-surface-border font-bold text-foreground">
              <tr>
                <th className="p-3">Dataset</th>
                <th className="p-3">Official / Citizen</th>
                <th className="p-3">Evidence Level</th>
                <th className="p-3">Primary Source Citation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border text-text-muted">
              <tr>
                <td className="p-3 font-semibold text-foreground">Accident Blackspots (Counted)</td>
                <td className="p-3">Official Municipal</td>
                <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">
                  counted (22+ crashes)
                </td>
                <td className="p-3">
                  Pune City Police Road Safety Report (Jan 2026 via Punekar News)
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-foreground">Accident Blackspots (Listed)</td>
                <td className="p-3">Official Municipal</td>
                <td className="p-3 font-mono text-amber-600 dark:text-amber-400">
                  listed_only (weight 10)
                </td>
                <td className="p-3">Punekar News Road Safety Audit (15 Jan 2022)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-foreground">Heritage Landmarks</td>
                <td className="p-3">Official Cultural</td>
                <td className="p-3 font-mono text-sky-600 dark:text-sky-400">verified PMC/ASI</td>
                <td className="p-3">
                  Archaeological Survey of India &amp; PMC Heritage Cell registers
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-foreground">Citizen Hazard Reports</td>
                <td className="p-3">Crowdsourced Citizen</td>
                <td className="p-3 font-mono text-orange-600 dark:text-orange-400">
                  unverified &rarr; corroborated
                </td>
                <td className="p-3">
                  Verified when &ge;2 distinct reporters report nearby within 48h
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-foreground">Monsoon Weather</td>
                <td className="p-3">Official Sensor Feed</td>
                <td className="p-3 font-mono text-purple-600 dark:text-purple-400">
                  live meteorological
                </td>
                <td className="p-3">Google Weather API (aggregated ~1 km grid cells)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Approximate Coordinate Handling */}
      <section aria-labelledby="coords-heading" className="space-y-4">
        <h2 id="coords-heading" className="text-xl sm:text-2xl font-bold text-foreground">
          2. Approximate Coordinate Buffers
        </h2>
        <p className="text-sm text-text-muted leading-relaxed">
          Because Indian municipal blackspot releases name intersections (e.g. &ldquo;Katraj
          Chowk&rdquo;, &ldquo;Navale Bridge Chowk&rdquo;) rather than micro-meter GPS pins, we use
          conservative matching radii:
        </p>
        <ul className="list-disc list-inside text-xs sm:text-sm text-text-muted space-y-2 leading-relaxed">
          <li>
            <strong>Verified coordinates:</strong> Evaluated within a{" "}
            <strong>150-meter corridor buffer</strong>.
          </li>
          <li>
            <strong>Approximate / Geocoded spots:</strong> Evaluated within an expanded{" "}
            <strong>300-meter corridor buffer</strong> to ensure hazards near approach ramps and
            flyovers are captured.
          </li>
          <li>
            <strong>Citizen Privacy:</strong> Submitted citizen coordinates are always rounded to 3
            decimal places (~100m) to preserve contributor anonymity.
          </li>
        </ul>
      </section>

      {/* 3. Scoring Methodology Summary */}
      <section aria-labelledby="scoring-heading" className="space-y-4">
        <h2 id="scoring-heading" className="text-xl sm:text-2xl font-bold text-foreground">
          3. Multi-Criteria Decision Analysis (MCDA) Scoring
        </h2>
        <p className="text-sm text-text-muted leading-relaxed">
          All place rankings and corridor comparisons are computed purely in deterministic
          TypeScript code:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="p-4 rounded-xl border border-surface-border bg-surface space-y-2">
            <h3 className="font-bold text-foreground">Bayesian Rating Smoothing</h3>
            <p className="text-text-muted leading-relaxed">
              New venues with 5 stars from only 2 reviews cannot outrank vetted institutions with
              4.5 stars from 3,000 reviews. We compute R_bayesian = (v &times; R + m &times; C) / (v
              + m) with m = 25 prior reviews and Pune mean rating C = 3.8.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-surface-border bg-surface space-y-2">
            <h3 className="font-bold text-foreground">Normalized Distance &amp; Detour Limit</h3>
            <p className="text-text-muted leading-relaxed">
              Routes are penalized based on distance from known blackspots. Detour recommendations
              are strictly capped at <strong>+25% additional travel time</strong> over the fastest
              route, ensuring practical commutes.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Google Services Used & Why */}
      <section aria-labelledby="google-heading" className="space-y-4">
        <h2 id="google-heading" className="text-xl sm:text-2xl font-bold text-foreground">
          4. Google Services Used &amp; Justification
        </h2>

        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-surface-border bg-surface space-y-1 text-xs sm:text-sm">
            <h3 className="font-bold text-foreground">Google Gemini API (`@google/genai`)</h3>
            <p className="text-text-muted leading-relaxed">
              Performs structured citizen hazard classification with strict Zod validation. For
              complex multi-hop queries, executes function calling across 5 grounded tools
              (`search_places`, `get_weather`, `get_route_options`, `get_heritage_info`,
              `compare_places`).{" "}
              <strong>
                Gemini never supplies numbers from memory; all numbers originate exclusively from
                deterministic core math.
              </strong>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface space-y-1 text-xs sm:text-sm">
            <h3 className="font-bold text-foreground">Google Places API (New)</h3>
            <p className="text-text-muted leading-relaxed">
              Powers real-time Pune venue metadata, wheelchair accessibility attributes, and opening
              hours with explicit FieldMasks.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface space-y-1 text-xs sm:text-sm">
            <h3 className="font-bold text-foreground">Google Routes API</h3>
            <p className="text-text-muted leading-relaxed">
              Calculates alternate routes with precise encoded polyline vectors. Evaluated against
              Pune Police accident blackspots to recommend safer travel corridors for pedestrians
              and two-wheelers.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface space-y-1 text-xs sm:text-sm">
            <h3 className="font-bold text-foreground">Google Weather API</h3>
            <p className="text-text-muted leading-relaxed">
              Feeds real-time temperature, precipitation, and monsoon alerts into context-aware
              travel advisories.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface space-y-1 text-xs sm:text-sm">
            <h3 className="font-bold text-foreground">Google Maps JavaScript API</h3>
            <p className="text-text-muted leading-relaxed">
              Provides client-side vector map rendering, marker overlays, and route polyline
              comparisons.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-border bg-surface space-y-1 text-xs sm:text-sm">
            <h3 className="font-bold text-foreground">Google Cloud Firestore (Optional)</h3>
            <p className="text-text-muted leading-relaxed">
              Persistent storage for citizen hazard reports. Designed with fail-safe fallback to an
              in-memory repository if Firebase credentials are not configured.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
