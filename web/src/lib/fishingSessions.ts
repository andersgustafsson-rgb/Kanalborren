import { isSupabaseConfigured, supabase } from "./supabase";
import {
  localEnd,
  localListPublic,
  localPublish,
  localDisplayName,
  localSetOpenForCompany,
  subscribeLocalPresence,
} from "./localPresence";
import type { PublishSessionInput, PublicFishingSession } from "./types";

function mapRow(row: Record<string, unknown>, displayName?: string): PublicFishingSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    displayName: displayName || "Fiskare",
    visibility: row.visibility as PublicFishingSession["visibility"],
    zoneId: (row.zone_id as string) || null,
    zoneName: (row.zone_name as string) || null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    openForCompany:
      row.open_for_company === true ||
      row.open_for_company === "true" ||
      row.open_for_company === 1,
    note: String(row.note || ""),
    avatarId: (row.avatar_id as string) || null,
    expiresAt: String(row.expires_at),
  };
}

export async function listPublicSessions(
  excludeUserId?: string | null,
): Promise<PublicFishingSession[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return localListPublic();
  }

  const { data, error } = await supabase
    .from("fishing_sessions")
    .select(
      "id,user_id,visibility,zone_id,zone_name,lat,lng,open_for_company,note,avatar_id,expires_at,profiles(display_name)",
    )
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .in("visibility", ["zone", "precise"]);

  if (error || !data) {
    console.warn("listPublicSessions", error);
    return localListPublic();
  }

  return data
    .filter((r) => r.user_id !== excludeUserId)
    .map((r) => {
      const profile = r.profiles as { display_name?: string } | null;
      return mapRow(r as unknown as Record<string, unknown>, profile?.display_name);
    });
}

export async function publishSession(
  input: PublishSessionInput,
  opts: {
    remoteId?: string | null;
    userId?: string | null;
    displayName?: string;
  } = {},
): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase || !opts.userId) {
    const row = localPublish(
      input,
      opts.displayName || localDisplayName(),
      opts.remoteId,
    );
    return row?.id ?? null;
  }

  // End previous active sessions for this user
  await supabase
    .from("fishing_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", opts.userId)
    .is("ended_at", null);

  if (input.visibility === "ghost") {
    return null;
  }

  const { data, error } = await supabase
    .from("fishing_sessions")
    .insert({
      user_id: opts.userId,
      mode: "fishing_now",
      visibility: input.visibility,
      zone_id: input.zoneId,
      zone_name: input.zoneName,
      lat: input.lat,
      lng: input.lng,
      open_for_company: input.openForCompany,
      note: input.note || null,
      avatar_id: input.avatarId,
      expires_at: input.expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("publishSession", error);
    // Fallback local so UI still works
    const row = localPublish(input, opts.displayName || "Du", opts.remoteId);
    return row?.id ?? null;
  }
  return data.id as string;
}

export async function endSession(
  remoteId: string | null | undefined,
  userId?: string | null,
) {
  if (!isSupabaseConfigured() || !supabase || !userId) {
    localEnd(remoteId);
    return;
  }
  const q = supabase
    .from("fishing_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("ended_at", null);
  if (remoteId) q.eq("id", remoteId);
  await q;
  localEnd(remoteId);
}

/** Toggle sällskap on an active session without ending/recreating it. */
export async function setSessionOpenForCompany(
  open: boolean,
  opts: {
    remoteId?: string | null;
    userId?: string | null;
    displayName?: string;
  } = {},
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase || !opts.userId) {
    localSetOpenForCompany(opts.remoteId, open);
    return;
  }

  let q = supabase
    .from("fishing_sessions")
    .update({ open_for_company: open })
    .eq("user_id", opts.userId)
    .is("ended_at", null);
  if (opts.remoteId) q = q.eq("id", opts.remoteId);
  const { data, error } = await q.select("id");
  if (error) {
    console.warn("setSessionOpenForCompany", error);
    localSetOpenForCompany(opts.remoteId, open);
    return;
  }
  if (!data?.length) {
    localSetOpenForCompany(opts.remoteId, open);
  }
}

type PresenceListener = {
  onChange: (rows: PublicFishingSession[]) => void;
  excludeUserId?: string | null;
};

/** One shared Realtime channel — OthersMarkers + PresenceList both subscribe. */
const presenceListeners = new Set<PresenceListener>();
let presenceStarted = false;
let presencePoll: number | null = null;
let presenceUnsubLocal: (() => void) | null = null;

async function emitPresence() {
  const listeners = [...presenceListeners];
  await Promise.all(
    listeners.map(async (listener) => {
      const rows = await listPublicSessions(listener.excludeUserId);
      listener.onChange(rows);
    }),
  );
}

function ensurePresenceBus() {
  if (presenceStarted) return;
  presenceStarted = true;

  if (!isSupabaseConfigured() || !supabase) {
    presenceUnsubLocal = subscribeLocalPresence(() => {
      void emitPresence();
    });
    return;
  }

  const channel = supabase
    .channel("fishing_sessions_public")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "fishing_sessions" },
      () => {
        void emitPresence();
      },
    )
    .subscribe();

  presencePoll = window.setInterval(() => void emitPresence(), 15000);

  presenceUnsubLocal = () => {
    if (presencePoll != null) window.clearInterval(presencePoll);
    presencePoll = null;
    void supabase!.removeChannel(channel);
  };
}

export function subscribePublicSessions(
  onChange: (rows: PublicFishingSession[]) => void,
  excludeUserId?: string | null,
): () => void {
  const listener: PresenceListener = { onChange, excludeUserId };
  presenceListeners.add(listener);
  ensurePresenceBus();
  void emitPresence();

  return () => {
    presenceListeners.delete(listener);
    if (presenceListeners.size === 0 && presenceUnsubLocal) {
      presenceUnsubLocal();
      presenceUnsubLocal = null;
      presenceStarted = false;
    }
  };
}
