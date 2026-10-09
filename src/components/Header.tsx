import React from "react";
import Link from "next/link";

/**
 * Slim accessible top bar with Marathi wordmark and plain navigation.
 */
export function Header() {
  return (
    <header role="banner" className="border-b border-border bg-surface sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Wordmark (No logo tile) */}
        <Link
          href="/"
          className="flex items-baseline gap-2 text-ink hover:text-sign-blue transition-colors"
          aria-label="Puneri Safar home"
        >
          <span className="font-extrabold text-lg sm:text-xl tracking-tight">Puneri Safar</span>
          <span lang="mr" className="text-xs sm:text-sm text-ink-muted font-semibold">
            पुणेरी सफर
          </span>
        </Link>

        {/* Navigation links (Plain sentence case, no arrows) */}
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-2 sm:gap-6 text-xs sm:text-sm font-semibold"
        >
          <Link
            href="/#explore"
            className="px-2 py-1 text-ink hover:text-sign-blue hover:underline transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/#report"
            className="px-2 py-1 text-ink hover:text-sign-blue hover:underline transition-colors"
          >
            Report an issue
          </Link>
          <Link
            href="/about"
            className="px-2 py-1 text-ink hover:text-sign-blue hover:underline transition-colors"
          >
            About the data
          </Link>
        </nav>
      </div>
    </header>
  );
}
