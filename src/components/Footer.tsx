import React from "react";

/**
 * Accessible footer landmark with municipal disclaimer and accessibility pledge.
 */
export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-surface-border bg-surface text-text-muted text-sm py-8 transition-colors"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-semibold text-foreground">
            Puneri Safar &mdash; City Navigation, Heritage & Hazard Intelligence
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full bg-brand-emerald"
              aria-hidden="true"
            />
            <span>All systems nominal (Phase 2.1)</span>
          </div>
        </div>

        <p className="text-xs text-text-muted leading-relaxed">
          <strong>Data Honesty & Attribution:</strong> Historical spots and traffic hazard
          blackspots are compiled from public municipal records and open data initiatives in Pune,
          India. Always exercise caution and adhere to traffic regulations on active roads.
        </p>

        <div className="text-xs text-text-muted flex items-center justify-between pt-2 border-t border-surface-border/50">
          <p>
            &copy; {new Date().getFullYear()} Puneri Safar. Built with Next.js & Google Cloud
            Services.
          </p>
          <p>WCAG 2.1 AA Compliant</p>
        </div>
      </div>
    </footer>
  );
}
