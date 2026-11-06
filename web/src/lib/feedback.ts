import { isSupabaseConfigured, supabase } from "./supabase";

export type FeedbackKind = "tip" | "bug" | "idea";
export type FeedbackStatus = "new" | "done" | "ignored";

export type FeedbackRow = {
  id: string;
  userId: string | null;
  displayName: string;
  kind: FeedbackKind;
  message: string;
  page: string | null;
  status: FeedbackStatus;
  createdAt: string;
};

export async function submitFeedback(input: {
  kind: FeedbackKind;
  message: string;
  page?: string;
}): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Molnet är inte inkopplat" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Logga in för att skicka tips" };

  const message = input.message.trim();
  if (message.length < 5) return { error: "Skriv lite mer (minst 5 tecken)" };
  if (message.length > 2000) return { error: "Max 2000 tecken" };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    kind: input.kind,
    message,
    page: input.page?.trim() || null,
  });
  return { error: error?.message ?? null };
}

export async function fetchAdminFeedback(): Promise<FeedbackRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("feedback")
    .select("id,user_id,kind,message,page,status,created_at,profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) {
    console.warn("fetchAdminFeedback", error);
    return [];
  }
  return data.map((r) => {
    const profile = r.profiles as { display_name?: string } | null;
    return {
      id: String(r.id),
      userId: r.user_id ? String(r.user_id) : null,
      displayName: profile?.display_name || "Fiskare",
      kind: r.kind as FeedbackKind,
      message: String(r.message),
      page: r.page ? String(r.page) : null,
      status: r.status as FeedbackStatus,
      createdAt: String(r.created_at),
    };
  });
}

export async function setFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<string | null> {
  if (!supabase) return "Ej konfigurerat";
  const { error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", id);
  return error?.message ?? null;
}

export async function deleteFeedback(id: string): Promise<string | null> {
  if (!supabase) return "Ej konfigurerat";
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  return error?.message ?? null;
}
