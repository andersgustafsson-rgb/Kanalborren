import { isSupabaseConfigured, supabase } from "./supabase";

export type AdminUser = {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  bannedAt: string | null;
  createdAt: string;
  activeNow: boolean;
};

export type AdminStats = {
  users: number;
  activeSessions: number;
  catches: number;
  pendingRequests: number;
  openChats: number;
};

export type AdminSession = {
  id: string;
  userId: string;
  displayName: string;
  zoneName: string | null;
  visibility: string;
  openForCompany: boolean;
  expiresAt: string;
  endedAt: string | null;
};

export type AdminCatch = {
  id: string;
  displayName: string;
  species: string;
  lengthCm: number | null;
  weightKg: number | null;
  zoneName: string | null;
  caughtAt: string;
};

export type AdminRequest = {
  id: string;
  fromName: string;
  toName: string;
  message: string;
  status: string;
  createdAt: string;
};

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("fetchIsAdmin", error);
    return false;
  }
  return Boolean(data?.is_admin);
}

export async function fetchAdminStats(): Promise<AdminStats> {
  if (!supabase) {
    return {
      users: 0,
      activeSessions: 0,
      catches: 0,
      pendingRequests: 0,
      openChats: 0,
    };
  }
  const now = new Date().toISOString();
  const [users, sessions, catches, pending, chats] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("fishing_sessions")
      .select("id", { count: "exact", head: true })
      .is("ended_at", null)
      .gt("expires_at", now),
    supabase.from("catch_reports").select("id", { count: "exact", head: true }),
    supabase
      .from("company_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("company_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted"),
  ]);
  return {
    users: users.count ?? 0,
    activeSessions: sessions.count ?? 0,
    catches: catches.count ?? 0,
    pendingRequests: pending.count ?? 0,
    openChats: chats.count ?? 0,
  };
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error || !data) {
    console.warn("fetchAdminUsers", error);
    return [];
  }
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    displayName: String(r.display_name || "Fiskare"),
    email: String(r.email || ""),
    isAdmin: Boolean(r.is_admin),
    bannedAt: r.banned_at ? String(r.banned_at) : null,
    createdAt: String(r.created_at),
    activeNow: Boolean(r.active_now),
  }));
}

export async function setUserBanned(
  userId: string,
  ban: boolean,
): Promise<string | null> {
  if (!supabase) return "Ej konfigurerat";
  const { error } = await supabase.rpc("admin_set_banned", {
    target: userId,
    ban,
  });
  return error?.message ?? null;
}

export async function deleteAdminUser(userId: string): Promise<string | null> {
  if (!supabase) return "Ej konfigurerat";
  const { error } = await supabase.rpc("admin_delete_user", {
    target: userId,
  });
  return error?.message ?? null;
}

export async function fetchAdminSessions(): Promise<AdminSession[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("fishing_sessions")
    .select(
      "id,user_id,zone_name,visibility,open_for_company,expires_at,ended_at,profiles(display_name)",
    )
    .order("expires_at", { ascending: false })
    .limit(40);
  if (error || !data) {
    console.warn("fetchAdminSessions", error);
    return [];
  }
  return data.map((r) => {
    const profile = r.profiles as { display_name?: string } | null;
    return {
      id: String(r.id),
      userId: String(r.user_id),
      displayName: profile?.display_name || "Fiskare",
      zoneName: r.zone_name ? String(r.zone_name) : null,
      visibility: String(r.visibility),
      openForCompany: Boolean(r.open_for_company),
      expiresAt: String(r.expires_at),
      endedAt: r.ended_at ? String(r.ended_at) : null,
    };
  });
}

export async function endAdminSession(sessionId: string): Promise<string | null> {
  if (!supabase) return "Ej konfigurerat";
  const { error } = await supabase
    .from("fishing_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  return error?.message ?? null;
}

export async function fetchAdminCatches(): Promise<AdminCatch[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("catch_reports")
    .select(
      "id,species,length_cm,weight_kg,zone_name,caught_at,profiles(display_name)",
    )
    .order("caught_at", { ascending: false })
    .limit(30);
  if (error || !data) {
    console.warn("fetchAdminCatches", error);
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
      zoneName: r.zone_name ? String(r.zone_name) : null,
      caughtAt: String(r.caught_at),
    };
  });
}

export async function deleteAdminCatch(id: string): Promise<string | null> {
  if (!supabase) return "Ej konfigurerat";
  const { error } = await supabase.from("catch_reports").delete().eq("id", id);
  return error?.message ?? null;
}

export async function fetchAdminRequests(): Promise<AdminRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("company_requests")
    .select("id,from_user_id,to_user_id,message,status,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) {
    console.warn("fetchAdminRequests", error);
    return [];
  }
  const ids = [
    ...new Set(data.flatMap((r) => [r.from_user_id, r.to_user_id])),
  ] as string[];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", ids);
  const names = new Map(
    (profiles || []).map((p) => [p.id as string, p.display_name as string]),
  );
  return data.map((r) => ({
    id: String(r.id),
    fromName: names.get(r.from_user_id as string) || "Fiskare",
    toName: names.get(r.to_user_id as string) || "Fiskare",
    message: String(r.message || ""),
    status: String(r.status),
    createdAt: String(r.created_at),
  }));
}
