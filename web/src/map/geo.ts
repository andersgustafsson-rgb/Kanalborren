import type { FeatureCollection, Point, Polygon, Position } from "geojson";
import type { CanalProperties } from "./types";

/** Ray-casting point-in-polygon (lon/lat). */
export function pointInPolygon(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Approximate meters between two WGS84 points (Malmö scale). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function polygonCentroid(ring: Position[]): { lat: number; lng: number } {
  let x = 0;
  let y = 0;
  const n = ring.length - (ring[0][0] === ring[ring.length - 1][0] &&
  ring[0][1] === ring[ring.length - 1][1]
    ? 1
    : 0);
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return { lng: x / n, lat: y / n };
}

/** Round to ~60–70 m grid for privacy. */
export function roundForPrivacy(lat: number, lng: number): {
  lat: number;
  lng: number;
} {
  const latStep = 0.0006; // ~67 m
  const lngStep = 0.001; // ~60–65 m at Malmö lat
  return {
    lat: Math.round(lat / latStep) * latStep,
    lng: Math.round(lng / lngStep) * lngStep,
  };
}

export type ResolvedZone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  source: "spot" | "polygon" | "fallback";
  distanceM?: number;
};

export function resolveZone(
  lat: number,
  lng: number,
  spots: FeatureCollection,
  zones: FeatureCollection,
): ResolvedZone {
  let bestSpot: ResolvedZone | null = null;
  for (const f of spots.features) {
    if (f.geometry?.type !== "Point") continue;
    const p = (f.properties || {}) as CanalProperties;
    if (p.kind && p.kind !== "local_spot") continue;
    const [slng, slat] = (f.geometry as Point).coordinates;
    const d = distanceMeters(lat, lng, slat, slng);
    if (d <= 220 && (!bestSpot || (bestSpot.distanceM ?? Infinity) > d)) {
      bestSpot = {
        id: p.id || p.name || "spot",
        name: p.name || "Plats",
        lat: slat,
        lng: slng,
        source: "spot",
        distanceM: Math.round(d),
      };
    }
  }
  if (bestSpot) return bestSpot;

  for (const f of zones.features) {
    if (f.geometry?.type !== "Polygon") continue;
    const poly = f.geometry as Polygon;
    const ring = poly.coordinates[0];
    if (!pointInPolygon(lng, lat, ring)) continue;
    const p = (f.properties || {}) as CanalProperties;
    const c = polygonCentroid(ring);
    return {
      id: p.id || p.name || "zone",
      name: p.name || "Zon",
      lat: c.lat,
      lng: c.lng,
      source: "polygon",
    };
  }

  // Nearest zone polygon centroid as soft fallback
  let nearest: ResolvedZone | null = null;
  for (const f of zones.features) {
    if (f.geometry?.type !== "Polygon") continue;
    const p = (f.properties || {}) as CanalProperties;
    const c = polygonCentroid((f.geometry as Polygon).coordinates[0]);
    const d = distanceMeters(lat, lng, c.lat, c.lng);
    if (!nearest || (nearest.distanceM ?? Infinity) > d) {
      nearest = {
        id: p.id || p.name || "zone",
        name: p.name || "Zon",
        lat: c.lat,
        lng: c.lng,
        source: "polygon",
        distanceM: Math.round(d),
      };
    }
  }
  if (nearest && (nearest.distanceM ?? 9999) < 800) return nearest;

  return {
    id: "malmo_kanal",
    name: "Malmö kanal",
    lat,
    lng,
    source: "fallback",
  };
}
