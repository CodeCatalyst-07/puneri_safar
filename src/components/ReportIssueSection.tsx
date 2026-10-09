"use client";

import React, { useState } from "react";
import { LatLng, ReportCategory } from "@/core/types";

export interface ReportIssueSectionProps {
  currentLocation: LatLng;
  onRequestLocation?: () => void;
  onReportSubmitted?: () => void;
}

export function ReportIssueSection({
  currentLocation,
  onRequestLocation,
  onReportSubmitted,
}: ReportIssueSectionProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ReportCategory>("road_hazard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const charCount = text.length;
  const maxChars = 300;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setValidationError("Type a description first");
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          category,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setValidationError(
            "Report limit reached. You can submit up to 3 reports every 10 minutes. Please wait before submitting again."
          );
        } else {
          setValidationError(
            json.error?.message || "Could not submit report. Check your connection and retry."
          );
        }
        return;
      }

      if (json.success && json.data) {
        const report = json.data;
        if (report.status === "corroborated") {
          setStatusMessage(
            "Report corroborated. Two or more people reported this hazard nearby, and it now influences route safety evaluations."
          );
        } else {
          setStatusMessage(
            "Saved as unverified. It affects route suggestions only after another person reports the same issue nearby."
          );
        }
        setText("");
        onReportSubmitted?.();
      }
    } catch {
      setValidationError("Network error occurred while submitting report. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 id="report-heading" tabIndex={-1} className="text-base font-bold text-ink outline-hidden">
          Report a hazard
        </h2>
        <p className="text-xs text-ink-muted leading-relaxed">
          Report potholes, waterlogging, or road obstacles to alert other commuters.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* 1. Category Select (Full width) */}
        <div className="space-y-1">
          <label htmlFor="report-category" className="block text-xs font-semibold text-ink-muted">
            Hazard category
          </label>
          <select
            id="report-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
            className="w-full px-3 py-2 text-sm bg-white border border-ink/40 rounded-[4px] text-ink focus:outline-hidden focus:ring-2 focus:ring-sign-blue min-h-[44px]"
          >
            <option value="road_hazard">Road hazard or pothole</option>
            <option value="waterlogging">Waterlogging or flood</option>
            <option value="poor_lighting">Poor street lighting</option>
            <option value="crowd">Traffic congestion or crowd</option>
            <option value="cleanliness">Sanitation or debris</option>
            <option value="other">Other road obstacle</option>
          </select>
        </div>

        {/* 2. Description (Counter only after 250 characters) */}
        <div className="space-y-1">
          <label htmlFor="report-text" className="block text-xs font-semibold text-ink-muted">
            Description
          </label>
          <textarea
            id="report-text"
            rows={3}
            maxLength={maxChars}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="e.g. Deep pothole near the flyover ramp causing two-wheelers to swerve abruptly"
            aria-describedby={charCount >= 250 ? "report-counter" : undefined}
            className="w-full p-3 text-sm text-ink bg-white border border-ink/40 rounded-[4px] focus:outline-hidden focus:ring-2 focus:ring-sign-blue resize-y min-h-[88px]"
          />
          {charCount >= 250 && (
            <div className="flex justify-end text-xs text-ink-muted">
              <span id="report-counter" aria-live="polite">
                {charCount} / {maxChars}
              </span>
            </div>
          )}
        </div>

        {/* 3. Location Line (No raw coordinates) */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between gap-2 text-xs text-ink font-semibold">
            <span>Location: near Shivajinagar. Shared to about 100 m.</span>
            {onRequestLocation && (
              <button
                type="button"
                onClick={onRequestLocation}
                className="text-sign-blue underline hover:text-ink text-xs font-semibold min-h-[44px] shrink-0 inline-flex items-center"
              >
                Use my location
              </button>
            )}
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Saved as unverified. It affects route suggestions only after another person reports the same
            issue nearby. Don&apos;t include names or phone numbers.
          </p>
        </div>

        {/* Validation or Status Messages */}
        {validationError && (
          <p role="status" aria-live="polite" className="text-xs text-crash-red font-semibold">
            {validationError}
          </p>
        )}
        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className="p-3 text-xs font-medium text-ink bg-ground border-l-4 border-l-route-green"
          >
            {statusMessage}
          </div>
        )}

        {/* Submit Button (Always looks enabled) */}
        <div>
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-semibold bg-ink text-white rounded-[4px] hover:bg-sign-blue transition-colors min-h-[44px]"
          >
            {isSubmitting ? "Sending..." : "Send report"}
          </button>
        </div>
      </form>
    </div>
  );
}
