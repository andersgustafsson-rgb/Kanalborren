import { useEffect, useMemo, useState } from "react";
import { Marker, Tooltip } from "react-leaflet";
import type { FeatureCollection, Point, Polygon } from "geojson";
import L from "leaflet";
import {
  fetchRecentCatches,
  type RecentCatch,
} from "../lib/recentCatches";
import type { CanalProperties } from "./types";
import { polygonCentroid } from "./geo";
import { escapeHtml } from "./spotsStorage";

type PlacePos = { lat: number; lng: number; name: string };

function catchIcon(species: string) {
  const label = escapeHtml(species.slice(0, 12));
  return L.divIcon({
    className: "catch-marker",
    html: `<div class="catch-pin"><span class="catch-fish" aria-hidden="true">🐟</span><span class="catch-species">${label}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function buildPlaceIndex(
  spots: FeatureCollection | null,
  zones: FeatureCollection | null,
): Map<string, PlacePos> {
  const map = new Map<string, PlacePos>();

  for (const f of spots?.features || []) {
    if (f.geometry?.type !== "Point") continue;
    const p = (f.properties || {}) as CanalProperties;
    const [lng, lat] = (f.geometry as Point).coordinates;
    const id = p.id || p.name;
    const name = p.name || "Plats";
    if (!id) continue;
    map.set(String(id).toLowerCase(), { lat, lng, name });
    map.set(name.toLowerCase(), { lat, lng, name });
  }

  for (const f of zones?.features || []) {
    if (f.geometry?.type !== "Polygon") continue;
    const p = (f.properties || {}) as CanalProperties;
    const c = polygonCentroid((f.geometry as Polygon).coordinates[0]);
    const id = p.id || p.name;
    const name = p.name || "Zon";
    if (!id) continue;
    const key = String(id).toLowerCase();
    if (!map.has(key)) map.set(key, { lat: c.lat, lng: c.lng, name });
    if (!map.has(name.toLowerCase())) {
      map.set(name.toLowerCase(), { lat: c.lat, lng: c.lng, name });
    }
  }

  return map;
}

function resolvePlace(
  catchRow: RecentCatch,
  index: Map<string, PlacePos>,
): PlacePos | null {
  if (catchRow.zoneId) {
    const byId = index.get(catchRow.zoneId.toLowerCase());
    if (byId) return byId;
  }
  if (catchRow.zoneName) {
    const byName = index.get(catchRow.zoneName.toLowerCase());
    if (byName) return byName;
  }
  return null;
}

/** Slight offset when several catches share the same place. */
function jitter(lat: number, lng: number, i: number): [number, number] {
  if (i === 0) return [lat, lng];
  const a = (i * 2.4) % (Math.PI * 2);
  const r = 0.00018 * (1 + (i % 3) * 0.35);
  return [lat + Math.cos(a) * r, lng + Math.sin(a) * r];
}

type Props = {
  enabled: boolean;
  spots: FeatureCollection | null;
  zones: FeatureCollection | null;
};

export function CatchMarkers({ enabled, spots, zones }: Props) {
  const [rows, setRows] = useState<RecentCatch[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchRecentCatches(7).then((data) => {
      if (!cancelled) setRows(data);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const index = useMemo(
    () => buildPlaceIndex(spots, zones),
    [spots, zones],
  );

  const placed = useMemo(() => {
    const counts = new Map<string, number>();
    const out: {
      catch: RecentCatch;
      lat: number;
      lng: number;
      placeName: string;
    }[] = [];

    for (const c of rows) {
      const place = resolvePlace(c, index);
      if (!place) continue;
      const key = `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
      const n = counts.get(key) || 0;
      counts.set(key, n + 1);
      const [lat, lng] = jitter(place.lat, place.lng, n);
      out.push({ catch: c, lat, lng, placeName: place.name });
    }
    return out;
  }, [rows, index]);

  if (!enabled) return null;

  return (
    <>
      {placed.map(({ catch: c, lat, lng, placeName }) => (
        <Marker
          key={c.id}
          position={[lat, lng]}
          icon={catchIcon(c.species)}
        >
          <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
            <strong>
              {c.species}
              {c.lengthCm != null ? ` · ${c.lengthCm} cm` : ""}
              {c.weightKg != null ? ` · ${c.weightKg} kg` : ""}
            </strong>
            <br />
            {c.displayName} · {placeName}
            <br />
            {new Date(c.caughtAt).toLocaleString("sv-SE", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
