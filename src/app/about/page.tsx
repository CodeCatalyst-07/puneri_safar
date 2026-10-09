import React from "react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About the data | Puneri Safar",
  description:
    "Data sources, evidence classifications, crash-prone spots, and scoring methodology used in Puneri Safar.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 bg-ground text-ink">
      {/* Navigation */}
      <div>
        <Link href="/" className="text-xs font-semibold text-sign-blue hover:underline">
          Back to map
        </Link>
      </div>

      {/* Main Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
          About the data
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          How Puneri Safar collects, checks, and displays road safety records, heritage sites, and
          citizen hazard reports.
        </p>
      </div>

      {/* Road Safety Notice */}
      <section
        role="region"
        aria-labelledby="safety-scope-heading"
        className="p-4 bg-surface border border-border border-l-4 border-l-crash-red space-y-2 text-xs sm:text-sm text-ink"
      >
        <h2 id="safety-scope-heading" className="font-bold text-ink">
          Road traffic safety, not personal security
        </h2>
        <p className="leading-relaxed text-ink-muted">
          Our safety calculations measure documented road-traffic collision spots (commonly called
          an accident &ldquo;black spot&rdquo; in official transportation audits) and physical risks
          like waterlogging.
        </p>
        <p className="leading-relaxed text-ink-muted font-medium">
          This is not a measure of crime or neighborhood personal safety. Neither the Pune Municipal
          Corporation nor the Pune City Police publishes open, geocoded crime feeds.
        </p>
        <p className="leading-relaxed text-ink-muted">
          A corridor with zero recorded hazards means only that no documented crash-prone spots
          match our buffer. It does not guarantee that a road is safe.
        </p>
      </section>

      {/* 1. Datasets Table */}
      <section aria-labelledby="sources-heading" className="space-y-3">
        <h2 id="sources-heading" className="text-base font-bold text-ink">
          Primary data sources
        </h2>
        <p className="text-xs text-ink-muted leading-relaxed">
          Every point and hazard on the map is classified by its source type and verification level:
        </p>

        <div className="overflow-x-auto border border-border bg-surface rounded-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-ground border-b border-border font-bold text-ink">
              <tr>
                <th className="p-2.5">Data source</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Citation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-ink-muted">
              <tr>
                <td className="p-2.5 font-semibold text-ink">Counted crash-prone spots</td>
                <td className="p-2.5">Official</td>
                <td className="p-2.5">
                  Pune City Police Road Safety Report (Jan 2026, 22+ crashes recorded)
                </td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-ink">Listed crash-prone spots</td>
                <td className="p-2.5">Official</td>
                <td className="p-2.5">Pune City Police Traffic Branch Audit (Jan 2022 list)</td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-ink">Heritage landmarks</td>
                <td className="p-2.5">Official</td>
                <td className="p-2.5">
                  Archaeological Survey of India (ASI) &amp; PMC Heritage Cell registers
                </td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-ink">Reports from people nearby</td>
                <td className="p-2.5">Citizen report</td>
                <td className="p-2.5">
                  Corroborated after 2 or more distinct contributors report nearby within 48h
                </td>
              </tr>
              <tr>
                <td className="p-2.5 font-semibold text-ink">Monsoon weather signals</td>
                <td className="p-2.5">Meteorological feed</td>
                <td className="p-2.5">Google Weather API (current conditions and precipitation)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Coordinate Buffers */}
      <section aria-labelledby="buffers-heading" className="space-y-3">
        <h2 id="buffers-heading" className="text-base font-bold text-ink">
          Matching distances and location privacy
        </h2>
        <ul className="space-y-2 text-xs sm:text-sm text-ink-muted list-disc list-inside leading-relaxed">
          <li>
            <strong>Verified intersections:</strong> Matched within a 150-meter corridor buffer.
          </li>
          <li>
            <strong>Approximate spots:</strong> Matched within a 300-meter corridor buffer to cover
            flyover approaches and bypass ramps.
          </li>
          <li>
            <strong>Citizen privacy:</strong> Submitted coordinates are rounded to 3 decimal places
            (~100 meters) to protect privacy.
          </li>
        </ul>
      </section>

      {/* 3. Scoring Method */}
      <section aria-labelledby="scoring-heading" className="space-y-3">
        <h2 id="scoring-heading" className="text-base font-bold text-ink">
          How place rankings and route choices work
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-ink-muted leading-relaxed">
          <p>
            Place recommendations use Bayesian rating smoothing. A venue with 5 stars from only 2
            reviews cannot outrank an established location with 4.5 stars from 3,000 reviews.
          </p>
          <p>
            Route comparisons evaluate documented crash-prone spot buffers against travel time. A
            detour is only recommended if it stays within 25% of the fastest travel time.
          </p>
        </div>
      </section>

      {/* 4. Google Services */}
      <section aria-labelledby="services-heading" className="space-y-3">
        <h2 id="services-heading" className="text-base font-bold text-ink">
          Google services used
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-ink-muted leading-relaxed">
          <p>
            <strong>Google Places API (New):</strong> Provides live venue hours, ratings, and
            physical wheelchair entrance data.
          </p>
          <p>
            <strong>Google Routes API:</strong> Computes alternate transit paths and encoded vector
            polylines.
          </p>
          <p>
            <strong>Google Weather API:</strong> Delivers current temperature and precipitation
            conditions.
          </p>
          <p>
            <strong>Google Maps JavaScript API:</strong> Renders the interactive vector map canvas.
          </p>
          <p>
            <strong>Google Gemini API:</strong> Used for understanding complex natural-language
            queries. All numbers, rankings, and route coordinates originate strictly from
            deterministic code.
          </p>
        </div>
      </section>
    </div>
  );
}
