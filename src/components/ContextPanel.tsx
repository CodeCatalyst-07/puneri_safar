"use client";

import React, { useState } from "react";
import { UserContextState } from "./useUserContext";

export interface ContextPanelProps {
  contextState: UserContextState;
}

const TRAVEL_MODES = [
  { id: "walk", label: "Walk" },
  { id: "two_wheeler", label: "Bike" },
  { id: "car", label: "Car" },
  { id: "transit", label: "Bus or metro" },
] as const;

const BUDGET_TIERS = [
  { id: "low", label: "₹", accessibleName: "Budget: low" },
  { id: "medium", label: "₹₹", accessibleName: "Budget: medium" },
  { id: "high", label: "₹₹₹", accessibleName: "Budget: high" },
] as const;

/**
 * Location line placed directly under tabs.
 * Clean text without bordered boxes or separate notes.
 */
export function LocationLine({ contextState }: ContextPanelProps) {
  const { context, locationStatus, requestCurrentLocation } = contextState;

  const isShivajinagar =
    Math.abs(context.location.lat - 18.5314) < 0.001 &&
    Math.abs(context.location.lng - 73.8446) < 0.001;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs text-ink font-semibold">
        <span>
          {isShivajinagar
            ? "Near Shivajinagar (default)"
            : `Near ${context.location.lat.toFixed(3)}, ${context.location.lng.toFixed(3)}`}
        </span>
        <button
          type="button"
          onClick={requestCurrentLocation}
          className="text-sign-blue underline hover:text-ink text-xs font-semibold min-h-[44px] inline-flex items-center"
        >
          Use my location
        </button>
      </div>

      {locationStatus && (
        <p className="text-[11px] text-ink-muted -mt-1" aria-live="polite">
          {locationStatus}
        </p>
      )}
    </div>
  );
}

/**
 * Trip settings summary row and disclosure panel.
 * Uses native radio groups inside fieldset with real arrow key navigation.
 * No nested bordered boxes.
 */
export function ContextPanel({ contextState }: ContextPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    context,
    setTravelMode,
    setBudget,
    setSafetyPreference,
    setAccessibilityNeeds,
  } = contextState;

  // Compute compact summary string
  const activeMode =
    TRAVEL_MODES.find((m) => m.id === context.travelMode)?.label || "Bike";
  const activeBudget =
    BUDGET_TIERS.find((b) => b.id === context.budget)?.label || "₹₹₹";
  const activeSafety =
    context.safetyPreference === "cautious" ? "fewer known hazards" : "fastest route";
  const activeAccess = context.accessibilityNeeds ? "step-free on" : "step-free off";

  const summaryText = `${activeMode}, ${activeBudget}, ${activeSafety}, ${activeAccess}`;

  return (
    <div className="space-y-3">
      {/* Summary Row */}
      <div className="flex items-center justify-between gap-2 text-xs text-ink font-medium">
        <span className="truncate">{summaryText}</span>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="trip-settings-disclosure"
          onClick={() => setIsOpen(!isOpen)}
          className="text-sign-blue underline hover:text-ink text-xs font-semibold min-h-[44px] shrink-0 inline-flex items-center"
        >
          {isOpen ? "Done" : "Change"}
        </button>
      </div>

      {/* Expanded Controls Disclosure */}
      {isOpen && (
        <div
          id="trip-settings-disclosure"
          className="pt-2 pb-1 space-y-4 border-t border-border"
        >
          {/* 1. Travel Mode Segmented Control */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold text-ink-muted">Travel mode</legend>
            <div className="grid grid-cols-4 gap-1">
              {TRAVEL_MODES.map((mode) => {
                const active = context.travelMode === mode.id;
                return (
                  <label
                    key={mode.id}
                    className={`min-h-[44px] flex items-center justify-center px-1 py-2 text-xs font-semibold rounded-[4px] cursor-pointer text-center transition-colors ${
                      active
                        ? "bg-ink text-white"
                        : "bg-surface text-ink border border-ink hover:bg-ground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="travelMode"
                      value={mode.id}
                      checked={active}
                      onChange={() => setTravelMode(mode.id)}
                      className="sr-only"
                    />
                    <span>{mode.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 2. Budget Segmented Control */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold text-ink-muted">Budget</legend>
            <div className="grid grid-cols-3 gap-1">
              {BUDGET_TIERS.map((tier) => {
                const active = context.budget === tier.id;
                return (
                  <label
                    key={tier.id}
                    aria-label={tier.accessibleName}
                    className={`min-h-[44px] flex items-center justify-center px-2 py-2 text-xs font-semibold rounded-[4px] cursor-pointer text-center transition-colors ${
                      active
                        ? "bg-ink text-white"
                        : "bg-surface text-ink border border-ink hover:bg-ground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="budget"
                      value={tier.id}
                      checked={active}
                      onChange={() => setBudget(tier.id)}
                      className="sr-only"
                    />
                    <span>{tier.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 3. Route Priority (No wrapping on "Fewer known hazards") */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold text-ink-muted">Route priority</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <label
                className={`min-h-[44px] flex items-center justify-center px-2 py-2 text-xs font-semibold rounded-[4px] cursor-pointer text-center transition-colors ${
                  context.safetyPreference === "relaxed"
                    ? "bg-ink text-white"
                    : "bg-surface text-ink border border-ink hover:bg-ground"
                }`}
              >
                <input
                  type="radio"
                  name="safetyPreference"
                  value="relaxed"
                  checked={context.safetyPreference === "relaxed"}
                  onChange={() => setSafetyPreference("relaxed")}
                  className="sr-only"
                />
                <span className="whitespace-nowrap">Fastest</span>
              </label>

              <label
                className={`min-h-[44px] flex items-center justify-center px-2 py-2 text-xs font-semibold rounded-[4px] cursor-pointer text-center transition-colors ${
                  context.safetyPreference === "cautious"
                    ? "bg-ink text-white"
                    : "bg-surface text-ink border border-ink hover:bg-ground"
                }`}
              >
                <input
                  type="radio"
                  name="safetyPreference"
                  value="cautious"
                  checked={context.safetyPreference === "cautious"}
                  onChange={() => setSafetyPreference("cautious")}
                  className="sr-only"
                />
                <span className="whitespace-nowrap">Fewer known hazards</span>
              </label>
            </div>
          </fieldset>

          {/* 4. Step-free Access Switch (Row without box) */}
          <label className="flex items-center gap-2.5 py-1.5 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={context.accessibilityNeeds}
              onChange={(e) => setAccessibilityNeeds(e.target.checked)}
              className="w-4 h-4 text-sign-blue border-ink rounded-[4px] focus:ring-sign-blue"
            />
            <span className="text-xs font-semibold text-ink">
              Step-free and wheelchair access
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
