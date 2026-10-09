"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  useUserContext,
  LocationLine,
  AssistantSection,
  ReportIssueSection,
} from "@/components";
import { RankedPlace } from "@/core/ranking";
import { ScoredRouteSummary, AssistantResponse } from "@/services/assistant";
import { RouteChoiceTradeoff } from "@/core/safety";

// Lazy-load MapView to optimize initial render and eliminate SSR issues
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div
      role="region"
      aria-label="Map loading placeholder"
      className="w-full h-full min-h-[280px] bg-ground flex items-center justify-center text-ink-muted text-xs font-semibold"
    >
      Loading Pune city map canvas...
    </div>
  ),
});

export default function HomePage() {
  const userContextState = useUserContext();

  const [activeTab, setActiveTab] = useState<"ask" | "report">(() => {
    if (typeof window !== "undefined" && window.location.hash === "#report") {
      return "report";
    }
    return "ask";
  });
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const [places, setPlaces] = useState<RankedPlace[]>([]);
  const [routes, setRoutes] = useState<
    | {
        fastest: ScoredRouteSummary;
        fewestHazards: ScoredRouteSummary;
        tradeoff: RouteChoiceTradeoff;
      }
    | undefined
  >(undefined);

  const [selectedRouteType, setSelectedRouteType] = useState<"fastest" | "fewest_hazards">(
    "fewest_hazards"
  );

  const tabAskRef = useRef<HTMLButtonElement>(null);
  const tabReportRef = useRef<HTMLButtonElement>(null);

  // Sync tab events with Header
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent<"ask" | "report">;
      const tab = customEvent.detail;
      if (tab === "report") {
        setActiveTab("report");
        setTimeout(() => {
          document.getElementById("report-heading")?.focus();
        }, 50);
      } else if (tab === "ask") {
        setActiveTab("ask");
        setTimeout(() => {
          document.getElementById("assistant-input")?.focus();
        }, 50);
      }
    };

    window.addEventListener("puneri-switch-tab", handleSwitchTab);

    // Focus report heading on initial load if navigated with #report hash
    if (typeof window !== "undefined" && window.location.hash === "#report") {
      setTimeout(() => {
        document.getElementById("report-heading")?.focus();
      }, 50);
    }

    return () => {
      window.removeEventListener("puneri-switch-tab", handleSwitchTab);
    };
  }, []);

  // Broadcast active tab to Header
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("puneri-tab-active", { detail: activeTab }));
  }, [activeTab]);

  const handleAssistantResponse = (res: AssistantResponse) => {
    if (res.places) {
      setPlaces(res.places);
    }
    if (res.routes) {
      setRoutes(res.routes);
      setSelectedRouteType(
        res.routes.tradeoff.recommendation === "fewest_hazards" ? "fewest_hazards" : "fastest"
      );
    }
  };

  // Keyboard navigation for ARIA tablist
  const handleTabKeyDown = (e: React.KeyboardEvent, currentTab: "ask" | "report") => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      if (currentTab === "ask") {
        setActiveTab("report");
        tabReportRef.current?.focus();
      } else {
        setActiveTab("ask");
        tabAskRef.current?.focus();
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      if (currentTab === "report") {
        setActiveTab("ask");
        tabAskRef.current?.focus();
      } else {
        setActiveTab("report");
        tabReportRef.current?.focus();
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveTab("ask");
      tabAskRef.current?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveTab("report");
      tabReportRef.current?.focus();
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Exactly one h1 per page (Visually hidden on home page) */}
      <h1 className="sr-only">Puneri Safar: Pune city assistant</h1>

      {/* Map: Pinned at top on mobile (38dvh/70dvh), full-height right pane on desktop */}
      <div
        className={`order-1 lg:order-2 w-full lg:w-auto lg:flex-1 shrink-0 lg:shrink min-h-0 relative ${
          isMapExpanded ? "h-[70dvh]" : "h-[38dvh]"
        } lg:h-full`}
      >
        {/* Mobile Map Expand/Collapse button */}
        <div className="lg:hidden absolute top-3 right-3 z-20">
          <button
            type="button"
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className="bg-surface border border-border px-3 py-1.5 text-xs font-semibold rounded-[4px] shadow-xs text-ink hover:bg-ground min-h-[44px] flex items-center"
          >
            {isMapExpanded ? "Collapse map" : "Expand map"}
          </button>
        </div>

        <MapView
          center={userContextState.context.location}
          places={places}
          routes={routes}
          selectedRouteType={selectedRouteType}
          onSelectRoute={setSelectedRouteType}
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {/* Left Panel: Scrolls independently on desktop, below map on mobile */}
      <div className="order-2 lg:order-1 w-full lg:w-[440px] flex-1 lg:flex-initial lg:h-full overflow-y-auto bg-surface border-t lg:border-t-0 lg:border-r border-border p-4 sm:p-5 space-y-4 shrink-0">
        {/* 1. Tabs: "Ask" and "Report a hazard" (Proper ARIA tablist/tab/tabpanel) */}
        <div
          role="tablist"
          aria-label="City assistance modes"
          className="flex border-b border-border"
        >
          <button
            ref={tabAskRef}
            role="tab"
            id="tab-ask"
            aria-selected={activeTab === "ask"}
            aria-controls="tabpanel-ask"
            tabIndex={activeTab === "ask" ? 0 : -1}
            onClick={() => setActiveTab("ask")}
            onKeyDown={(e) => handleTabKeyDown(e, "ask")}
            className={`pb-2.5 px-3 text-sm font-bold min-h-[44px] flex items-center transition-colors ${
              activeTab === "ask"
                ? "border-b-2 border-ink text-ink font-extrabold"
                : "text-ink-muted hover:text-ink hover:underline"
            }`}
          >
            Ask
          </button>
          <button
            ref={tabReportRef}
            role="tab"
            id="tab-report"
            aria-selected={activeTab === "report"}
            aria-controls="tabpanel-report"
            tabIndex={activeTab === "report" ? 0 : -1}
            onClick={() => setActiveTab("report")}
            onKeyDown={(e) => handleTabKeyDown(e, "report")}
            className={`pb-2.5 px-3 text-sm font-bold min-h-[44px] flex items-center transition-colors ${
              activeTab === "report"
                ? "border-b-2 border-ink text-ink font-extrabold"
                : "text-ink-muted hover:text-ink hover:underline"
            }`}
          >
            Report a hazard
          </button>
        </div>

        {/* 2. Location Line: "Near Shivajinagar (default)" with "Use my location" button */}
        <LocationLine contextState={userContextState} />

        {/* 3. Tabpanels */}
        <div
          role="tabpanel"
          id="tabpanel-ask"
          aria-labelledby="tab-ask"
          hidden={activeTab !== "ask"}
          tabIndex={0}
          className="outline-hidden"
        >
          <AssistantSection
            userContext={userContextState.context}
            contextState={userContextState}
            onAssistantResponse={handleAssistantResponse}
            selectedRouteType={selectedRouteType}
            onSelectRoute={setSelectedRouteType}
          />
        </div>

        <div
          role="tabpanel"
          id="tabpanel-report"
          aria-labelledby="tab-report"
          hidden={activeTab !== "report"}
          tabIndex={0}
          className="outline-hidden"
        >
          <ReportIssueSection
            currentLocation={userContextState.context.location}
            onRequestLocation={userContextState.requestCurrentLocation}
          />
        </div>
      </div>
    </div>
  );
}
