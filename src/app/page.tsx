"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useUserContext, ContextPanel, AssistantSection, ReportIssueSection } from "@/components";
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
      className="w-full h-full min-h-[300px] border border-border bg-ground flex items-center justify-center text-ink-muted text-xs font-semibold"
    >
      Loading Pune city map canvas...
    </div>
  ),
});

export default function HomePage() {
  const userContextState = useUserContext();

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

  return (
    <div className="flex-1 flex flex-col lg:flex-row lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
      {/* Accessible primary heading */}
      <h1 className="sr-only">Puneri Safar &mdash; Pune City Navigation and Road Safety</h1>

      {/* Left Pane on Desktop (Scrolls independently), Bottom on Mobile */}
      <div className="order-2 lg:order-1 w-full lg:w-[440px] lg:h-full lg:overflow-y-auto p-4 sm:p-5 space-y-4 shrink-0 border-r border-border bg-ground">
        <ContextPanel contextState={userContextState} />
        <AssistantSection
          userContext={userContextState.context}
          onAssistantResponse={handleAssistantResponse}
          selectedRouteType={selectedRouteType}
          onSelectRoute={setSelectedRouteType}
        />
        <ReportIssueSection currentLocation={userContextState.context.location} />
      </div>

      {/* Right Pane on Desktop (Full height), Top on Mobile (40vh) */}
      <div className="order-1 lg:order-2 w-full h-[40vh] min-h-[280px] lg:h-full lg:flex-1 flex flex-col border-b lg:border-b-0 border-border">
        <MapView
          center={userContextState.context.location}
          places={places}
          routes={routes}
          selectedRouteType={selectedRouteType}
          onSelectRoute={setSelectedRouteType}
          className="h-full flex-1"
        />
      </div>
    </div>
  );
}
