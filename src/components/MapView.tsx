"use client";

import React, { useEffect, useRef, useState } from "react";
import { LatLng } from "@/core/types";
import { RankedPlace } from "@/core/ranking";
import { ScoredRouteSummary } from "@/services/assistant";
import { RouteChoiceTradeoff } from "@/core/safety";

export interface MapViewProps {
  center: LatLng;
  places?: RankedPlace[];
  routes?: {
    fastest: ScoredRouteSummary;
    fewestHazards: ScoredRouteSummary;
    tradeoff: RouteChoiceTradeoff;
  };
  selectedRouteType?: "fastest" | "fewest_hazards";
  onSelectRoute?: (type: "fastest" | "fewest_hazards") => void;
}

interface BlackspotPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  crashCount?: number | null;
  evidenceLevel?: string;
}

interface CitizenReportPoint {
  id: string;
  category: string;
  severity: number;
  lat: number;
  lng: number;
  status: string;
  summary?: string;
}

// Minimal Google Maps JavaScript API types to avoid unneeded external dependencies
export interface GoogleMapInstance {
  panTo: (coords: { lat: number; lng: number }) => void;
  fitBounds: (bounds: GoogleBoundsInstance, padding?: unknown) => void;
}

export interface GoogleBoundsInstance {
  extend: (coords: { lat: number; lng: number }) => void;
}

export interface GoogleOverlayInstance {
  setMap: (map: GoogleMapInstance | null) => void;
  addListener?: (event: string, handler: () => void) => void;
}

export interface GoogleInfoWindowInstance {
  setContent: (content: string) => void;
  open: (map: GoogleMapInstance, anchor?: unknown) => void;
  close: () => void;
}

export interface GoogleMapsNamespace {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  LatLngBounds: new () => GoogleBoundsInstance;
  Marker: new (options: Record<string, unknown>) => GoogleOverlayInstance;
  InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindowInstance;
  Polyline: new (options: Record<string, unknown>) => GoogleOverlayInstance;
  SymbolPath: {
    CIRCLE: unknown;
    FORWARD_CLOSED_ARROW: unknown;
    [key: string]: unknown;
  };
}

declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsNamespace;
      [key: string]: unknown;
    };
    initGoogleMapCallback?: () => void;
  }
}

export default function MapView({
  center,
  places = [],
  routes,
  selectedRouteType = "fewest_hazards",
  onSelectRoute,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleOverlayInstance[]>([]);
  const polylinesRef = useRef<GoogleOverlayInstance[]>([]);

  const [mapLoaded, setMapLoaded] = useState(() => {
    if (typeof window !== "undefined") {
      return Boolean(window.google?.maps);
    }
    return false;
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const effectiveError = !apiKey
    ? "Google Maps public key not configured (NEXT_PUBLIC_GOOGLE_MAPS_KEY missing)."
    : loadError;

  // Layer Toggles
  const [showBlackspots, setShowBlackspots] = useState(true);
  const [showCitizenReports, setShowCitizenReports] = useState(true);

  // Layer Data
  const [blackspots, setBlackspots] = useState<BlackspotPoint[]>([]);
  const [reports, setReports] = useState<CitizenReportPoint[]>([]);

  // 1. Fetch Blackspots and Citizen Reports for background layers
  useEffect(() => {
    let active = true;

    async function fetchLayers() {
      try {
        const [bsRes, repRes] = await Promise.all([
          fetch("/api/blackspots"),
          fetch(`/api/reports?lat=${center.lat}&lng=${center.lng}&radiusMeters=15000`),
        ]);

        if (bsRes.ok && active) {
          const bsJson = await bsRes.json();
          if (bsJson.success && Array.isArray(bsJson.data)) {
            setBlackspots(bsJson.data);
          }
        }

        if (repRes.ok && active) {
          const repJson = await repRes.json();
          if (repJson.success && repJson.data?.corroborated) {
            setReports(repJson.data.corroborated);
          }
        }
      } catch {
        // Silently tolerate layer fetch error; map remains usable
      }
    }

    fetchLayers();
    return () => {
      active = false;
    };
  }, [center.lat, center.lng]);

  // 2. Load Google Maps JavaScript API
  useEffect(() => {
    if (!apiKey) return;

    if (window.google?.maps) {
      return;
    }

    const scriptId = "google-maps-script";
    const existing = document.getElementById(scriptId);

    if (existing) {
      const checkLoaded = setInterval(() => {
        const winGoogle = window.google as { maps?: unknown } | undefined;
        if (winGoogle?.maps) {
          clearInterval(checkLoaded);
          setMapLoaded(true);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setMapLoaded(true);
    };

    script.onerror = () => {
      setLoadError("Failed to load Google Maps JavaScript API. Using list-only accessible mode.");
    };

    document.head.appendChild(script);
  }, [apiKey]);

  // 3. Initialize Map Instance
  useEffect(() => {
    const maps = window.google?.maps;
    if (!mapLoaded || !mapContainerRef.current || !maps) return;

    if (!mapInstanceRef.current) {
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;
      mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom: 12,
        mapId: mapId || undefined,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });
    } else {
      mapInstanceRef.current.panTo({ lat: center.lat, lng: center.lng });
    }
  }, [mapLoaded, center.lat, center.lng]);

  // 4. Update Markers & Polylines when data or toggles change
  useEffect(() => {
    const maps = window.google?.maps;
    if (!mapInstanceRef.current || !maps) return;

    const map = mapInstanceRef.current;

    // Clear previous markers and polylines
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const bounds = new maps.LatLngBounds();
    let hasCoords = false;

    // A. User Context Center Marker
    const userMarker = new maps.Marker({
      position: { lat: center.lat, lng: center.lng },
      map,
      title: "Your Selected Location (Pune)",
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#0369a1",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
    });
    markersRef.current.push(userMarker);
    bounds.extend({ lat: center.lat, lng: center.lng });
    hasCoords = true;

    // B. Places Result Markers
    places.forEach((rp, idx) => {
      const lat = rp.place.lat;
      const lng = rp.place.lng;
      const marker = new maps.Marker({
        position: { lat, lng },
        map,
        title: `${idx + 1}. ${rp.place.name} (Score: ${rp.score}/100)`,
        label: {
          text: String(idx + 1),
          color: "#ffffff",
          fontWeight: "bold",
          fontSize: "12px",
        },
      });

      const infoWindow = new maps.InfoWindow({
        content: `
          <div style="padding: 4px; font-family: sans-serif; color: #0f172a;">
            <strong>${rp.place.name}</strong>
            <div style="font-size: 12px; margin-top: 2px;">Score: <b>${rp.score}/100</b> &bull; Rating: ${rp.place.rating ?? "No data"}/5</div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">${rp.reasons.slice(0, 2).join(". ")}</div>
          </div>
        `,
      });

      marker.addListener?.("click", () => {
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
      hasCoords = true;
    });

    // C. Accident Blackspots Layer
    if (showBlackspots) {
      blackspots.forEach((bs) => {
        const marker = new maps.Marker({
          position: { lat: bs.lat, lng: bs.lng },
          map,
          title: `Known road-crash location: ${bs.name}`,
          icon: {
            path: "M 0,-10 L 9,8 L -9,8 Z", // Triangle warning shape
            fillColor: "#dc2626",
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
            scale: 1.2,
          },
        });

        const info = new maps.InfoWindow({
          content: `
            <div style="padding: 4px; font-family: sans-serif; color: #991b1b;">
              <strong style="color: #b91c1c;">⚠️ Known road-crash location</strong>
              <div style="font-size: 13px; font-weight: 600; margin-top: 2px;">${bs.name}</div>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">Documented crashes: ${bs.crashCount ?? "Listed in police audit"}</div>
            </div>
          `,
        });

        marker.addListener?.("click", () => {
          info.open(map, marker);
        });

        markersRef.current.push(marker);
      });
    }

    // D. Citizen Reports Layer
    if (showCitizenReports) {
      reports.forEach((rep) => {
        const marker = new maps.Marker({
          position: { lat: rep.lat, lng: rep.lng },
          map,
          title: `Citizen Report: ${rep.summary || rep.category}`,
          icon: {
            path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            fillColor: "#ea580c",
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 1,
          },
        });

        const info = new maps.InfoWindow({
          content: `
            <div style="padding: 4px; font-family: sans-serif; color: #0f172a;">
              <strong style="color: #c2410c;">Community Hazard (${rep.status})</strong>
              <div style="font-size: 12px; margin-top: 2px;">${rep.summary || rep.category}</div>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">Severity level: ${rep.severity}/3 (approx ~100m)</div>
            </div>
          `,
        });

        marker.addListener?.("click", () => {
          info.open(map, marker);
        });

        markersRef.current.push(marker);
      });
    }

    // E. Route Polylines
    if (routes) {
      const isFastestActive = selectedRouteType === "fastest";

      // 1. Fastest Route (Solid Blue)
      if (routes.fastest?.polyline?.length) {
        const fastestPath = routes.fastest.polyline.map((p) => ({ lat: p.lat, lng: p.lng }));
        const fastestPolyline = new maps.Polyline({
          path: fastestPath,
          geodesic: true,
          strokeColor: "#2563eb",
          strokeOpacity: isFastestActive ? 0.95 : 0.5,
          strokeWeight: isFastestActive ? 6 : 4,
          zIndex: isFastestActive ? 20 : 10,
          map,
        });

        fastestPolyline.addListener?.("click", () => {
          onSelectRoute?.("fastest");
        });

        polylinesRef.current.push(fastestPolyline);
        fastestPath.forEach((pt) => bounds.extend(pt));
        hasCoords = true;
      }

      // 2. Fewest Hazards Route (Dashed Emerald Green)
      if (routes.fewestHazards?.polyline?.length) {
        const fewestPath = routes.fewestHazards.polyline.map((p) => ({ lat: p.lat, lng: p.lng }));
        const isFewestActive = selectedRouteType === "fewest_hazards";

        const dashedPolyline = new maps.Polyline({
          path: fewestPath,
          geodesic: true,
          strokeColor: "#059669",
          strokeOpacity: 0,
          strokeWeight: isFewestActive ? 6 : 4,
          icons: [
            {
              icon: {
                path: "M 0,-1 0,1",
                strokeOpacity: isFewestActive ? 1 : 0.6,
                strokeColor: "#059669",
                scale: isFewestActive ? 4 : 3,
              },
              offset: "0",
              repeat: "16px",
            },
          ],
          zIndex: isFewestActive ? 25 : 15,
          map,
        });

        dashedPolyline.addListener?.("click", () => {
          onSelectRoute?.("fewest_hazards");
        });

        polylinesRef.current.push(dashedPolyline);
        fewestPath.forEach((pt) => bounds.extend(pt));
        hasCoords = true;
      }
    }

    // Fit map bounds if routes or places are displayed
    if (hasCoords && (places.length > 0 || routes)) {
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }, [
    mapLoaded,
    places,
    routes,
    selectedRouteType,
    showBlackspots,
    showCitizenReports,
    blackspots,
    reports,
    center.lat,
    center.lng,
    onSelectRoute,
  ]);

  return (
    <section
      role="region"
      aria-label="Interactive Pune City Map"
      className="relative rounded-xl border border-surface-border bg-surface overflow-hidden shadow-xs flex flex-col"
    >
      {/* Skip Map Link for Accessibility (WCAG 2.4.1 Bypass Blocks) */}
      <a href="#assistant-results" className="skip-link">
        Skip map to results list
      </a>

      {/* Layer Controls Header */}
      <div className="p-3 bg-surface border-b border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <fieldset className="flex items-center gap-4">
          <legend className="sr-only">Map layer visibility toggles</legend>
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-foreground">
            <input
              type="checkbox"
              checked={showBlackspots}
              onChange={(e) => setShowBlackspots(e.target.checked)}
              className="rounded border-surface-border text-red-600 focus:ring-brand-primary h-4 w-4"
            />
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="text-red-600 font-bold">
                ▲
              </span>
              <span>Blackspots ({blackspots.length})</span>
            </span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-foreground">
            <input
              type="checkbox"
              checked={showCitizenReports}
              onChange={(e) => setShowCitizenReports(e.target.checked)}
              className="rounded border-surface-border text-orange-600 focus:ring-brand-primary h-4 w-4"
            />
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="text-orange-600 font-bold">
                ➔
              </span>
              <span>Citizen Reports ({reports.length})</span>
            </span>
          </label>
        </fieldset>

        {routes && (
          <div className="flex items-center gap-3 font-medium text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-1 bg-blue-600 inline-block rounded" aria-hidden="true" />
              <span>Solid: Fastest</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-3 h-1 border-b-2 border-dashed border-emerald-600 inline-block"
                aria-hidden="true"
              />
              <span>Dashed: Fewest Hazards</span>
            </span>
          </div>
        )}
      </div>

      {/* Map Canvas / Fallback Notice */}
      <div className="relative w-full h-[360px] sm:h-[460px] bg-slate-100 dark:bg-slate-900">
        {effectiveError ? (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
            <p className="font-semibold text-base mb-1">Interactive Map Unavailable</p>
            <p className="text-sm max-w-md">{effectiveError}</p>
            <p className="text-xs text-text-muted mt-3">
              Puneri Safar continues operating in text-first accessible mode. All recommendations
              and hazard ratings remain complete below.
            </p>
          </div>
        ) : !mapLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted text-sm">
            <div
              className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <span>Loading Pune vector map canvas...</span>
          </div>
        ) : null}

        <div
          ref={mapContainerRef}
          className="w-full h-full"
          tabIndex={0}
          aria-label="Map Canvas - Use keyboard controls or pan and zoom controls"
        />
      </div>
    </section>
  );
}
