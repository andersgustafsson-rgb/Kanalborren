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

/** Hard snap to a named local spot (precise label). */
const SPOT_SNAP_M = 220;
/**
 * Soft snap: still prefer a named spot when GPS is near the canal but not
 * right on a landmark (common with phone GPS / sparse spots).
 */
const SPOT_NEAR_M = 480;
/** Soft snap to nearest social zone by edge distance. */
const ZONE_NEAR_M = 800;

/** Approximate meters from a point to the closest vertex/edge of a ring. */
export function distanceToRingMeters(
  lat: number,
  lng: number,
  ring: Position[],
): number {
  if (pointInPolygon(lng, lat, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    // Sample edge endpoints + midpoint (good enough at Malmö canal scale).
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    best = Math.min(
      best,
      distanceMeters(lat, lng, lat1, lng1),
      distanceMeters(lat, lng, lat2, lng2),
      distanceMeters(lat, lng, midLat, midLng),
    );
  }
  return best;
}

function nearestSpot(
  lat: number,
  lng: number,
  spots: FeatureCollection,
  maxM: number,
): ResolvedZone | null {
  let best: ResolvedZone | null = null;
  for (const f of spots.features) {
    if (f.geometry?.type !== "Point") continue;
    const p = (f.properties || {}) as CanalProperties;
    if (p.kind && p.kind !== "local_spot") continue;
    const [slng, slat] = (f.geometry as Point).coordinates;
    const d = distanceMeters(lat, lng, slat, slng);
    if (d <= maxM && (!best || (best.distanceM ?? Infinity) > d)) {
      best = {
        id: p.id || p.name || "spot",
        name: p.name || "Plats",
        lat: slat,
        lng: slng,
        source: "spot",
        distanceM: Math.round(d),
      };
    }
  }
  return best;
}

/**
 * Map a GPS/map point to a named canal place.
 * Order: tight spot → zone containing point → nearby spot → nearby zone → broad fallback.
 */
export function resolveZone(
  lat: number,
  lng: number,
  spots: FeatureCollection,
  zones: FeatureCollection,
): ResolvedZone {
  const tightSpot = nearestSpot(lat, lng, spots, SPOT_SNAP_M);
  if (tightSpot) return tightSpot;

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
      distanceM: 0,
    };
  }

  const nearSpot = nearestSpot(lat, lng, spots, SPOT_NEAR_M);
  if (nearSpot) return nearSpot;

  let nearestZone: ResolvedZone | null = null;
  for (const f of zones.features) {
    if (f.geometry?.type !== "Polygon") continue;
    const p = (f.properties || {}) as CanalProperties;
    const ring = (f.geometry as Polygon).coordinates[0];
    const c = polygonCentroid(ring);
    const d = Math.round(distanceToRingMeters(lat, lng, ring));
    if (!nearestZone || (nearestZone.distanceM ?? Infinity) > d) {
      nearestZone = {
        id: p.id || p.name || "zone",
        name: p.name || "Zon",
        lat: c.lat,
        lng: c.lng,
        source: "polygon",
        distanceM: d,
      };
    }
  }
  if (nearestZone && (nearestZone.distanceM ?? 9999) < ZONE_NEAR_M) {
    return nearestZone;
  }

  return {
    id: "malmo_kanal",
    name: "Malmö kanal",
    lat,
    lng,
    source: "fallback",
  };
}
