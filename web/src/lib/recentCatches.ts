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

export async function fetchRecentCatches(
  days = 7,
): Promise<RecentCatch[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("catch_reports")
    .select(
      "id,species,length_cm,weight_kg,zone_id,zone_name,caught_at,profiles(display_name)",
    )
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
      lengthCm: typeof r.length_cm === "number" ? r.length_cm : null,
      weightKg: typeof r.weight_kg === "number" ? r.weight_kg : null,
      zoneId: r.zone_id ? String(r.zone_id) : null,
      zoneName: r.zone_name ? String(r.zone_name) : null,
      caughtAt: String(r.caught_at),
    };
  });
}
