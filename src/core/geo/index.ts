/**
 * @file src/core/geo/index.ts
 * Pure geospatial calculations for Puneri Safar.
 *
 * PURE BUSINESS LOGIC:
 * - Deterministic, floating-point geometry.
 * - No framework or external mapping SDK imports.
 */

import { LatLng } from "../types";

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Standard Pune metropolitan boundary (PMRDA jurisdiction).
 */
export const PUNE_BOUNDS: GeoBounds = {
  minLat: 18.25,
  maxLat: 18.75,
  minLng: 73.65,
  maxLng: 74.15,
};

/**
 * Checks if a coordinate pair falls within Pune PMRDA boundaries.
 */
export function isWithinPuneBounds(coord: LatLng, bounds: GeoBounds = PUNE_BOUNDS): boolean {
  return (
    coord.lat >= bounds.minLat &&
    coord.lat <= bounds.maxLat &&
    coord.lng >= bounds.minLng &&
    coord.lng <= bounds.maxLng
  );
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Computes great-circle distance between two coordinates using the Haversine formula.
 */
export function haversineMeters(p1: LatLng, p2: LatLng): number {
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes shortest distance in meters from a point to a finite line segment (A -> B).
 */
function pointToSegmentDistanceMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const dAB = haversineMeters(a, b);
  if (dAB === 0) {
    return haversineMeters(p, a);
  }

  // Convert to local planar coordinates centered at point A
  const midLat = toRadians((a.lat + b.lat) / 2);
  const metersPerDegLat = 111132.95;
  const metersPerDegLng = 111132.95 * Math.cos(midLat);

  const ax = 0;
  const ay = 0;
  const bx = (b.lng - a.lng) * metersPerDegLng;
  const by = (b.lat - a.lat) * metersPerDegLat;
  const px = (p.lng - a.lng) * metersPerDegLng;
  const py = (p.lat - a.lat) * metersPerDegLat;

  // Project point P onto vector AB: t = ((P - A) . (B - A)) / |B - A|^2
  const segmentLenSq = bx * bx + by * by;
  let t = 0;
  if (segmentLenSq > 0) {
    t = (px * bx + py * by) / segmentLenSq;
  }

  // If projection falls outside segment, closest point is an endpoint
  if (t <= 0) {
    return haversineMeters(p, a);
  }
  if (t >= 1) {
    return haversineMeters(p, b);
  }

  const projX = ax + t * bx;
  const projY = ay + t * by;

  const projLat = a.lat + projY / metersPerDegLat;
  const projLng = a.lng + projX / metersPerDegLng;

  return haversineMeters(p, { lat: projLat, lng: projLng });
}

/**
 * Calculates minimum distance in meters between a coordinate point and a polyline.
 * Handles edge cases (empty polyline returns Infinity, single-point polyline uses haversine).
 */
export function pointToPolylineDistanceMeters(point: LatLng, polyline: LatLng[]): number {
  if (!polyline || polyline.length === 0) {
    return Infinity;
  }

  if (polyline.length === 1) {
    return haversineMeters(point, polyline[0]);
  }

  let minDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = pointToSegmentDistanceMeters(point, polyline[i], polyline[i + 1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * Verifies whether coordinates fall within Pune municipal/metropolitan boundaries.
 */
export function boundsCheck(point: LatLng, bounds: GeoBounds = PUNE_BOUNDS): boolean {
  return (
    point.lat >= bounds.minLat &&
    point.lat <= bounds.maxLat &&
    point.lng >= bounds.minLng &&
    point.lng <= bounds.maxLng
  );
}

/**
 * Decodes a Google Encoded Polyline string into an array of { lat, lng } coordinates.
 * Pure utility function adhering to Google's Encoded Polyline Algorithm Format.
 */
export function decodePolyline(encoded: string): LatLng[] {
  if (!encoded || typeof encoded !== "string") {
    return [];
  }

  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: Number((lat / 1e5).toFixed(5)),
      lng: Number((lng / 1e5).toFixed(5)),
    });
  }

  return points;
}
