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
            text: "Report limit reached. You can submit up to 3 reports every 10 minutes. Please wait before submitting again.",
          });
        } else {
          setStatusMessage({
            type: "error",
            text:
              json.error?.message || "Could not submit report. Check your connection and retry.",
          });
        }
        return;
      }

      if (json.success && json.data) {
        const report = json.data;
        if (report.status === "corroborated") {
          setStatusMessage({
            type: "success",
            text: "Report corroborated. Two or more people reported this hazard nearby, and it now influences route safety evaluations.",
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
        text: "Network error occurred while submitting report. Please retry.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="report"
      aria-label="Report a road hazard"
      className="p-5 bg-surface border border-border rounded-sm space-y-4 scroll-mt-16"
    >
      <div>
        <h2 className="text-base font-bold text-ink">Report a road hazard</h2>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed">
          Report potholes, waterlogging, or broken streetlights to alert other commuters.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Category Select */}
        <div>
          <label
            htmlFor="report-category"
            className="block text-xs font-semibold text-ink-muted mb-1"
          >
            Hazard category
          </label>
          <select
            id="report-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
            className="w-full sm:w-64 px-3 py-2 text-xs font-semibold bg-ground border border-border rounded-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-sign-blue min-h-[44px]"
          >
            <option value="road_hazard">Road hazard or pothole</option>
            <option value="waterlogging">Waterlogging or flood</option>
            <option value="poor_lighting">Poor street lighting</option>
            <option value="crowd">Traffic congestion or crowd</option>
            <option value="cleanliness">Sanitation or debris</option>
            <option value="other">Other road obstacle</option>
          </select>
        </div>

        {/* Description Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="report-text" className="block text-xs font-semibold text-ink-muted">
              Description
            </label>
            <span
              id="report-counter"
              className={`text-xs ${charCount > maxChars ? "text-crash-red font-bold" : "text-ink-muted"}`}
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
            aria-describedby="report-counter report-privacy"
            className="w-full p-3 text-xs text-ink bg-ground border border-border rounded-sm focus:outline-hidden focus:ring-2 focus:ring-sign-blue resize-y min-h-[80px]"
          />
        </div>

        {/* Location Notice & Privacy Note */}
        <div
          id="report-privacy"
          className="p-2.5 bg-ground border border-border text-xs text-ink space-y-1"
        >
          <p>
            Attaching report near coordinates:{" "}
            <strong>
              {currentLocation.lat.toFixed(3)}, {currentLocation.lng.toFixed(3)}
            </strong>
          </p>
          <p className="text-ink-muted text-[11px] leading-relaxed">
            Coordinates are rounded to 3 decimal places (~100m) to preserve your privacy. Do not
            include personal names or phone numbers; reports are anonymous.
          </p>
        </div>

        {/* Status Announcement Banner */}
        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`p-3 text-xs font-medium border-l-4 ${
              statusMessage.type === "success"
                ? "bg-white border-l-route-green text-ink"
                : statusMessage.type === "info"
                  ? "bg-white border-l-sign-blue text-ink"
                  : "bg-white border-l-crash-red text-crash-red"
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
            className="px-5 py-2.5 text-xs font-semibold bg-ink text-white rounded-sm hover:bg-sign-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {isSubmitting ? "Submitting" : "Send report"}
          </button>
        </div>
      </form>
    </section>
  );
}
