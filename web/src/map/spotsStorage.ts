import type { Feature, FeatureCollection, Point } from "geojson";
import type { CanalProperties } from "./types";

export const SPOTS_STORAGE_KEY = "kanalhugget.spots.v1";

export type SpotFeature = Feature<Point, CanalProperties>;

export function isSpotCollection(data: unknown): data is FeatureCollection {
  if (!data || typeof data !== "object") return false;
  const fc = data as FeatureCollection;
  return fc.type === "FeatureCollection" && Array.isArray(fc.features);
}

export function loadStoredSpots(): FeatureCollection | null {
  try {
    const raw = localStorage.getItem(SPOTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isSpotCollection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSpots(fc: FeatureCollection): void {
  const withMeta = fc as FeatureCollection & {
    metadata?: Record<string, unknown>;
  };
  const toStore = {
    type: "FeatureCollection" as const,
    metadata: {
      ...(withMeta.metadata || {}),
      purpose: "Lokala smeknamn / landmärken längs Malmö kanal",
      saved_at: new Date().toISOString(),
      disclaimer:
        "Ungefärliga positioner. Community-namn – ingen garanti för fisk.",
    },
    features: fc.features,
  };
  localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(toStore));
}

export function clearStoredSpots(): void {
  localStorage.removeItem(SPOTS_STORAGE_KEY);
}

export function downloadSpotsGeoJson(fc: FeatureCollection): void {
  const withMeta = {
    type: "FeatureCollection" as const,
    metadata: {
      purpose: "Lokala smeknamn / landmärken längs Malmö kanal",
      exported_at: new Date().toISOString(),
      disclaimer:
        "Ungefärliga positioner. Community-namn – ingen garanti för fisk.",
    },
    features: fc.features,
  };
  const blob = new Blob([JSON.stringify(withMeta, null, 2)], {
    type: "application/geo+json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lokala-platser.geojson";
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export function createSpot(
  name: string,
  lat: number,
  lng: number,
): SpotFeature {
  const trimmed = name.trim() || "Ny plats";
  const id = `${slugify(trimmed) || "plats"}_${Date.now().toString(36)}`;
  return {
    type: "Feature",
    properties: {
      id,
      name: trimmed,
      kind: "local_spot",
      note: "Tillagd i kartredigeraren",
      confidence: "approx",
      sources: ["Användare"],
    },
    geometry: {
      type: "Point",
      coordinates: [lng, lat],
    },
  };
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
