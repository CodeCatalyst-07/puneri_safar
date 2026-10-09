"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Slim 56px accessible top bar aligned with left panel padding.
 * All nav links have 44px touch targets and current page underline.
 */
export function Header() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"ask" | "report">("ask");

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<"ask" | "report">;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener("puneri-tab-active", handleTabChange);
    return () => {
      window.removeEventListener("puneri-tab-active", handleTabChange);
    };
  }, []);

  const handleExploreClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("puneri-switch-tab", { detail: "ask" }));
    }
  };

  const handleReportClick = (e: React.MouseEvent) => {
    if (pathname === "/") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("puneri-switch-tab", { detail: "report" }));
    }
  };

  const isExploreActive = pathname === "/" && activeTab === "ask";
  const isReportActive = pathname === "/" && activeTab === "report";
  const isAboutActive = pathname === "/about";

  return (
    <header
      role="banner"
      className="h-14 border-b border-border bg-surface shrink-0 z-40 flex items-center px-4 sm:px-5"
    >
      <div className="w-full flex items-center justify-between">
        {/* Wordmark (aligned with left panel px-4/px-5, no centered max-width container) */}
        <Link
          href="/"
          className="flex items-center gap-2 text-ink hover:text-sign-blue transition-colors min-h-[44px]"
          aria-label="Puneri Safar home"
        >
          <span className="font-extrabold text-lg sm:text-xl tracking-tight">Puneri Safar</span>
          <span lang="mr" className="text-xs sm:text-sm text-ink-muted font-semibold">
            पुणेरी सफर
          </span>
        </Link>

        {/* Navigation links (44px tall targets, sentence case, current page underlined) */}
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-1 sm:gap-3 text-xs sm:text-sm font-semibold"
        >
          <Link
            href="/#explore"
            onClick={handleExploreClick}
            aria-current={isExploreActive ? "page" : undefined}
            className={`min-h-[44px] flex items-center px-2.5 transition-colors ${
              isExploreActive
                ? "text-ink border-b-2 border-ink font-bold"
                : "text-ink-muted hover:text-ink hover:underline"
            }`}
          >
            Explore
          </Link>
          <Link
            href="/#report"
            onClick={handleReportClick}
            aria-current={isReportActive ? "page" : undefined}
            className={`min-h-[44px] flex items-center px-2.5 transition-colors ${
              isReportActive
                ? "text-ink border-b-2 border-ink font-bold"
                : "text-ink-muted hover:text-ink hover:underline"
            }`}
          >
            Report an issue
          </Link>
          <Link
            href="/about"
            aria-current={isAboutActive ? "page" : undefined}
            className={`min-h-[44px] flex items-center px-2.5 transition-colors ${
              isAboutActive
                ? "text-ink border-b-2 border-ink font-bold"
                : "text-ink-muted hover:text-ink hover:underline"
            }`}
          >
            About the data
          </Link>
        </nav>
      </div>
    </header>
  );
}
