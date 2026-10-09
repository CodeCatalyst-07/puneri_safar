"use client";

import React, { useState, useRef } from "react";
import { UserContext } from "@/core/types";
import { AssistantResponse } from "@/services/assistant";

export interface AssistantSectionProps {
  userContext: UserContext;
  onAssistantResponse?: (res: AssistantResponse) => void;
  selectedRouteType: "fastest" | "fewest_hazards";
  onSelectRoute: (type: "fastest" | "fewest_hazards") => void;
}

const EXAMPLE_CHIPS = [
  "Cheap vegetarian dinner near me tonight",
  "Safer way from Katraj to Hinjewadi",
  "Heritage places to visit",
  "Is it a good time to go out?",
];

export function AssistantSection({
  userContext,
  onAssistantResponse,
  selectedRouteType,
  onSelectRoute,
}: AssistantSectionProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const charCount = query.length;
  const maxChars = 500;

  const handleSend = async (messageText: string) => {
    const textToSend = messageText.trim();
    if (!textToSend) return;

    // Abort previous in-flight request if user submits again
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: textToSend,
          context: userContext,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(
            "Query rate limit reached (10 queries per minute). Please pause briefly before asking again."
          );
        } else {
          setErrorMessage(json.error?.message || "Failed to process query. Please try again.");
        }
        return;
      }

      if (json.success && json.data) {
        const assistantData = json.data as AssistantResponse;
        setResponse(assistantData);
        onAssistantResponse?.(assistantData);

        // Accessibility: Move focus to results area (WCAG 2.4.3 Focus Order)
        setTimeout(() => {
          resultsContainerRef.current?.focus();
        }, 100);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Normal cancellation
      }
      setErrorMessage(
        "Network error occurred while contacting assistant. Please verify your connection."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(query);
  };

  const handleChipClick = (chipText: string) => {
    setQuery(chipText);
    handleSend(chipText);
  };

  return (
    <div className="space-y-6">
      {/* Query Input Section */}
      <section
        id="explore"
        aria-labelledby="assistant-box-heading"
        className="p-6 rounded-xl border border-surface-border bg-surface shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2
              id="assistant-box-heading"
              className="text-xl sm:text-2xl font-bold text-foreground"
            >
              Ask Puneri Safar
            </h2>
            <p className="text-sm text-text-muted">
              Get context-aware recommendations, hazard-aware routing, and cultural heritage
              insights.
            </p>
          </div>

          {response?.weather && (
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800 text-xs font-medium self-start sm:self-auto"
              aria-label={`Current Pune weather: ${response.weather.tempC} degrees Celsius, ${response.weather.conditionCode}`}
            >
              <span aria-hidden="true">🌤️</span>
              <span>
                <b>{response.weather.tempC}°C</b> &bull;{" "}
                {response.weather.conditionCode.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>

        {/* Example Chips */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Quick example questions"
        >
          <span className="text-xs font-semibold text-text-muted">Try:</span>
          {EXAMPLE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              className="px-3 py-1 rounded-full text-xs font-medium bg-black/5 dark:bg-white/5 hover:bg-brand-primary/10 hover:text-brand-primary border border-surface-border transition-colors text-foreground min-h-[36px]"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div className="relative">
            <label htmlFor="assistant-input" className="sr-only">
              Ask Puneri Safar a question
            </label>
            <input
              id="assistant-input"
              type="text"
              required
              maxLength={maxChars}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Safer way from Katraj to Hinjewadi, or cheap vegetarian dinner near me"
              aria-describedby="assistant-counter"
              className="w-full px-4 py-3 pr-28 rounded-xl border border-surface-border bg-background text-foreground text-sm focus-visible:outline-none focus:ring-2 focus:ring-brand-primary min-h-[48px]"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <span
                id="assistant-counter"
                className="text-xs font-mono text-text-muted hidden sm:inline"
                aria-hidden="true"
              >
                {charCount}/{maxChars}
              </span>
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs min-h-[38px]"
              >
                {isLoading ? "Searching..." : "Send"}
              </button>
            </div>
          </div>
        </form>

        {/* Error / Rate Limit Banner */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-800 leading-relaxed"
          >
            {errorMessage}
          </div>
        )}
      </section>

      {/* Results Area (Live Region for Screen Readers) */}
      <section
        id="assistant-results"
        ref={resultsContainerRef}
        tabIndex={-1}
        role="region"
        aria-labelledby="results-heading"
        aria-live="polite"
        className="space-y-6 outline-none"
      >
        <h2 id="results-heading" className="sr-only">
          Assistant Results and Guidance
        </h2>

        {response && (
          <div className="p-6 rounded-xl border border-surface-border bg-surface shadow-xs space-y-6">
            {/* Header: Badge & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border/60 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    response.usedLlm
                      ? "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-300"
                      : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300"
                  }`}
                >
                  <span aria-hidden="true">{response.usedLlm ? "✦" : "✓"}</span>
                  <span>{response.usedLlm ? "Answered with Gemini" : "Answered by rules"}</span>
                </span>
                <span className="text-xs text-text-muted">
                  {response.usedLlm
                    ? "Multi-turn tool routing backed by grounded Pune civic facts"
                    : "Deterministic rules evaluation with zero LLM hallucination"}
                </span>
              </div>

              {response.sources.length > 0 && (
                <div className="text-xs text-text-muted">
                  Sources:{" "}
                  <span className="font-medium text-foreground">{response.sources.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Natural Language Answer */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="text-base text-foreground font-medium leading-relaxed whitespace-pre-line">
                {response.answer}
              </div>
            </div>

            {/* Caveats & Honesty Notes */}
            {response.caveats.length > 0 && (
              <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300/60 dark:border-amber-800/60 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span aria-hidden="true">⚠️</span>
                  <span>Data Honesty &amp; Transparency Caveats</span>
                </div>
                <ul className="list-disc list-inside text-xs text-amber-900/90 dark:text-amber-200/90 space-y-0.5">
                  {response.caveats.map((caveat, i) => (
                    <li key={i}>{caveat}</li>
                  ))}
                  <li className="font-semibold">
                    Important: No recorded hazards along a corridor is not the same as guaranteed
                    safety. Always remain vigilant.
                  </li>
                </ul>
              </div>
            )}

            {/* ROUTE COMPARISON RESULTS */}
            {response.routes && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">
                    Corridor Safety Evaluation
                  </h3>
                  <span className="text-xs text-text-muted">
                    Evaluated against documented Pune Police crash blackspots
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option 1: Fastest Route */}
                  <button
                    type="button"
                    onClick={() => onSelectRoute("fastest")}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedRouteType === "fastest"
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500"
                        : "border-surface-border bg-background hover:border-blue-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                        Option A &bull; Fastest Corridor
                      </span>
                      {selectedRouteType === "fastest" && (
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded">
                          Selected on map
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-foreground">
                        {Math.round(response.routes.fastest.durationSeconds / 60)} min
                      </span>
                      <span className="text-xs text-text-muted">
                        ({(response.routes.fastest.distanceMeters / 1000).toFixed(1)} km)
                      </span>
                    </div>

                    <div className="mt-3 text-xs space-y-1">
                      <div>
                        Known Hazard Index:{" "}
                        <span className="font-bold text-red-600">
                          {response.routes.fastest.hazardIndex}/100
                        </span>
                      </div>
                      <div className="text-text-muted">
                        {response.routes.fastest.breakdown.length > 0
                          ? `${response.routes.fastest.breakdown.length} documented hazard corridor(s) matched`
                          : "No documented blackspots in corridor buffer"}
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Fewest Known Hazards */}
                  <button
                    type="button"
                    onClick={() => onSelectRoute("fewest_hazards")}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedRouteType === "fewest_hazards"
                        ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500"
                        : "border-surface-border bg-background hover:border-emerald-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                        Option B &bull; Fewest Known Hazards
                      </span>
                      {selectedRouteType === "fewest_hazards" && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                          Selected on map
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-foreground">
                        {Math.round(response.routes.fewestHazards.durationSeconds / 60)} min
                      </span>
                      <span className="text-xs text-text-muted">
                        ({(response.routes.fewestHazards.distanceMeters / 1000).toFixed(1)} km)
                      </span>
                    </div>

                    <div className="mt-3 text-xs space-y-1">
                      <div>
                        Known Hazard Index:{" "}
                        <span className="font-bold text-emerald-600">
                          {response.routes.fewestHazards.hazardIndex}/100
                        </span>
                      </div>
                      <div className="text-text-muted">
                        {response.routes.fewestHazards.breakdown.length > 0
                          ? `${response.routes.fewestHazards.breakdown.length} documented hazard corridor(s)`
                          : "Zero documented blackspots on detour"}
                      </div>
                    </div>
                  </button>
                </div>

                {/* Tradeoff Explanation */}
                <div className="p-3.5 rounded-lg bg-black/5 dark:bg-white/5 border border-surface-border text-xs leading-relaxed">
                  <strong>Tradeoff Analysis: </strong>
                  {response.routes.tradeoff.minutesAdded > 0 ? (
                    <span>
                      The safer corridor adds <b>{response.routes.tradeoff.minutesAdded} minutes</b>{" "}
                      of travel time but avoids{" "}
                      <b>{response.routes.tradeoff.hazardPointsAvoided} hazard points</b>.{" "}
                      {response.routes.tradeoff.rationale}
                    </span>
                  ) : (
                    <span>{response.routes.tradeoff.rationale}</span>
                  )}
                </div>

                {/* Detailed Hazard Contributors for Selected Route */}
                {(() => {
                  const activeRoute =
                    selectedRouteType === "fastest"
                      ? response.routes.fastest
                      : response.routes.fewestHazards;
                  if (!activeRoute.breakdown || activeRoute.breakdown.length === 0) return null;

                  return (
                    <div className="mt-3 p-3 rounded-lg border border-surface-border bg-background space-y-2 text-xs">
                      <span className="font-bold text-foreground">
                        Documented Hazards along Selected Route ({activeRoute.breakdown.length}):
                      </span>
                      <ul className="space-y-1">
                        {activeRoute.breakdown.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start justify-between gap-2 text-text-muted"
                          >
                            <div>
                              <strong className="text-red-600">▲ {item.name}</strong> &mdash;{" "}
                              <span>{item.distanceMeters}m from route path</span>
                            </div>
                            <span className="text-[11px] font-mono text-text-muted/80">
                              {item.source}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* PLACES RECOMMENDATIONS */}
            {response.places && response.places.length > 0 && (
              <div className="space-y-4 pt-2">
                <h3 className="text-base font-bold text-foreground">
                  Ranked Places in Pune ({response.places.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {response.places.map((rp, idx) => {
                    const priceString =
                      rp.place.priceLevel !== undefined && rp.place.priceLevel !== null
                        ? "₹".repeat(Math.max(1, rp.place.priceLevel))
                        : "No data";

                    const wheelchairEntrance = rp.place.accessibility?.wheelchairEntrance;
                    const accessibilityLabel =
                      wheelchairEntrance === true
                        ? "Wheelchair Accessible"
                        : wheelchairEntrance === false
                          ? "Not accessible"
                          : "No data";

                    return (
                      <article
                        key={rp.place.id || idx}
                        className="p-4 rounded-xl border border-surface-border bg-background flex flex-col justify-between hover:border-brand-primary/40 transition-colors shadow-xs"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-brand-primary">
                                #{idx + 1} Recommendation
                              </span>
                              <h4 className="text-base font-bold text-foreground mt-0.5">
                                {rp.place.name}
                              </h4>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-black text-brand-primary">
                                {rp.score}
                              </span>
                              <span className="text-xs text-text-muted">/100</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-text-muted">
                            <span>
                              Rating:{" "}
                              <b>
                                {rp.place.rating !== undefined ? `${rp.place.rating}/5` : "No data"}
                              </b>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Price: <b>{priceString}</b>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Access: <b>{accessibilityLabel}</b>
                            </span>
                          </div>

                          {rp.reasons.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-surface-border/50 text-xs text-text-muted space-y-1">
                              {rp.reasons.slice(0, 3).map((reason, rIdx) => (
                                <p key={rIdx} className="flex items-center gap-1.5">
                                  <span aria-hidden="true" className="text-brand-emerald">
                                    ✓
                                  </span>
                                  <span>{reason}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* "Why This?" Disclosure per Criterion */}
                        {rp.breakdown && rp.breakdown.length > 0 && (
                          <details className="mt-4 pt-3 border-t border-surface-border text-xs group">
                            <summary className="font-semibold text-brand-primary cursor-pointer hover:underline list-none flex items-center justify-between">
                              <span>Why this? (MCDA Criteria Breakdown)</span>
                              <span className="text-text-muted group-open:rotate-180 transition-transform">
                                ▼
                              </span>
                            </summary>
                            <div className="mt-2.5 space-y-1.5 p-2.5 rounded bg-black/5 dark:bg-white/5">
                              {rp.breakdown.map((crit, cIdx) => (
                                <div key={cIdx} className="flex items-center justify-between gap-2">
                                  <span className="text-text-muted">{crit.criterion}:</span>
                                  <span className="font-medium text-foreground text-right">
                                    {crit.reason}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
