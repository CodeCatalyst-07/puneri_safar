"use client";

import React, { useState, useRef } from "react";
import { UserContext } from "@/core/types";
import { AssistantResponse } from "@/services/assistant";
import { UserContextState } from "./useUserContext";
import { ContextPanel } from "./ContextPanel";

export interface AssistantSectionProps {
  userContext: UserContext;
  contextState: UserContextState;
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
  contextState,
  onAssistantResponse,
  selectedRouteType,
  onSelectRoute,
}: AssistantSectionProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const charCount = query.length;
  const maxChars = 500;

  const handleSend = async (messageText: string) => {
    const textToSend = messageText.trim();
    if (!textToSend) {
      setValidationError("Type a question first");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setValidationError(null);
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

  const handleNewQuestion = () => {
    setResponse(null);
    setQuery("");
    setValidationError(null);
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      {/* 1. Large Question Input FIRST (min 48px, ink button always enabled-looking) */}
      <form onSubmit={handleFormSubmit} className="space-y-1">
        <label htmlFor="assistant-input" className="sr-only">
          Ask about food, routes, heritage or weather in Pune
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="assistant-input"
            type="text"
            maxLength={maxChars}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="Ask about food, routes, heritage or weather in Pune"
            aria-describedby={charCount >= 400 ? "assistant-counter" : undefined}
            className="flex-1 px-3.5 py-2.5 text-base text-ink bg-white border border-ink/40 rounded-[4px] focus:outline-hidden focus:ring-2 focus:ring-sign-blue min-h-[48px]"
          />
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-semibold bg-ink text-white rounded-[4px] hover:bg-sign-blue transition-colors min-h-[48px] shrink-0"
          >
            {isLoading ? "Searching" : "Ask"}
          </button>
        </div>

        {/* Counter ONLY after 400 characters */}
        {charCount >= 400 && (
          <div className="flex justify-end text-xs text-ink-muted">
            <span id="assistant-counter" aria-live="polite">
              {charCount} / {maxChars}
            </span>
          </div>
        )}

        {/* Validation or API error messages */}
        {validationError && (
          <p role="status" aria-live="polite" className="text-xs text-crash-red font-semibold pt-1">
            {validationError}
          </p>
        )}
        {errorMessage && (
          <div role="alert" aria-live="polite" className="text-xs text-crash-red font-semibold pt-1">
            {errorMessage}
          </div>
        )}
      </form>

      {/* 2. Trip Settings Compact Summary Row & Disclosure */}
      <ContextPanel contextState={contextState} />

      {/* 3. Example Questions List (Hidden when results exist, New question button to restore) */}
      {!response && !isLoading ? (
        <div className="space-y-3 pt-2">
          <div>
            <h2 lang="mr" className="text-[22px] font-bold text-ink">
              कुठे जायचंय?
            </h2>
            <p className="text-sm font-semibold text-ink-muted">Where do you want to go?</p>
            <p className="text-xs text-ink-muted leading-relaxed mt-0.5">
              Explore, experience and navigate Pune &mdash; smarter and safer.
            </p>
          </div>

          <div className="pt-1">
            <h3 className="text-xs font-bold text-ink-muted">Try asking</h3>
            <div className="space-y-1 pt-1">
              {EXAMPLE_QUESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    handleSend(item);
                  }}
                  className="block w-full text-left text-[15px] text-ink underline hover:text-sign-blue transition-colors min-h-[44px] py-2"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : response ? (
        <div className="pt-1 pb-1">
          <button
            type="button"
            onClick={handleNewQuestion}
            className="text-xs font-semibold text-sign-blue underline hover:text-ink min-h-[44px] inline-flex items-center"
          >
            New question
          </button>
        </div>
      ) : null}

      {/* 4. Results Container (aria-live="polite", focus moved after response) */}
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
            {/* Header: Answer source badge (plain text) & Weather */}
            <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
              <span className="font-medium">
                {response.usedLlm ? "Answered with Gemini" : "Answered by rules"}
              </span>

              {response.weather && (
                <span className="text-ink font-medium">
                  Pune weather: {response.weather.tempC}°C,{" "}
                  {response.weather.conditionCode.replace(/_/g, " ")}
                </span>
              )}
            </div>

            {/* Answer Text */}
            <p className="text-sm text-ink leading-relaxed whitespace-pre-line font-normal">
              {response.answer}
            </p>

            {/* Caveats with Amber Left Edge (Always visible under answer) */}
            {response.caveats.length > 0 && (
              <div className="p-3 bg-ground border-l-4 border-l-caution space-y-1.5 text-xs text-ink">
                <div className="font-bold flex items-center gap-1.5 text-ink">
                  <svg
                    className="w-4 h-4 text-ink shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
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
                  <li>
                    Crash-prone spots come from Pune Police reports. Locations are approximate.
                  </li>
                  <li>
                    No recorded hazards is not the same as safe. Always check active road
                    conditions.
                  </li>
                </ul>
              </div>
            )}

            {/* ROUTE COMPARISON (Two-row radio-style comparison) */}
            {response.routes && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink">Route options</h3>
                  <span className="text-xs text-ink-muted">Compared against crash-prone spots</span>
                </div>

                <div role="radiogroup" aria-label="Route options" className="space-y-2">
                  {/* Row 1: Fastest Route */}
                  <div
                    role="radio"
                    aria-checked={selectedRouteType === "fastest"}
                    tabIndex={0}
                    onClick={() => onSelectRoute("fastest")}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") onSelectRoute("fastest");
                    }}
                    className={`p-3 cursor-pointer transition-colors rounded-[4px] ${
                      selectedRouteType === "fastest"
                        ? "border border-ink bg-ground"
                        : "border-b border-border hover:bg-ground/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-route-fast">Fastest route</span>
                      {selectedRouteType === "fastest" && (
                        <span className="text-xs font-bold text-ink">Selected</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-3 text-xs text-ink">
                      <span className="text-base font-bold">
                        {Math.round(response.routes.fastest.durationSeconds / 60)} min
                      </span>
                      <span>{(response.routes.fastest.distanceMeters / 1000).toFixed(1)} km</span>
                      <span className="text-ink-muted">
                        Hazard index: {response.routes.fastest.hazardIndex}/100
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted flex items-center justify-between">
                      <span>0 min added</span>
                      <span>0 hazard points avoided</span>
                    </div>
                  </div>

                  {/* Row 2: Fewer Known Hazards Route */}
                  <div
                    role="radio"
                    aria-checked={selectedRouteType === "fewest_hazards"}
                    tabIndex={0}
                    onClick={() => onSelectRoute("fewest_hazards")}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") onSelectRoute("fewest_hazards");
                    }}
                    className={`p-3 cursor-pointer transition-colors rounded-[4px] ${
                      selectedRouteType === "fewest_hazards"
                        ? "border border-route-green bg-ground"
                        : "border-b border-border hover:bg-ground/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-route-green">Fewer known hazards</span>
                      {selectedRouteType === "fewest_hazards" && (
                        <span className="text-xs font-bold text-route-green">Selected</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-baseline gap-3 text-xs text-ink">
                      <span className="text-base font-bold text-route-green">
                        {Math.round(response.routes.fewestHazards.durationSeconds / 60)} min
                      </span>
                      <span>
                        {(response.routes.fewestHazards.distanceMeters / 1000).toFixed(1)} km
                      </span>
                      <span className="text-ink-muted">
                        Hazard index: {response.routes.fewestHazards.hazardIndex}/100
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted flex items-center justify-between">
                      <span>+{response.routes.tradeoff.minutesAdded} min added</span>
                      <span>{response.routes.tradeoff.hazardPointsAvoided} hazard points avoided</span>
                    </div>
                  </div>
                </div>

                {/* Plain list of hazards on the selected route */}
                {(() => {
                  const active =
                    selectedRouteType === "fastest"
                      ? response.routes.fastest
                      : response.routes.fewestHazards;
                  return (
                    <div className="pt-2 space-y-1.5 text-xs">
                      <h4 className="font-bold text-ink">Hazards on selected route:</h4>
                      {active.breakdown && active.breakdown.length > 0 ? (
                        <ul className="divide-y divide-border">
                          {active.breakdown.map((item, idx) => (
                            <li key={idx} className="py-2 flex items-baseline justify-between gap-2">
                              <div>
                                <span className="font-bold text-crash-red">{item.name}</span>
                                <p className="text-[11px] text-ink-muted">
                                  Pune Police report &bull; Approximate location ({item.distanceMeters}m from corridor)
                                </p>
                              </div>
                              <span className="text-[11px] text-ink-muted shrink-0">
                                Weight: {item.weight}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-ink-muted">
                          No documented crash-prone spots along this route buffer.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* PLACES LIST (List rows separated by dividers, NOT cards) */}
            {response.places && response.places.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between border-b border-border pb-1">
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

                    const ratingString =
                      rp.place.rating !== undefined && rp.place.rating !== null
                        ? `${rp.place.rating}/5`
                        : "No data";

                    const distanceString =
                      rp.place.distanceMeters !== undefined && rp.place.distanceMeters !== null
                        ? `${(rp.place.distanceMeters / 1000).toFixed(1)} km`
                        : "No data";

                    const openStatusString =
                      rp.place.openNow === true
                        ? "Open now"
                        : rp.place.openNow === false
                          ? "Closed"
                          : "No data";

                    return (
                      <article
                        key={rp.place.id || idx}
                        className="py-3 first:pt-1 last:pb-1 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-ink">
                            <span className="text-ink-muted mr-1.5">{idx + 1}.</span>
                            {rp.place.name}
                          </h4>
                          <span className="text-xs font-bold text-ink shrink-0">
                            {rp.score}/100
                          </span>
                        </div>

                        {/* Single line of facts */}
                        <p className="text-xs text-ink-muted">
                          Rating {ratingString}, Price {priceString}, Distance {distanceString}, {openStatusString}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-ink-muted pt-0.5">
                          <span>Google Maps data</span>
                          {rp.breakdown && rp.breakdown.length > 0 && (
                            <details className="text-sign-blue hover:underline cursor-pointer">
                              <summary className="font-semibold list-none">Why this?</summary>
                              <div className="mt-1 p-2 bg-ground text-ink border border-border space-y-1">
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
