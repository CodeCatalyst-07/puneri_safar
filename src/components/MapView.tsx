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
  className?: string;
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
  className = "",
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
    ? "Google Maps browser API key not configured (NEXT_PUBLIC_GOOGLE_MAPS_KEY missing)."
    : loadError;

  // Layer Toggles (Plain sentence case, road-sign terminology)
  const [showBlackspots, setShowBlackspots] = useState(true);
  const [showCitizenReports, setShowCitizenReports] = useState(true);

  // Layer Data
  const [blackspots, setBlackspots] = useState<BlackspotPoint[]>([]);
  const [reports, setReports] = useState<CitizenReportPoint[]>([]);

  // 1. Fetch Crash-Prone Spots and Community Reports
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
        // Map remains usable even if supplementary layers fail
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
        const winGoogle = window.google;
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
      setLoadError("Could not load Google Maps JavaScript API. Operating in accessible list mode.");
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

  // 4. Update Markers & Polylines with Road-Sign Vocabulary
  useEffect(() => {
    const maps = window.google?.maps;
    if (!mapInstanceRef.current || !maps) return;

    const map = mapInstanceRef.current;

    // Clear previous overlays
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const bounds = new maps.LatLngBounds();
    let hasCoords = false;

    // A. User Location Marker (Deep Basalt Circle)
    const userMarker = new maps.Marker({
      position: { lat: center.lat, lng: center.lng },
      map,
      title: "Your location: Shivajinagar",
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#16262B",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      },
    });
    markersRef.current.push(userMarker);
    bounds.extend({ lat: center.lat, lng: center.lng });
    hasCoords = true;

    // B. Places Result Markers (Highway Blue with Numbers)
    places.forEach((rp, idx) => {
      const lat = rp.place.lat;
      const lng = rp.place.lng;
      const marker = new maps.Marker({
        position: { lat, lng },
        map,
        title: `${rp.place.name} (Score: ${rp.score}/100)`,
        label: {
          text: String(idx + 1),
          color: "#FFFFFF",
          fontWeight: "bold",
          fontSize: "11px",
        },
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#0B5CAD",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
      });

      const infoWindow = new maps.InfoWindow({
        content: `
          <div style="padding: 4px; font-family: sans-serif; color: #16262B;">
            <strong>${rp.place.name}</strong>
            <div style="font-size: 12px; margin-top: 2px;">Score: ${rp.score}/100, Rating: ${rp.place.rating ?? "No data"}/5</div>
            <div style="font-size: 11px; color: #425257; margin-top: 3px;">${rp.reasons.slice(0, 2).join(". ")}</div>
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

    // C. Crash-Prone Spots Layer (Red Warning Triangle)
    if (showBlackspots) {
      blackspots.forEach((bs) => {
        const marker = new maps.Marker({
          position: { lat: bs.lat, lng: bs.lng },
          map,
          title: `Crash-prone spot: ${bs.name}`,
          icon: {
            path: "M 0,-10 L 9,8 L -9,8 Z", // Triangle glyph
            fillColor: "#C62828",
            fillOpacity: 1,
            strokeColor: "#FFFFFF",
            strokeWeight: 1.5,
            scale: 1.2,
          },
        });

        const info = new maps.InfoWindow({
          content: `
            <div style="padding: 4px; font-family: sans-serif; color: #16262B;">
              <strong style="color: #C62828;">Crash-prone spot (police audit)</strong>
              <div style="font-size: 13px; font-weight: 600; margin-top: 2px;">${bs.name}</div>
              <div style="font-size: 11px; color: #425257; margin-top: 2px;">Documented crashes: ${bs.crashCount ?? "Listed in traffic audit"}</div>
            </div>
          `,
        });

        marker.addListener?.("click", () => {
          info.open(map, marker);
        });

        markersRef.current.push(marker);
      });
    }

    // D. Reports from People Nearby (Amber Circle)
    if (showCitizenReports) {
      reports.forEach((rep) => {
        const marker = new maps.Marker({
          position: { lat: rep.lat, lng: rep.lng },
          map,
          title: `Report from person nearby: ${rep.summary || rep.category}`,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: "#F2B705",
            fillOpacity: 1,
            strokeColor: "#16262B",
            strokeWeight: 1.5,
          },
        });

        const info = new maps.InfoWindow({
          content: `
            <div style="padding: 4px; font-family: sans-serif; color: #16262B;">
              <strong>Report from person nearby (${rep.status})</strong>
              <div style="font-size: 12px; margin-top: 2px;">${rep.summary || rep.category}</div>
              <div style="font-size: 11px; color: #425257; margin-top: 2px;">Severity level: ${rep.severity}/3 (approx ~100m)</div>
            </div>
          `,
        });

        marker.addListener?.("click", () => {
          info.open(map, marker);
        });

        markersRef.current.push(marker);
      });
    }

    // E. Route Polylines (Solid Slate vs Dashed Green)
    if (routes) {
      const isFastestActive = selectedRouteType === "fastest";

      // 1. Fastest Route (Solid Slate Blue)
      if (routes.fastest?.polyline?.length) {
        const fastestPath = routes.fastest.polyline.map((p) => ({ lat: p.lat, lng: p.lng }));
        const fastestPolyline = new maps.Polyline({
          path: fastestPath,
          geodesic: true,
          strokeColor: "#355061",
          strokeOpacity: isFastestActive ? 1 : 0.5,
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

      // 2. Fewer Known Hazards Route (Dashed Highway Green)
      if (routes.fewestHazards?.polyline?.length) {
        const fewestPath = routes.fewestHazards.polyline.map((p) => ({ lat: p.lat, lng: p.lng }));
        const isFewestActive = selectedRouteType === "fewest_hazards";

        const dashedPolyline = new maps.Polyline({
          path: fewestPath,
          geodesic: true,
          strokeColor: "#0E7A4B",
          strokeOpacity: 0,
          strokeWeight: isFewestActive ? 6 : 4,
          icons: [
            {
              icon: {
                path: "M 0,-1 0,1",
                strokeOpacity: isFewestActive ? 1 : 0.6,
                strokeColor: "#0E7A4B",
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

    // Fit map bounds if routes or places are active
    if (hasCoords && (places.length > 0 || routes)) {
      map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
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
      aria-label="Pune city map"
      className={`relative border border-border bg-ground flex flex-col ${className}`}
    >
      {/* Skip Map Link for Accessibility (WCAG 2.4.1) */}
      <a href="#assistant-results" className="skip-link">
        Skip map to results list
      </a>

      {/* Layer Controls & Overlaid Road Sign Legend */}
      <div className="p-2.5 bg-surface border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
        <fieldset className="flex items-center gap-4">
          <legend className="sr-only">Layer visibility toggles</legend>
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-ink">
            <input
              type="checkbox"
              checked={showBlackspots}
              onChange={(e) => setShowBlackspots(e.target.checked)}
              className="w-4 h-4 text-crash-red border-border rounded-xs focus:ring-sign-blue"
            />
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="text-crash-red font-bold">
                ▲
              </span>
              <span>Crash-prone spots ({blackspots.length})</span>
            </span>
          </label>

          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-ink">
            <input
              type="checkbox"
              checked={showCitizenReports}
              onChange={(e) => setShowCitizenReports(e.target.checked)}
              className="w-4 h-4 text-caution border-border rounded-xs focus:ring-sign-blue"
            />
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-full bg-caution inline-block border border-ink"
              />
              <span>Reports from people nearby ({reports.length})</span>
            </span>
          </label>
        </fieldset>

        {/* Legend for active routes */}
        {routes && (
          <div className="flex items-center gap-3 font-semibold text-ink-muted text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-1 bg-route-fast inline-block" aria-hidden="true" />
              <span>Solid: Fastest</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-3 h-1 border-b-2 border-dashed border-route-green inline-block"
                aria-hidden="true"
              />
              <span>Dashed: Fewer hazards</span>
            </span>
          </div>
        )}
      </div>

      {/* Map Canvas / Fallback Notice */}
      <div className="relative w-full flex-1 min-h-[340px] bg-ground">
        {effectiveError ? (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-surface border-l-4 border-caution text-ink">
            <p className="font-bold text-sm mb-1">Interactive map unavailable</p>
            <p className="text-xs text-ink-muted max-w-md">{effectiveError}</p>
            <p className="text-xs text-ink-muted mt-2">
              Puneri Safar continues in text-first mode. All routes, hazard ratings, and places are
              listed below.
            </p>
          </div>
        ) : !mapLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted text-xs">
            <span>Loading Pune city map canvas...</span>
          </div>
        ) : null}

        <div
          ref={mapContainerRef}
          className="w-full h-full min-h-[340px]"
          tabIndex={0}
          aria-label="Map Canvas - Use keyboard controls or pan and zoom controls"
        />
      </div>
    </section>
  );
}
