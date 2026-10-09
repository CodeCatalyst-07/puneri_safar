"use client";

import React from "react";
import { UserContextState } from "./useUserContext";

export interface ContextPanelProps {
  contextState: UserContextState;
}

/**
 * Compact context bar placed directly above the assistant input.
 * All controls use sentence case, inline SVGs, and minimum 44px touch targets.
 */
export function ContextPanel({ contextState }: ContextPanelProps) {
  const {
    context,
    locationStatus,
    setTravelMode,
    setBudget,
    setSafetyPreference,
    setAccessibilityNeeds,
    requestCurrentLocation,
  } = contextState;

  const isShivajinagar =
    Math.abs(context.location.lat - 18.5314) < 0.001 &&
    Math.abs(context.location.lng - 73.8446) < 0.001;

  return (
    <section aria-label="Trip settings" className="space-y-3">
      {/* 1. Location Bar & Plain Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-surface border border-border rounded-sm">
        <div className="flex items-center gap-2 text-xs text-ink font-semibold">
          <svg
            className="w-4 h-4 text-sign-blue shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>
            {isShivajinagar
              ? "Near Shivajinagar"
              : `Selected area (${context.location.lat.toFixed(3)}, ${context.location.lng.toFixed(3)})`}
          </span>
        </div>

        <button
          type="button"
          onClick={requestCurrentLocation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sign-blue hover:text-ink hover:bg-ground border border-border rounded-sm transition-colors min-h-[44px]"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2" />
          </svg>
          <span>Use my location</span>
        </button>
      </div>

      {locationStatus && (
        <p className="text-[11px] text-ink-muted px-1" aria-live="polite">
          {locationStatus}
        </p>
      )}

      {/* 2. Controls Grid: Travel mode, Budget, Safety, Step-free */}
      <div className="space-y-3">
        {/* Travel Mode Segmented Control */}
        <div>
          <span className="block text-xs font-semibold text-ink-muted mb-1.5">Travel mode</span>
          <div
            role="radiogroup"
            aria-label="Travel mode"
            className="grid grid-cols-4 gap-1 p-1 bg-surface border border-border rounded-sm"
          >
            {(
              [
                {
                  id: "walk",
                  label: "Walk",
                  icon: (
                    <path d="M13 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 22l3-7 2 3v6h2v-7l-2-3 1-5 3 3h4v-2h-3l-2.5-3A2 2 0 0 0 12 6c-.5 0-1 .2-1.4.6L7 10.2V16h2v-4.5l1.5-1.5L9 15l-3 7Z" />
                  ),
                },
                {
                  id: "two_wheeler",
                  label: "Bike",
                  icon: (
                    <path d="M5.5 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15 6h4v2h-3.2l-2.1 4H10l-1.3-2.5L12 7h2V6Z" />
                  ),
                },
                {
                  id: "car",
                  label: "Car",
                  icon: (
                    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0v6a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-6M7 14h.01M17 14h.01" />
                  ),
                },
                {
                  id: "transit",
                  label: "Bus/Metro",
                  icon: (
                    <path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6Zm2 12v3h2v-3m8 0v3h2v-3M4 11h16M7 15h.01M17 15h.01" />
                  ),
                },
              ] as const
            ).map((mode) => {
              const active = context.travelMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTravelMode(mode.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold rounded-sm transition-colors min-h-[44px] ${
                    active ? "bg-ink text-white" : "text-ink hover:bg-ground hover:text-sign-blue"
                  }`}
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    {mode.icon}
                  </svg>
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Budget and Safety row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Budget */}
          <div>
            <span className="block text-xs font-semibold text-ink-muted mb-1.5">Budget</span>
            <div
              role="radiogroup"
              aria-label="Budget"
              className="grid grid-cols-3 gap-1 p-1 bg-surface border border-border rounded-sm"
            >
              {(
                [
                  { id: "low", label: "₹" },
                  { id: "medium", label: "₹₹" },
                  { id: "high", label: "₹₹₹" },
                ] as const
              ).map((tier) => {
                const active = context.budget === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBudget(tier.id)}
                    className={`py-2 text-xs font-semibold rounded-sm text-center transition-colors min-h-[44px] ${
                      active ? "bg-ink text-white" : "text-ink hover:bg-ground hover:text-sign-blue"
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Safety Preference Toggle */}
          <div>
            <span className="block text-xs font-semibold text-ink-muted mb-1.5">
              Route priority
            </span>
            <div
              role="radiogroup"
              aria-label="Route priority"
              className="grid grid-cols-2 gap-1 p-1 bg-surface border border-border rounded-sm"
            >
              <button
                type="button"
                role="radio"
                aria-checked={context.safetyPreference === "relaxed"}
                onClick={() => setSafetyPreference("relaxed")}
                className={`py-2 px-1 text-xs font-semibold rounded-sm text-center transition-colors min-h-[44px] ${
                  context.safetyPreference === "relaxed"
                    ? "bg-ink text-white"
                    : "text-ink hover:bg-ground hover:text-sign-blue"
                }`}
              >
                Fastest
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={context.safetyPreference === "cautious"}
                onClick={() => setSafetyPreference("cautious")}
                className={`py-2 px-1 text-xs font-semibold rounded-sm text-center transition-colors min-h-[44px] ${
                  context.safetyPreference === "cautious"
                    ? "bg-route-green text-white"
                    : "text-ink hover:bg-ground hover:text-route-green"
                }`}
              >
                Fewer known hazards
              </button>
            </div>
          </div>
        </div>

        {/* Step-free access checkbox */}
        <label className="flex items-center gap-3 p-2.5 bg-surface border border-border rounded-sm cursor-pointer hover:border-ink transition-colors min-h-[44px]">
          <input
            type="checkbox"
            checked={context.accessibilityNeeds}
            onChange={(e) => setAccessibilityNeeds(e.target.checked)}
            className="w-4 h-4 text-sign-blue border-border rounded-xs focus:ring-sign-blue"
          />
          <span className="text-xs font-semibold text-ink">Step-free and wheelchair access</span>
        </label>
      </div>
    </section>
  );
}
