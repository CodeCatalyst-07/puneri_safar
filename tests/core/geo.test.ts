import { describe, it, expect } from "vitest";
import {
  haversineMeters,
  pointToPolylineDistanceMeters,
  boundsCheck,
  decodePolyline,
  PUNE_BOUNDS,
} from "@/core/geo";

describe("Core Geo: haversineMeters", () => {
  it("calculates zero distance for identical coordinates", () => {
    const p = { lat: 18.5204, lng: 73.8567 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it("calculates accurate great-circle distance between two Pune landmarks", () => {
    // Shaniwar Wada to Katraj Chowk is approximately 7.1 km
    const shaniwarWada = { lat: 18.5196, lng: 73.8553 };
    const katrajChowk = { lat: 18.4552, lng: 73.8568 };

    const distance = haversineMeters(shaniwarWada, katrajChowk);
    expect(distance).toBeGreaterThan(7000);
    expect(distance).toBeLessThan(7500);
  });
});

describe("Core Geo: pointToPolylineDistanceMeters", () => {
  it("returns Infinity for empty polyline", () => {
    expect(pointToPolylineDistanceMeters({ lat: 18.52, lng: 73.85 }, [])).toBe(Infinity);
  });

  it("uses haversine distance for a single-point polyline", () => {
    const point = { lat: 18.52, lng: 73.85 };
    const polyline = [{ lat: 18.52, lng: 73.86 }];
    const expected = haversineMeters(point, polyline[0]);

    expect(pointToPolylineDistanceMeters(point, polyline)).toBeCloseTo(expected, 1);
  });

  it("calculates perpendicular distance to a line segment correctly", () => {
    // Segment from (18.50, 73.80) to (18.50, 73.90) along latitude 18.50
    const polyline = [
      { lat: 18.5, lng: 73.8 },
      { lat: 18.5, lng: 73.9 },
    ];
    // Point at (18.51, 73.85) - about 1.11 km north of the segment center
    const queryPoint = { lat: 18.51, lng: 73.85 };

    const dist = pointToPolylineDistanceMeters(queryPoint, polyline);
    expect(dist).toBeGreaterThan(1000);
    expect(dist).toBeLessThan(1200);
  });

  it("handles points that project beyond segment endpoints", () => {
    const polyline = [
      { lat: 18.5, lng: 73.8 },
      { lat: 18.5, lng: 73.9 },
    ];
    // Point past the end of the segment at (18.5, 73.95)
    const queryPoint = { lat: 18.5, lng: 73.95 };
    const expected = haversineMeters(queryPoint, polyline[1]);

    expect(pointToPolylineDistanceMeters(queryPoint, polyline)).toBeCloseTo(expected, 1);
  });

  it("finds the minimum distance across multi-segment polylines", () => {
    const polyline = [
      { lat: 18.5, lng: 73.8 },
      { lat: 18.5, lng: 73.85 },
      { lat: 18.55, lng: 73.85 },
      { lat: 18.55, lng: 73.9 },
    ];
    // Point right on the second vertex
    const queryPoint = { lat: 18.5, lng: 73.85 };
    expect(pointToPolylineDistanceMeters(queryPoint, polyline)).toBe(0);
  });

  it("handles segments with identical consecutive vertices (dAB === 0)", () => {
    const identicalPointsPolyline = [
      { lat: 18.52, lng: 73.85 },
      { lat: 18.52, lng: 73.85 },
    ];
    const query = { lat: 18.53, lng: 73.85 };
    const dist = pointToPolylineDistanceMeters(query, identicalPointsPolyline);
    expect(dist).toBeGreaterThan(1000);
  });
});

describe("Core Geo: boundsCheck", () => {
  it("accepts points within Pune municipal boundaries", () => {
    expect(boundsCheck({ lat: 18.5204, lng: 73.8567 }, PUNE_BOUNDS)).toBe(true);
    expect(boundsCheck({ lat: 18.3, lng: 73.7 }, PUNE_BOUNDS)).toBe(true);
  });

  it("rejects points outside Pune boundaries (Mumbai, Delhi, international)", () => {
    // Mumbai coordinates
    expect(boundsCheck({ lat: 19.076, lng: 72.8777 }, PUNE_BOUNDS)).toBe(false);
    // Delhi coordinates
    expect(boundsCheck({ lat: 28.6139, lng: 77.209 }, PUNE_BOUNDS)).toBe(false);
    // Far south of Pune bounds
    expect(boundsCheck({ lat: 17.5, lng: 73.85 }, PUNE_BOUNDS)).toBe(false);
  });
});

describe("Core Geo: decodePolyline", () => {
  it("returns empty array for empty or null string", () => {
    expect(decodePolyline("")).toEqual([]);
    expect(decodePolyline(undefined as unknown as string)).toEqual([]);
  });

  it("decodes a known standard Google polyline accurately", () => {
    // Standard Google example: _p~iF~ps|U_ulLnnqC_mqNvxq`@
    // Corresponding points: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toHaveLength(3);
    expect(points[0].lat).toBeCloseTo(38.5, 4);
    expect(points[0].lng).toBeCloseTo(-120.2, 4);
    expect(points[1].lat).toBeCloseTo(40.7, 4);
    expect(points[1].lng).toBeCloseTo(-120.95, 4);
    expect(points[2].lat).toBeCloseTo(43.252, 4);
    expect(points[2].lng).toBeCloseTo(-126.453, 4);
  });

  it("decodes a single-point polyline accurately", () => {
    // Lat: 38.5, Lng: -120.2 -> _p~iF~ps|U
    const points = decodePolyline("_p~iF~ps|U");
    expect(points).toHaveLength(1);
    expect(points[0].lat).toBeCloseTo(38.5, 4);
    expect(points[0].lng).toBeCloseTo(-120.2, 4);
  });
});
