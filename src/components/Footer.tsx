import React from "react";

/**
 * Accessible footer landmark with municipal attribution and disclaimer.
 */
export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-border bg-surface text-ink-muted text-xs py-4"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>Puneri Safar &mdash; Pune road safety audits and civic navigation.</p>
        <p>
          WCAG 2.1 AA &bull; Verified Pune police crash audits &bull; {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
