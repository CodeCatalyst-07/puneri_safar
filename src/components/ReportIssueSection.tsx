"use client";

import React, { useState } from "react";
import { LatLng, ReportCategory } from "@/core/types";

export interface ReportIssueSectionProps {
  currentLocation: LatLng;
  onReportSubmitted?: () => void;
}

export function ReportIssueSection({
  currentLocation,
  onReportSubmitted,
}: ReportIssueSectionProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ReportCategory>("road_hazard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const charCount = text.length;
  const maxChars = 300;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
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
          setStatusMessage({
            type: "error",
            text: "Report submission limit reached (3 reports per 10 minutes). Please wait before submitting again.",
          });
        } else {
          setStatusMessage({
            type: "error",
            text: json.error?.message || "Failed to submit report. Please check your connection.",
          });
        }
        return;
      }

      if (json.success && json.data) {
        const report = json.data;
        if (report.status === "corroborated") {
          setStatusMessage({
            type: "success",
            text: "Thanks! Your report has been corroborated by nearby community reports and is now actively factored into route safety evaluations.",
          });
        } else {
          setStatusMessage({
            type: "info",
            text: "Thanks - saved as unverified; it influences routes only after another person reports the same issue nearby.",
          });
        }
        setText("");
        onReportSubmitted?.();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Network error occurred while submitting report. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="report"
      aria-labelledby="report-heading"
      className="p-6 rounded-xl border border-surface-border bg-surface shadow-xs space-y-6 scroll-mt-20"
    >
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
          <span>Community Mobility</span>
        </div>
        <h2 id="report-heading" className="text-xl sm:text-2xl font-bold text-foreground mt-2">
          Report an Issue or Hazard
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Help fellow Pune commuters by reporting potholes, severe waterlogging, broken
          streetlights, or road hazards.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category Select */}
        <div>
          <label
            htmlFor="report-category"
            className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5"
          >
            Hazard Category (Optional)
          </label>
          <select
            id="report-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
            className="w-full sm:w-72 px-3 py-2 rounded-lg border border-surface-border bg-background text-foreground text-sm focus-visible:outline-none focus:ring-2 focus:ring-brand-primary min-h-[44px]"
          >
            <option value="road_hazard">Road Hazard / Pothole</option>
            <option value="waterlogging">Waterlogging / Flood</option>
            <option value="poor_lighting">Poor Street Lighting</option>
            <option value="crowd">Traffic Congestion / Crowd</option>
            <option value="cleanliness">Sanitation / Waste Issue</option>
            <option value="other">Other Civic Obstacle</option>
          </select>
        </div>

        {/* Text Area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="report-text"
              className="block text-xs font-bold uppercase tracking-wider text-text-muted"
            >
              Description <span className="text-red-500">*</span>
            </label>
            <span
              id="report-counter"
              className={`text-xs font-mono ${charCount > maxChars ? "text-red-600 font-bold" : "text-text-muted"}`}
              aria-live="polite"
            >
              {charCount} / {maxChars}
            </span>
          </div>
          <textarea
            id="report-text"
            rows={3}
            maxLength={maxChars}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Deep pothole near the flyover ramp causing two-wheelers to swerve abruptly"
            aria-describedby="report-counter report-privacy-note"
            className="w-full p-3 rounded-lg border border-surface-border bg-background text-foreground text-sm focus-visible:outline-none focus:ring-2 focus:ring-brand-primary resize-y min-h-[80px]"
          />
        </div>

        {/* Location Notice */}
        <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-surface-border/50 text-xs text-text-muted flex items-start gap-2">
          <span aria-hidden="true" className="text-brand-primary font-bold">
            📍
          </span>
          <div>
            <span>Attaching report near location: </span>
            <strong className="text-foreground">
              {currentLocation.lat.toFixed(3)}, {currentLocation.lng.toFixed(3)}
            </strong>
            <p className="mt-0.5 text-text-muted/80">
              Coordinates are rounded to 3 decimal places (~100 m) to protect your location privacy.
            </p>
          </div>
        </div>

        {/* Privacy Note */}
        <p id="report-privacy-note" className="text-xs text-text-muted leading-relaxed">
          <strong>Privacy note:</strong> Do not include names, phone numbers, or vehicle numbers.
          All reports are anonymous.
        </p>

        {/* Status Message */}
        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`p-3.5 rounded-lg text-xs font-medium border leading-relaxed ${
              statusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                : statusMessage.type === "info"
                  ? "bg-sky-50 dark:bg-sky-950/20 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800"
                  : "bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-200 border-red-300 dark:border-red-800"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={isSubmitting || !text.trim() || charCount > maxChars}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs min-h-[44px]"
          >
            {isSubmitting ? "Submitting securely..." : "Submit Hazard Report"}
          </button>
        </div>
      </form>
    </section>
  );
}
