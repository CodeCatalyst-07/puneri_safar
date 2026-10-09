"use client";

import React from "react";
import { UserContext } from "@/core/types";
import { UserContextState } from "./useUserContext";

export interface ContextPanelProps {
  contextState: UserContextState;
}

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

  return (
    <section
      aria-labelledby="context-heading"
      className="p-5 sm:p-6 rounded-xl border border-surface-border bg-surface shadow-xs space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-4">
        <div>
          <h2 id="context-heading" className="text-base sm:text-lg font-bold text-foreground">
            Your Pune Context
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            Configure your transit mode, safety posture, and physical accessibility requirements.
          </p>
        </div>

        {/* GPS Button */}
        <div className="flex flex-col items-start sm:items-end gap-1">
          <button
            type="button"
            onClick={requestCurrentLocation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white text-xs font-semibold transition-colors min-h-[44px]"
            aria-describedby="location-status-desc"
          >
            <span aria-hidden="true">📍</span>
            <span>Use My Location</span>
          </button>
          <span
            id="location-status-desc"
            className="text-[11px] text-text-muted"
            aria-live="polite"
          >
            {locationStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Travel Mode */}
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Travel Mode
          </legend>
          <label htmlFor="select-travel-mode" className="sr-only">
            Select Travel Mode
          </label>
          <select
            id="select-travel-mode"
            value={context.travelMode}
            onChange={(e) => setTravelMode(e.target.value as UserContext["travelMode"])}
            className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-foreground text-xs font-medium focus-visible:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
          >
            <option value="two_wheeler">Two-Wheeler (Bike/Scooter)</option>
            <option value="walk">Pedestrian (Walking)</option>
            <option value="car">Car / Auto-Rickshaw</option>
            <option value="transit">Public Transit (PMPML Bus / Metro)</option>
          </select>
        </fieldset>

        {/* Budget */}
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Budget Tier
          </legend>
          <label htmlFor="select-budget" className="sr-only">
            Select Budget Tier
          </label>
          <select
            id="select-budget"
            value={context.budget}
            onChange={(e) => setBudget(e.target.value as UserContext["budget"])}
            className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-foreground text-xs font-medium focus-visible:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
          >
            <option value="low">Budget / Pocket-Friendly (₹)</option>
            <option value="medium">Moderate / Standard (₹₹)</option>
            <option value="high">Upscale / Premium (₹₹₹)</option>
          </select>
        </fieldset>

        {/* Safety Preference */}
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Safety Preference
          </legend>
          <label htmlFor="select-safety-pref" className="sr-only">
            Select Safety Preference
          </label>
          <select
            id="select-safety-pref"
            value={context.safetyPreference}
            onChange={(e) => setSafetyPreference(e.target.value as UserContext["safetyPreference"])}
            className="w-full px-3 py-2 rounded-lg border border-surface-border bg-background text-foreground text-xs font-medium focus-visible:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
          >
            <option value="cautious">Cautious (Prioritize avoiding blackspots)</option>
            <option value="balanced">Balanced (Normal detour allowance)</option>
            <option value="relaxed">Direct (Fastest route regardless of hazards)</option>
          </select>
        </fieldset>

        {/* Accessibility Needs */}
        <fieldset className="space-y-1.5 flex flex-col justify-end">
          <legend className="sr-only">Accessibility Preferences</legend>
          <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-surface-border bg-background hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-xs font-medium text-foreground transition-colors min-h-[44px]">
            <input
              type="checkbox"
              checked={context.accessibilityNeeds}
              onChange={(e) => setAccessibilityNeeds(e.target.checked)}
              className="rounded border-surface-border text-brand-primary focus:ring-brand-primary h-4 w-4"
            />
            <span>Step-free &amp; Wheelchair accessibility</span>
          </label>
        </fieldset>
      </div>
    </section>
  );
}
