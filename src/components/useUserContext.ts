"use client";

import { useState, useCallback } from "react";
import { UserContext, LatLng } from "@/core/types";
import { isWithinPuneBounds } from "@/core/geo";

export const SHIVAJINAGAR_DEFAULT: LatLng = { lat: 18.5314, lng: 73.8446 };

export interface UserContextState {
  context: UserContext;
  locationStatus: string | null;
  setTravelMode: (mode: UserContext["travelMode"]) => void;
  setBudget: (budget: UserContext["budget"]) => void;
  setSafetyPreference: (pref: UserContext["safetyPreference"]) => void;
  setAccessibilityNeeds: (needs: boolean) => void;
  setLocation: (loc: LatLng) => void;
  requestCurrentLocation: () => void;
}

export function useUserContext(): UserContextState {
  const [context, setContext] = useState<UserContext>({
    location: SHIVAJINAGAR_DEFAULT,
    travelMode: "two_wheeler",
    budget: "medium",
    safetyPreference: "cautious",
    accessibilityNeeds: false,
    language: "en",
  });

  const [locationStatus, setLocationStatus] = useState<string | null>(
    "Default location: Shivajinagar, Pune"
  );

  const setTravelMode = useCallback((travelMode: UserContext["travelMode"]) => {
    setContext((prev) => ({ ...prev, travelMode }));
  }, []);

  const setBudget = useCallback((budget: UserContext["budget"]) => {
    setContext((prev) => ({ ...prev, budget }));
  }, []);

  const setSafetyPreference = useCallback((safetyPreference: UserContext["safetyPreference"]) => {
    setContext((prev) => ({ ...prev, safetyPreference }));
  }, []);

  const setAccessibilityNeeds = useCallback((accessibilityNeeds: boolean) => {
    setContext((prev) => ({ ...prev, accessibilityNeeds }));
  }, []);

  const setLocation = useCallback((location: LatLng) => {
    if (isWithinPuneBounds(location)) {
      setContext((prev) => ({ ...prev, location }));
      setLocationStatus(
        `Custom location set (${location.lat.toFixed(3)}, ${location.lng.toFixed(3)})`
      );
    } else {
      setContext((prev) => ({ ...prev, location: SHIVAJINAGAR_DEFAULT }));
      setLocationStatus("Location was outside Pune boundaries; defaulted to Shivajinagar.");
    }
  }, []);

  const requestCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setContext((prev) => ({ ...prev, location: SHIVAJINAGAR_DEFAULT }));
      setLocationStatus("Geolocation unavailable in your browser; using Shivajinagar fallback.");
      return;
    }

    setLocationStatus("Locating...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: LatLng = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
        };

        if (isWithinPuneBounds(coords)) {
          setContext((prev) => ({ ...prev, location: coords }));
          setLocationStatus(`Using your live Pune location (${coords.lat}, ${coords.lng})`);
        } else {
          setContext((prev) => ({ ...prev, location: SHIVAJINAGAR_DEFAULT }));
          setLocationStatus(
            "Your GPS location is outside the Pune metropolitan area. Defaulted to Shivajinagar (18.5314, 73.8446)."
          );
        }
      },
      (err) => {
        setContext((prev) => ({ ...prev, location: SHIVAJINAGAR_DEFAULT }));
        if (err.code === err.PERMISSION_DENIED) {
          setLocationStatus("Location permission denied. Using Shivajinagar, Pune fallback.");
        } else {
          setLocationStatus("Could not acquire GPS signal. Using Shivajinagar, Pune fallback.");
        }
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  return {
    context,
    locationStatus,
    setTravelMode,
    setBudget,
    setSafetyPreference,
    setAccessibilityNeeds,
    setLocation,
    requestCurrentLocation,
  };
}
