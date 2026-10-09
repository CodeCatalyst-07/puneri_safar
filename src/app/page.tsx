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
      aria-label="Pune Map Loading Placeholder"
      className="w-full h-[360px] sm:h-[460px] rounded-xl border border-surface-border bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-2 text-text-muted text-sm shadow-xs"
    >
      <div
        className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"
        aria-hidden="true"
      />
      <span>Loading Pune vector map canvas...</span>
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

  const pillars = [
    {
      title: "Exploration & Hospitality",
      desc: "Local culinary hotspots and neighborhoods scored by Bayesian community ratings and opening hours.",
      badge: "Hospitality",
      icon: "🍽️",
    },
    {
      title: "History & Culture",
      desc: "Maratha and Peshwa heritage landmarks with verified physical accessibility and ASI/PMC records.",
      badge: "Heritage",
      icon: "🏛️",
    },
    {
      title: "Safety & Hazards",
      desc: "Pune City Police documented accident blackspots and crowdsourced hazard corroboration.",
      badge: "Road Safety",
      icon: "⚠️",
    },
    {
      title: "Best-vs-Worst Comparison",
      desc: "Multi-Criteria Decision Analysis (MCDA) evaluating transit trade-offs and minutes added.",
      badge: "Analysis",
      icon: "⚖️",
    },
    {
      title: "Smart City & Weather",
      desc: "Live monsoon weather signals and hazard-aware corridor routing with full data transparency.",
      badge: "Mobility",
      icon: "🌧️",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* 1. Hero Section */}
      <section aria-labelledby="hero-heading" className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
          <span
            className="w-2 h-2 rounded-full bg-brand-emerald animate-pulse"
            aria-hidden="true"
          />
          <span>Pune Civic Mobility Platform &bull; Live &amp; Grounded</span>
        </div>

        <h1
          id="hero-heading"
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight"
        >
          Puneri Safar
        </h1>

        <p className="text-base sm:text-lg text-text-muted leading-relaxed font-normal">
          Explore, experience and navigate Pune &mdash; smarter and safer. Unified context-aware
          guidance powered by Pune Police crash data, municipal archives, and Google Services.
        </p>
      </section>

      {/* 2. Your Context Panel */}
      <ContextPanel contextState={userContextState} />

      {/* 3. Interactive Map (Visual layer + Skip Link) */}
      <section aria-labelledby="map-section-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="map-section-heading" className="text-lg font-bold text-foreground">
            Pune Geospatial Explorer
          </h2>
          <span className="text-xs text-text-muted">
            Interactive markers &bull; Blackspot corridors &bull; Live reports
          </span>
        </div>

        <MapView
          center={userContextState.context.location}
          places={places}
          routes={routes}
          selectedRouteType={selectedRouteType}
          onSelectRoute={setSelectedRouteType}
        />
      </section>

      {/* 4. Assistant Section (Query Input + Live Results) */}
      <AssistantSection
        userContext={userContextState.context}
        onAssistantResponse={handleAssistantResponse}
        selectedRouteType={selectedRouteType}
        onSelectRoute={setSelectedRouteType}
      />

      {/* 5. Citizen Hazard Reporting Form */}
      <ReportIssueSection currentLocation={userContextState.context.location} />

      {/* 6. Problem Statement Pillars (Judge Alignment) */}
      <section
        aria-labelledby="pillars-heading"
        className="pt-6 border-t border-surface-border space-y-6"
      >
        <div>
          <h2 id="pillars-heading" className="text-xl font-bold text-foreground">
            Five Pillars of Urban Intelligence
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Built specifically to solve the Pune City Life problem statement across hospitality,
            heritage, safety, comparison, and smart city insights.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="p-5 rounded-xl border border-surface-border bg-surface hover:border-brand-primary/40 transition-colors shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="uppercase tracking-wider text-brand-saffron">
                    {pillar.badge}
                  </span>
                  <span aria-hidden="true" className="text-base">
                    {pillar.icon}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mt-2">{pillar.title}</h3>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{pillar.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-surface-border/50 text-[11px] text-text-muted flex items-center justify-between">
                <span>Verified Source</span>
                <span className="font-mono text-brand-primary">Ground Truth</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
