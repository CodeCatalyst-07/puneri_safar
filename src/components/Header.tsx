import React from "react";
import Link from "next/link";

/**
 * Primary accessible header navigation banner for Puneri Safar.
 */
export function Header() {
  return (
    <header
      role="banner"
      className="border-b border-surface-border bg-surface sticky top-0 z-40 transition-colors"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground hover:opacity-90 transition-opacity font-bold text-xl tracking-tight"
            aria-label="Puneri Safar - Home"
          >
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-primary text-white text-sm font-black shadow-sm"
            >
              PS
            </span>
            <span>Puneri Safar</span>
          </Link>
          <span
            className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary"
            aria-label="Application tagline"
          >
            Explore, experience and navigate Pune &mdash; smarter and safer.
          </span>
        </div>

        <nav
          aria-label="Main Navigation"
          className="flex items-center gap-1 sm:gap-4 text-sm font-medium"
        >
          <Link
            href="/#explore"
            className="px-3 py-1.5 rounded-md text-foreground hover:text-brand-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/#report"
            className="px-3 py-1.5 rounded-md text-foreground hover:text-brand-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Report an issue
          </Link>
          <Link
            href="/about"
            className="px-3 py-1.5 rounded-md text-foreground hover:text-brand-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            About &amp; data honesty
          </Link>
        </nav>
      </div>
    </header>
  );
}
