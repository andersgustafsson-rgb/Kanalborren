import { isSupabaseConfigured, supabase } from "./supabase";

export type CatchInput = {
  species: string;
  lengthCm: number | null;
  weightKg: number | null;
  zoneId: string | null;
  zoneName: string | null;
  bait: string;
  note: string;
  /** ISO timestamp — when the fish was caught. */
  caughtAt: string;
};

export async function submitCatchReport(
  userId: string,
  input: CatchInput,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Supabase saknas" };
  }
  if (input.lengthCm == null && input.weightKg == null) {
    return { error: "Ange längd, vikt eller båda" };
  }
  const { error } = await supabase.from("catch_reports").insert({
    user_id: userId,
    species: input.species.trim(),
    length_cm: input.lengthCm,
    weight_kg: input.weightKg,
    zone_id: input.zoneId,
    zone_name: input.zoneName,
    bait: input.bait.trim() || null,
    note: input.note.trim() || null,
    caught_at: input.caughtAt,
  });
  return { error: error?.message ?? null };
}
