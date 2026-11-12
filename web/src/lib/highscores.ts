import { isSupabaseConfigured, supabase } from "./supabase";

export type HighscorePeriod = "week" | "month" | "year" | "all";

export type HighscoreRow = {
  id: string;
  displayName: string;
  species: string;
  lengthCm: number | null;
  weightKg: number | null;
  zoneName: string | null;
  caughtAt: string;
};

function periodStart(period: HighscorePeriod): string | null {
  if (period === "all") return null;
  const d = new Date();
  if (period === "week") d.setDate(d.getDate() - 7);
  else if (period === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  // Inclusive: start of that calendar day (local), so “7 days ago morning” still counts
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function sortKey(r: HighscoreRow): number {
  if (r.lengthCm != null) return r.lengthCm;
  if (r.weightKg != null) return r.weightKg * 100; // rough so kg ranks visibly
  return 0;
}

/** All measured public catches in the period, best first. */
export async function fetchHighscores(
  period: HighscorePeriod,
): Promise<HighscoreRow[]> {
  if (!isSupabaseConfigured() || !supabase) return [];

  let q = supabase
    .from("catch_reports")
    .select(
      "id,species,length_cm,weight_kg,zone_name,caught_at,profiles(display_name)",
    )
    .eq("is_private", false);
  const since = periodStart(period);
  if (since) q = q.gte("caught_at", since);

  const { data, error } = await q.limit(300);

  if (error || !data) {
    console.warn("fetchHighscores", error);
    return [];
  }

  return data
    .map((r) => {
      const profile = r.profiles as { display_name?: string } | null;
      return {
        id: String(r.id),
        displayName: profile?.display_name || "Fiskare",
        species: String(r.species),
        lengthCm: asNum(r.length_cm),
        weightKg: asNum(r.weight_kg),
        zoneName: (r.zone_name as string) || null,
        caughtAt: String(r.caught_at),
      };
    })
    .filter((r) => r.lengthCm != null || r.weightKg != null)
    .sort((a, b) => sortKey(b) - sortKey(a));
}
