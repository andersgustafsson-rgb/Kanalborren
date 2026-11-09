import type { Feature, FeatureCollection, Point } from "geojson";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { CanalProperties } from "../map/types";

export type CanalSpotRow = {
  id: string;
  name: string;
  note: string | null;
  confidence: string | null;
  sources: unknown;
  lng: number;
  lat: number;
  sort_order: number;
  updated_at?: string;
  updated_by?: string | null;
};

function asSources(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  return [];
}

export function spotRowToFeature(row: CanalSpotRow): Feature<Point, CanalProperties> {
  return {
    type: "Feature",
    properties: {
      id: row.id,
      name: row.name,
      kind: "local_spot",
      note: row.note || undefined,
      confidence: row.confidence || undefined,
      sources: asSources(row.sources),
    },
    geometry: {
      type: "Point",
      coordinates: [row.lng, row.lat],
    },
  };
}

export function spotsToFeatureCollection(
  rows: CanalSpotRow[],
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map(spotRowToFeature),
  };
}

export function featureToSpotRow(
  feature: Feature,
  sortOrder = 0,
): CanalSpotRow | null {
  if (feature.geometry?.type !== "Point") return null;
  const props = (feature.properties || {}) as CanalProperties;
  const id = props.id || props.name;
  if (!id) return null;
  const [lng, lat] = feature.geometry.coordinates;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  return {
    id: String(id),
    name: String(props.name || id),
    note: props.note ?? null,
    confidence: props.confidence ?? null,
    sources: props.sources || [],
    lng,
    lat,
    sort_order: sortOrder,
  };
}

export async function fetchSpots(): Promise<FeatureCollection | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data, error } = await supabase
    .from("canal_spots")
    .select("id,name,note,confidence,sources,lng,lat,sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.warn("fetchSpots", error);
    return null;
  }
  if (!data || data.length === 0) return null;
  return spotsToFeatureCollection(data as CanalSpotRow[]);
}

export async function upsertSpot(
  feature: Feature,
  sortOrder = 0,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "Supabase saknas" };
  }
  const row = featureToSpotRow(feature, sortOrder);
  if (!row) return { ok: false, error: "Ogiltig plats" };
  const { error } = await supabase.from("canal_spots").upsert(
    {
      id: row.id,
      name: row.name,
      note: row.note,
      confidence: row.confidence,
      sources: row.sources,
      lng: row.lng,
      lat: row.lat,
      sort_order: row.sort_order,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.warn("upsertSpot", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteSpot(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "Supabase saknas" };
  }
  const { error } = await supabase.from("canal_spots").delete().eq("id", id);
  if (error) {
    console.warn("deleteSpot", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Replace the full collection: upsert all, then delete removed ids. */
export async function replaceAllSpots(
  fc: FeatureCollection,
): Promise<{ ok: boolean; error?: string; count?: number }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: "Supabase saknas" };
  }
  const rows: CanalSpotRow[] = [];
  fc.features.forEach((f, i) => {
    const row = featureToSpotRow(f, i);
    if (row) rows.push(row);
  });
  if (rows.length === 0) {
    return { ok: false, error: "Inga platser att publicera" };
  }

  const { error: upsertError } = await supabase.from("canal_spots").upsert(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      note: r.note,
      confidence: r.confidence,
      sources: r.sources,
      lng: r.lng,
      lat: r.lat,
      sort_order: r.sort_order,
    })),
    { onConflict: "id" },
  );
  if (upsertError) {
    console.warn("replaceAllSpots upsert", upsertError);
    return { ok: false, error: upsertError.message };
  }

  const keepIds = rows.map((r) => r.id);
  const { data: existing, error: listError } = await supabase
    .from("canal_spots")
    .select("id");
  if (listError) {
    console.warn("replaceAllSpots list", listError);
    return { ok: false, error: listError.message };
  }
  const remove = (existing || [])
    .map((r) => String(r.id))
    .filter((id) => !keepIds.includes(id));
  if (remove.length > 0) {
    const { error: delError } = await supabase
      .from("canal_spots")
      .delete()
      .in("id", remove);
    if (delError) {
      console.warn("replaceAllSpots delete", delError);
      return { ok: false, error: delError.message };
    }
  }
  return { ok: true, count: rows.length };
}

/** Seed DB from a FeatureCollection when empty (admin only succeeds). */
export async function seedSpotsIfEmpty(
  fc: FeatureCollection,
): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;
  const { count, error } = await supabase
    .from("canal_spots")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.warn("seedSpotsIfEmpty count", error);
    return false;
  }
  if ((count ?? 0) > 0) return false;
  const result = await replaceAllSpots(fc);
  return result.ok;
}

export function subscribeSpots(
  onChange: (fc: FeatureCollection) => void,
): () => void {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const channel = supabase
    .channel("canal_spots_public")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "canal_spots" },
      () => {
        void fetchSpots().then((fc) => {
          if (fc) onChange(fc);
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
