import { isSupabaseConfigured, supabase } from "./supabase";

export type RecentCatch = {
  id: string;
  displayName: string;
  species: string;
  lengthCm: number | null;
  weightKg: number | null;
  zoneId: string | null;
  zoneName: string | null;
  caughtAt: string;
};

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function fetchRecentCatches(
  days = 7,
): Promise<RecentCatch[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("catch_reports")
    .select(
      "id,species,length_cm,weight_kg,zone_id,zone_name,caught_at,profiles(display_name)",
    )
    .eq("is_private", false)
    .gte("caught_at", since.toISOString())
    .order("caught_at", { ascending: false })
    .limit(80);

  if (error || !data) {
    console.warn("fetchRecentCatches", error);
    return [];
  }

  return data.map((r) => {
    const profile = r.profiles as { display_name?: string } | null;
    return {
      id: String(r.id),
      displayName: profile?.display_name || "Fiskare",
      species: String(r.species),
      lengthCm: asNum(r.length_cm),
      weightKg: asNum(r.weight_kg),
      zoneId: r.zone_id ? String(r.zone_id) : null,
      zoneName: r.zone_name ? String(r.zone_name) : null,
      caughtAt: String(r.caught_at),
    };
  });
}
