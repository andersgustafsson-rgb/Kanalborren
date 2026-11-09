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
  /** Hidden from map, highscores and other users. */
  isPrivate?: boolean;
};

export async function submitCatchReport(
  userId: string,
  input: CatchInput,
): Promise<{ error: string | null; id?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Supabase saknas" };
  }
  const { data, error } = await supabase
    .from("catch_reports")
    .insert({
      user_id: userId,
      species: input.species.trim(),
      length_cm: input.lengthCm,
      weight_kg: input.weightKg,
      zone_id: input.zoneId,
      zone_name: input.zoneName,
      bait: input.bait.trim() || null,
      note: input.note.trim() || null,
      caught_at: input.caughtAt,
      is_private: Boolean(input.isPrivate),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { error: null, id: data?.id ? String(data.id) : undefined };
}

export async function deleteCatchReport(
  catchId: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Supabase saknas" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Logga in först" };
  const { error } = await supabase
    .from("catch_reports")
    .delete()
    .eq("id", catchId)
    .eq("user_id", user.id);
  return { error: error?.message ?? null };
}

export async function updateCatchMeasures(
  catchId: string,
  input: { lengthCm: number | null; weightKg: number | null },
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Supabase saknas" };
  }
  if (input.lengthCm == null && input.weightKg == null) {
    return { error: "Ange längd eller vikt" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Logga in först" };
  const { error } = await supabase
    .from("catch_reports")
    .update({
      length_cm: input.lengthCm,
      weight_kg: input.weightKg,
    })
    .eq("id", catchId)
    .eq("user_id", user.id);
  return { error: error?.message ?? null };
}
