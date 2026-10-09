import React from "react";

/**
 * Slim accessible footer for /about page.
 * Honest copy: no claims of "verified" or "WCAG 2.1 AA", no middle dots.
 */
export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-border bg-surface text-ink-muted text-xs py-4 px-4 sm:px-6"
    >
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>Puneri Safar &mdash; Pune road safety records and civic navigation.</p>
        <p>
          Crash-prone spots come from Pune Police reports. Locations are approximate.
        </p>
      </div>
    </footer>
  );
}
