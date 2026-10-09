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

const EXAMPLE_QUESTIONS = [
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
            "Query limit reached. Please wait 60 seconds before asking another question."
          );
        } else {
          setErrorMessage(
            json.error?.message || "Could not process request. Please check your query and retry."
          );
        }
        return;
      }

      if (json.success && json.data) {
        const assistantData = json.data as AssistantResponse;
        setResponse(assistantData);
        onAssistantResponse?.(assistantData);

        setTimeout(() => {
          resultsContainerRef.current?.focus();
        }, 100);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setErrorMessage("Network connection failed. Please verify your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(query);
  };

  const handleChipClick = (questionText: string) => {
    setQuery(questionText);
    handleSend(questionText);
  };

  return (
    <div className="space-y-4">
      {/* 1. Input Box & Ask Button */}
      <section
        id="explore"
        aria-label="Question prompt"
        className="bg-surface border border-border p-3.5 rounded-sm"
      >
        <form onSubmit={handleFormSubmit} className="space-y-2">
          <label htmlFor="assistant-input" className="block text-xs font-semibold text-ink-muted">
            Ask about places, routes, or road conditions
          </label>
          <div className="flex gap-2">
            <input
              id="assistant-input"
              type="text"
              required
              maxLength={maxChars}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Safer way from Katraj to Hinjewadi"
              aria-describedby="assistant-counter"
              className="flex-1 px-3 py-2 text-sm text-ink bg-ground border border-border rounded-sm focus:outline-hidden focus:ring-2 focus:ring-sign-blue min-h-[44px]"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-5 py-2 text-xs font-semibold bg-ink text-white rounded-sm hover:bg-sign-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {isLoading ? "Searching" : "Ask"}
            </button>
          </div>
          <div className="flex justify-end text-[11px] text-ink-muted">
            <span id="assistant-counter" aria-hidden="true">
              {charCount} / {maxChars}
            </span>
          </div>
        </form>

        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-3 p-2.5 text-xs text-crash-red bg-white border-l-4 border-crash-red font-medium"
          >
            {errorMessage}
          </div>
        )}
      </section>

      {/* 2. Empty State (Invitation, not decoration) */}
      {!response && !isLoading && (
        <section
          aria-label="Suggested questions"
          className="bg-surface border border-border p-4 rounded-sm space-y-3"
        >
          <div>
            <h2 lang="mr" className="text-lg font-extrabold text-ink">
              कुठे जायचंय?
            </h2>
            <p className="text-xs font-semibold text-ink-muted">Where do you want to go?</p>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              Explore, experience and navigate Pune &mdash; smarter and safer.
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            {EXAMPLE_QUESTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleChipClick(item)}
                className="w-full text-left p-2.5 text-xs font-semibold text-ink bg-ground hover:bg-white hover:text-sign-blue border border-border rounded-sm transition-colors min-h-[44px]"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3. Results Container (aria-live="polite") */}
      <section
        id="assistant-results"
        ref={resultsContainerRef}
        tabIndex={-1}
        role="region"
        aria-label="Guidance and results"
        aria-live="polite"
        className="space-y-4 outline-hidden"
      >
        {response && (
          <div className="space-y-4">
            {/* Header: Grounded status & Weather */}
            <div className="bg-surface border border-border p-3 rounded-sm flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-ink-muted">
                {response.usedLlm ? "Answered with Gemini" : "Answered by rules"}
              </span>

              {response.weather && (
                <span className="text-ink font-medium flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 text-sign-blue"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                  <span>
                    Pune weather: {response.weather.tempC}°C,{" "}
                    {response.weather.conditionCode.replace(/_/g, " ")}
                  </span>
                </span>
              )}
            </div>

            {/* Answer Text */}
            <div className="bg-surface border border-border p-4 rounded-sm">
              <p className="text-sm text-ink leading-relaxed whitespace-pre-line font-normal">
                {response.answer}
              </p>
            </div>

            {/* Caveats with Amber Left Edge */}
            {response.caveats.length > 0 && (
              <div className="p-3 bg-surface border border-border border-l-4 border-l-caution rounded-sm space-y-1.5 text-xs text-ink">
                <div className="font-bold flex items-center gap-1.5 text-ink">
                  <svg
                    className="w-4 h-4 text-ink shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Important road safety notes</span>
                </div>
                <ul className="space-y-1 text-ink-muted list-disc list-inside">
                  {response.caveats.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                  <li className="font-semibold text-ink">
                    No recorded hazards is not the same as safe. Always check active road
                    conditions.
                  </li>
                </ul>
              </div>
            )}

            {/* ROUTE COMPARISON (Two-Row Road Sign Comparison) */}
            {response.routes && (
              <div className="bg-surface border border-border p-4 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink">Route options</h3>
                  <span className="text-xs text-ink-muted">Compared against crash-prone spots</span>
                </div>

                <div className="space-y-2">
                  {/* Row 1: Fastest Route */}
                  <button
                    type="button"
                    onClick={() => onSelectRoute("fastest")}
                    className={`w-full text-left p-3 border rounded-sm transition-colors ${
                      selectedRouteType === "fastest"
                        ? "border-route-fast bg-ground"
                        : "border-border bg-surface hover:bg-ground"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-route-fast">Option 1: Fastest route</span>
                      {selectedRouteType === "fastest" && (
                        <span className="text-[11px] font-bold text-route-fast bg-white px-2 py-0.5 border border-route-fast">
                          Shown on map
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-3 text-xs text-ink">
                      <span className="text-lg font-extrabold">
                        {Math.round(response.routes.fastest.durationSeconds / 60)} min
                      </span>
                      <span>{(response.routes.fastest.distanceMeters / 1000).toFixed(1)} km</span>
                      <span className="text-ink-muted">
                        Hazard index: {response.routes.fastest.hazardIndex}/100
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {response.routes.fastest.breakdown.length > 0
                        ? `${response.routes.fastest.breakdown.length} documented crash-prone spot(s) along route`
                        : "No documented crash-prone spots along route buffer"}
                    </p>
                  </button>

                  {/* Row 2: Fewer Known Hazards Route */}
                  <button
                    type="button"
                    onClick={() => onSelectRoute("fewest_hazards")}
                    className={`w-full text-left p-3 border rounded-sm transition-colors ${
                      selectedRouteType === "fewest_hazards"
                        ? "border-route-green bg-ground"
                        : "border-border bg-surface hover:bg-ground"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-route-green">Option 2: Fewer known hazards</span>
                      {selectedRouteType === "fewest_hazards" && (
                        <span className="text-[11px] font-bold text-route-green bg-white px-2 py-0.5 border border-route-green">
                          Shown on map
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-3 text-xs text-ink">
                      <span className="text-lg font-extrabold text-route-green">
                        {Math.round(response.routes.fewestHazards.durationSeconds / 60)} min
                      </span>
                      <span>
                        {(response.routes.fewestHazards.distanceMeters / 1000).toFixed(1)} km
                      </span>
                      <span className="text-ink-muted">
                        Hazard index: {response.routes.fewestHazards.hazardIndex}/100
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {response.routes.fewestHazards.breakdown.length > 0
                        ? `${response.routes.fewestHazards.breakdown.length} documented crash-prone spot(s)`
                        : "Zero documented crash-prone spots on detour"}
                    </p>
                  </button>
                </div>

                {/* Tradeoff Explanation */}
                <div className="p-2.5 bg-ground border border-border text-xs text-ink leading-relaxed">
                  <strong>Tradeoff: </strong>
                  {response.routes.tradeoff.minutesAdded > 0 ? (
                    <span>
                      Adds {response.routes.tradeoff.minutesAdded} minutes of travel time and avoids{" "}
                      {response.routes.tradeoff.hazardPointsAvoided} hazard points.{" "}
                      {response.routes.tradeoff.rationale}
                    </span>
                  ) : (
                    <span>{response.routes.tradeoff.rationale}</span>
                  )}
                </div>

                {/* Active Route Hazard Breakdown in Text */}
                {(() => {
                  const active =
                    selectedRouteType === "fastest"
                      ? response.routes.fastest
                      : response.routes.fewestHazards;
                  if (!active.breakdown || active.breakdown.length === 0) return null;
                  return (
                    <div className="pt-2 border-t border-border space-y-1.5 text-xs">
                      <span className="font-semibold text-ink">
                        Documented crash-prone spots on selected route:
                      </span>
                      <ul className="space-y-1">
                        {active.breakdown.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-baseline justify-between gap-2 text-ink-muted"
                          >
                            <span className="text-crash-red font-semibold">{item.name}</span>
                            <span className="text-[11px]">
                              {item.distanceMeters}m from corridor
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* PLACES LIST (List rows separated by dividers, NOT cards) */}
            {response.places && response.places.length > 0 && (
              <div className="bg-surface border border-border p-4 rounded-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-sm font-bold text-ink">Places ({response.places.length})</h3>
                  <span className="text-xs text-ink-muted">Ranked by Bayesian review score</span>
                </div>

                <div className="divide-y divide-border">
                  {response.places.map((rp, idx) => {
                    const priceString =
                      rp.place.priceLevel !== undefined &&
                      rp.place.priceLevel !== null &&
                      rp.place.priceLevel > 0
                        ? "₹".repeat(rp.place.priceLevel)
                        : "No data";

                    const wheelchairEntrance = rp.place.accessibility?.wheelchairEntrance;
                    const accessText =
                      wheelchairEntrance === true
                        ? "Wheelchair accessible"
                        : wheelchairEntrance === false
                          ? "Not step-free"
                          : "No data";

                    return (
                      <article
                        key={rp.place.id || idx}
                        className="py-3 first:pt-0 last:pb-0 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-ink">{rp.place.name}</h4>
                            <p className="text-xs text-ink-muted mt-0.5">
                              Rating{" "}
                              {rp.place.rating !== undefined ? `${rp.place.rating}/5` : "No data"},
                              Price {priceString}, {accessText}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-extrabold text-ink">{rp.score}</span>
                            <span className="text-xs text-ink-muted">/100</span>
                          </div>
                        </div>

                        {rp.reasons.length > 0 && (
                          <p className="text-xs text-ink-muted leading-relaxed">
                            {rp.reasons.slice(0, 2).join(". ")}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1">
                          <span>Google Maps data</span>
                          {rp.breakdown && rp.breakdown.length > 0 && (
                            <details className="inline-block text-sign-blue hover:underline cursor-pointer">
                              <summary className="font-semibold list-none">Why this?</summary>
                              <div className="mt-1.5 p-2 bg-ground text-ink border border-border space-y-1">
                                {rp.breakdown.map((crit, cIdx) => (
                                  <div key={cIdx} className="flex justify-between gap-2">
                                    <span className="text-ink-muted">{crit.criterion}:</span>
                                    <span className="font-medium text-right">{crit.reason}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
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
