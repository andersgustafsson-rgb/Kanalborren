import { isSupabaseConfigured, supabase } from "./supabase";

export type MyCatch = {
  id: string;
  species: string;
  lengthCm: number | null;
  weightKg: number | null;
  zoneId: string | null;
  zoneName: string | null;
  bait: string | null;
  note: string | null;
  isPrivate: boolean;
  caughtAt: string;
};

export type MyHotspot = {
  zoneId: string | null;
  zoneName: string;
  count: number;
  bestLengthCm: number | null;
  lastCaughtAt: string;
};

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function fetchMyCatches(limit = 200): Promise<MyCatch[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from("catch_reports")
    .select(
      "id,species,length_cm,weight_kg,zone_id,zone_name,bait,note,is_private,caught_at",
    )
    .order("caught_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("fetchMyCatches", error);
    return [];
  }

  return data.map((r) => ({
    id: String(r.id),
    species: String(r.species),
    lengthCm: asNum(r.length_cm),
    weightKg: asNum(r.weight_kg),
    zoneId: r.zone_id ? String(r.zone_id) : null,
    zoneName: r.zone_name ? String(r.zone_name) : null,
    bait: r.bait ? String(r.bait) : null,
    note: r.note ? String(r.note) : null,
    isPrivate: Boolean(r.is_private),
    caughtAt: String(r.caught_at),
  }));
}

export function buildHotspots(rows: MyCatch[]): MyHotspot[] {
  const map = new Map<string, MyHotspot>();
  for (const r of rows) {
    const name = (r.zoneName || "Okänd plats").trim() || "Okänd plats";
    const key = (r.zoneId || name).toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        zoneId: r.zoneId,
        zoneName: name,
        count: 1,
        bestLengthCm: r.lengthCm,
        lastCaughtAt: r.caughtAt,
      });
      continue;
    }
    prev.count += 1;
    if (
      r.lengthCm != null &&
      (prev.bestLengthCm == null || r.lengthCm > prev.bestLengthCm)
    ) {
      prev.bestLengthCm = r.lengthCm;
    }
    if (Date.parse(r.caughtAt) > Date.parse(prev.lastCaughtAt)) {
      prev.lastCaughtAt = r.caughtAt;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.zoneName.localeCompare(b.zoneName, "sv"));
}

export type MyTripDay = {
  dateKey: string;
  label: string;
  catches: MyCatch[];
};

export function groupCatchesByDay(rows: MyCatch[]): MyTripDay[] {
  const map = new Map<string, MyCatch[]>();
  for (const r of rows) {
    const d = new Date(r.caughtAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const list = map.get(key) || [];
    list.push(r);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, catches]) => {
      const d = new Date(`${dateKey}T12:00:00`);
      return {
        dateKey,
        label: d.toLocaleDateString("sv-SE", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        catches: catches.sort(
          (a, b) => Date.parse(b.caughtAt) - Date.parse(a.caughtAt),
        ),
      };
    });
}

export type MyTripNote = {
  id: string;
  zoneName: string | null;
  note: string;
  startedAt: string;
  endedAt: string;
};

export async function fetchMyTripNotes(limit = 30): Promise<MyTripNote[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from("fishing_sessions")
    .select("id,zone_name,trip_note,starts_at,ended_at")
    .not("trip_note", "is", null)
    .neq("trip_note", "")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("fetchMyTripNotes", error);
    return [];
  }

  return data
    .filter((r) => String(r.trip_note || "").trim())
    .map((r) => ({
      id: String(r.id),
      zoneName: r.zone_name ? String(r.zone_name) : null,
      note: String(r.trip_note).trim(),
      startedAt: String(r.starts_at),
      endedAt: String(r.ended_at),
    }));
}

export function bestCatchMonth(rows: MyCatch[]): {
  label: string;
  count: number;
} | null {
  if (!rows.length) return null;
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.caughtAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  let bestKey = "";
  let bestCount = 0;
  for (const [k, n] of buckets) {
    if (n > bestCount) {
      bestKey = k;
      bestCount = n;
    }
  }
  if (!bestKey) return null;
  const [y, m] = bestKey.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("sv-SE", {
    month: "long",
    year: "numeric",
  });
  return { label, count: bestCount };
}
