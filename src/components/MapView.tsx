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
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
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

  // Layer toggles
  const [showBlackspots, setShowBlackspots] = useState(true);
  const [showCitizenReports, setShowCitizenReports] = useState(true);

  // Layer data
  const [blackspots, setBlackspots] = useState<BlackspotPoint[]>([]);
  const [reports, setReports] = useState<CitizenReportPoint[]>([]);

  // 1. Fetch crash-prone spots and reports
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
        // Map continues gracefully if layer fetch fails
      }
    }

    fetchLayers();
    return () => {
      active = false;
    };
  }, [center.lat, center.lng]);

  // 2. Load Google Maps script
  useEffect(() => {
    if (!apiKey) return;
    if (window.google?.maps) {
      return;
    }

    const scriptId = "google-maps-script";
    const existing = document.getElementById(scriptId);

    if (existing) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
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
      setLoadError("Could not load Google Maps JavaScript API. Operating in accessible text-first mode.");
    };

    document.head.appendChild(script);
  }, [apiKey]);

  // 3. Initialize Map instance with uncluttered controls
  useEffect(() => {
    const maps = window.google?.maps;
    if (!mapLoaded || !mapContainerRef.current || !maps) return;

    if (!mapInstanceRef.current) {
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;
      const mapOptions: Record<string, unknown> = {
        center: { lat: center.lat, lng: center.lng },
        zoom: 12,
        disableDefaultUI: false,
        mapTypeControl: false,
        streetViewControl: false,
        cameraControl: false,
        clickableIcons: false,
        zoomControl: true,
        fullscreenControl: true,
      };

      if (mapId) {
        mapOptions.mapId = mapId;
      } else {
        mapOptions.styles = [
          { featureType: "poi.business", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        ];
      }

      mapInstanceRef.current = new maps.Map(mapContainerRef.current, mapOptions);
    } else {
      mapInstanceRef.current.panTo({ lat: center.lat, lng: center.lng });
    }
  }, [mapLoaded, center.lat, center.lng]);

  // 4. Update markers and polylines
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

    // A. User location (Deep basalt circle)
    const userMarker = new maps.Marker({
      position: { lat: center.lat, lng: center.lng },
      map,
      title: "Your location",
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#16262B",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      },
      zIndex: 900,
    });
    markersRef.current.push(userMarker);
    bounds.extend({ lat: center.lat, lng: center.lng });
    hasCoords = true;

    // B. Place markers (Numbered ink pins)
    places.forEach((rp, idx) => {
      const lat = rp.place.lat;
      const lng = rp.place.lng;

      const placePinSvg = `data:image/svg+xml;utf-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="32" viewBox="0 0 26 32">
          <path d="M13,0 C5.8,0 0,5.8 0,13 C0,22 13,32 13,32 C13,32 26,22 26,13 C26,5.8 20.2,0 13,0 Z" fill="#16262B" stroke="#FFFFFF" stroke-width="1.5"/>
          <circle cx="13" cy="12" r="7.5" fill="#FFFFFF"/>
          <text x="13" y="15.5" font-size="10" font-weight="bold" font-family="sans-serif" text-anchor="middle" fill="#16262B">${idx + 1}</text>
        </svg>
      `)}`;

      const marker = new maps.Marker({
        position: { lat, lng },
        map,
        title: `${idx + 1}. ${rp.place.name} (Score: ${rp.score}/100)`,
        icon: {
          url: placePinSvg,
          scaledSize: new maps.Size(26, 32),
          anchor: new maps.Point(13, 32),
        },
        zIndex: 800,
      });

      const infoWindow = new maps.InfoWindow({
        content: `
          <div style="padding: 4px; font-family: sans-serif; color: #16262B;">
            <strong>${idx + 1}. ${rp.place.name}</strong>
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

    // C. Crash-prone spots (28px Red warning triangle with white exclamation mark)
    if (showBlackspots) {
      const crashTriangleSvg = `data:image/svg+xml;utf-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
          <polygon points="14,2 27,25 1,25" fill="#C62828" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
          <rect x="13" y="9" width="2" height="7.5" fill="#FFFFFF" rx="0.5"/>
          <circle cx="14" cy="20.5" r="1.3" fill="#FFFFFF"/>
        </svg>
      `)}`;

      blackspots.forEach((bs) => {
        const marker = new maps.Marker({
          position: { lat: bs.lat, lng: bs.lng },
          map,
          title: `Crash-prone spot: ${bs.name}`,
          icon: {
            url: crashTriangleSvg,
            scaledSize: new maps.Size(28, 28),
            anchor: new maps.Point(14, 25),
          },
          zIndex: 1000,
        });

        const info = new maps.InfoWindow({
          content: `
            <div style="padding: 4px; font-family: sans-serif; color: #16262B;">
              <strong style="color: #C62828;">Crash-prone spot</strong>
              <div style="font-size: 13px; font-weight: 600; margin-top: 2px;">${bs.name}</div>
              <div style="font-size: 11px; color: #425257; margin-top: 2px;">Pune Police report &bull; ${bs.crashCount ? bs.crashCount + " crashes" : "Listed spot"}</div>
            </div>
          `,
        });

        marker.addListener?.("click", () => {
          info.open(map, marker);
        });

        markersRef.current.push(marker);
      });
    }

    // D. Reports from people nearby (Amber circle with ink outline)
    if (showCitizenReports) {
      const citizenReportSvg = `data:image/svg+xml;utf-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="9" fill="#F2B705" stroke="#16262B" stroke-width="2"/>
          <circle cx="11" cy="11" r="3.5" fill="#16262B"/>
        </svg>
      `)}`;

      reports.forEach((rep) => {
        const marker = new maps.Marker({
          position: { lat: rep.lat, lng: rep.lng },
          map,
          title: `Report: ${rep.summary || rep.category}`,
          icon: {
            url: citizenReportSvg,
            scaledSize: new maps.Size(22, 22),
            anchor: new maps.Point(11, 11),
          },
          zIndex: 500,
        });

        const info = new maps.InfoWindow({
          content: `
            <div style="padding: 4px; font-family: sans-serif; color: #16262B;">
              <strong>Report from person nearby (${rep.status})</strong>
              <div style="font-size: 12px; margin-top: 2px;">${rep.summary || rep.category}</div>
              <div style="font-size: 11px; color: #425257; margin-top: 2px;">Severity: ${rep.severity}/3 (shared to ~100m)</div>
            </div>
          `,
        });

        marker.addListener?.("click", () => {
          info.open(map, marker);
        });

        markersRef.current.push(marker);
      });
    }

    // E. Route polylines (Solid slate blue vs Dashed highway green)
    if (routes) {
      const isFastestActive = selectedRouteType === "fastest";
      const isFewestActive = selectedRouteType === "fewest_hazards";

      // 1. Fastest Route (Solid blue-grey line)
      if (routes.fastest?.polyline?.length) {
        const fastestPath = routes.fastest.polyline.map((p) => ({ lat: p.lat, lng: p.lng }));
        const fastestPolyline = new maps.Polyline({
          path: fastestPath,
          geodesic: true,
          strokeColor: "#355061",
          strokeOpacity: isFastestActive ? 1 : 0.45,
          strokeWeight: isFastestActive ? 6 : 4,
          zIndex: isFastestActive ? 30 : 10,
          map,
        });

        fastestPolyline.addListener?.("click", () => {
          onSelectRoute?.("fastest");
        });

        polylinesRef.current.push(fastestPolyline);
        fastestPath.forEach((pt) => bounds.extend(pt));
        hasCoords = true;
      }

      // 2. Fewer Known Hazards Route (Dashed thick highway green line)
      if (routes.fewestHazards?.polyline?.length) {
        const fewestPath = routes.fewestHazards.polyline.map((p) => ({ lat: p.lat, lng: p.lng }));

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
                strokeOpacity: isFewestActive ? 1 : 0.5,
                strokeColor: "#0E7A4B",
                scale: isFewestActive ? 4 : 3,
              },
              offset: "0",
              repeat: "16px",
            },
          ],
          zIndex: isFewestActive ? 35 : 15,
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
      aria-label="Pune city map"
      className={`relative w-full h-full min-h-0 bg-ground ${className}`}
    >
      {/* Skip map link for accessibility (WCAG 2.4.1) */}
      <a href="#assistant-results" className="skip-link">
        Skip map to results list
      </a>

      {/* Layer controls overlay (Top-left, compact) */}
      <div className="absolute top-3 left-3 z-10 bg-surface border border-border p-2 rounded-[4px] shadow-xs flex items-center gap-3 text-xs">
        <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-ink">
          <input
            type="checkbox"
            checked={showBlackspots}
            onChange={(e) => setShowBlackspots(e.target.checked)}
            className="w-4 h-4 text-crash-red border-border rounded-[2px] focus:ring-sign-blue"
          />
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="text-crash-red font-bold">
              ▲
            </span>
            <span>Crash spots ({blackspots.length})</span>
          </span>
        </label>

        <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-ink">
          <input
            type="checkbox"
            checked={showCitizenReports}
            onChange={(e) => setShowCitizenReports(e.target.checked)}
            className="w-4 h-4 text-caution border-border rounded-[2px] focus:ring-sign-blue"
          />
          <span className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full bg-caution inline-block border border-ink"
            />
            <span>Reports ({reports.length})</span>
          </span>
        </label>
      </div>

      {/* Overlaid Legend (Bottom-left) */}
      <div className="absolute bottom-3 left-3 z-10 bg-surface border border-border p-2 rounded-[4px] shadow-xs text-xs space-y-1">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <span className="text-crash-red font-bold">▲</span>
          <span>Crash-prone spot (Pune Police)</span>
        </div>
        <div className="flex items-center gap-2 font-semibold text-ink">
          <span className="w-2.5 h-2.5 rounded-full bg-caution border border-ink inline-block" />
          <span>Report from person nearby</span>
        </div>
        {routes && (
          <>
            <div className="flex items-center gap-2 text-ink-muted">
              <span className="w-4 h-1 bg-route-fast inline-block" />
              <span>Solid: Fastest</span>
            </div>
            <div className="flex items-center gap-2 text-ink-muted">
              <span className="w-4 h-1 border-b-2 border-dashed border-route-green inline-block" />
              <span>Dashed: Fewer hazards</span>
            </div>
          </>
        )}
      </div>

      {/* Map Canvas - Absolutely fills entire container */}
      <div className="absolute inset-0 w-full h-full">
        {effectiveError ? (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-surface border-l-4 border-caution text-ink">
            <p className="font-bold text-sm mb-1">Interactive map unavailable</p>
            <p className="text-xs text-ink-muted max-w-md">{effectiveError}</p>
            <p className="text-xs text-ink-muted mt-2">
              Puneri Safar continues in text-first mode. All routes, hazard ratings, and places are
              listed in the left panel.
            </p>
          </div>
        ) : !mapLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted text-xs">
            <span>Loading Pune city map canvas...</span>
          </div>
        ) : null}

        <div
          ref={mapContainerRef}
          className="absolute inset-0 w-full h-full"
          tabIndex={0}
          aria-label="Map Canvas - Use keyboard controls or pan and zoom controls"
        />
      </div>
    </section>
  );
}
