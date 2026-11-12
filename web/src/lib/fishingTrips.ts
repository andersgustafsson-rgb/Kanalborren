import { isSupabaseConfigured, supabase } from "./supabase";

/** Same default window as check-in. */
export const FISHING_TRIP_DURATION_MS = 4 * 60 * 60 * 1000;

export type FishingTrip = {
  id: string;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
};

const MIRROR_KEY = "kanalhugget.fishingTrip.v1";

type Mirror = {
  id: string;
  startedAt: string;
  expiresAt: string;
};

function loadMirror(): Mirror | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Mirror;
    if (!parsed?.id || !parsed?.startedAt) return null;
    const expiresAt =
      parsed.expiresAt ||
      new Date(Date.parse(parsed.startedAt) + FISHING_TRIP_DURATION_MS).toISOString();
    return { id: parsed.id, startedAt: parsed.startedAt, expiresAt };
  } catch {
    return null;
  }
}

function saveMirror(trip: Mirror | null) {
  try {
    if (!trip) localStorage.removeItem(MIRROR_KEY);
    else localStorage.setItem(MIRROR_KEY, JSON.stringify(trip));
  } catch {
    /* ignore */
  }
}

function expiresFromStarted(startedAt: string, expiresAt?: string | null): string {
  if (expiresAt) return expiresAt;
  return new Date(Date.parse(startedAt) + FISHING_TRIP_DURATION_MS).toISOString();
}

export function tripRemainingMs(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Date.parse(expiresAt) - now);
}

export function isTripExpired(expiresAt: string, now = Date.now()): boolean {
  return Date.parse(expiresAt) <= now;
}

/** Remaining time label, e.g. "3 h 12 min". */
export function formatTripRemaining(expiresAt: string, now = Date.now()): string {
  const ms = tripRemainingMs(expiresAt, now);
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, "0")} min`;
}

/** @deprecated prefer formatTripRemaining */
export function formatTripElapsed(startedAt: string, now = Date.now()): string {
  const ms = Math.max(0, now - Date.parse(startedAt));
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, "0")} min`;
}

function mapTrip(row: {
  id: unknown;
  started_at: unknown;
  expires_at?: unknown;
  ended_at?: unknown;
}): FishingTrip {
  const startedAt = String(row.started_at);
  return {
    id: String(row.id),
    startedAt,
    expiresAt: expiresFromStarted(
      startedAt,
      row.expires_at ? String(row.expires_at) : null,
    ),
    endedAt: row.ended_at ? String(row.ended_at) : null,
  };
}

async function endExpiredTrip(trip: FishingTrip): Promise<null> {
  await endFishingTrip(trip.id);
  return null;
}

export async function fetchActiveTrip(): Promise<FishingTrip | null> {
  const mirror = loadMirror();
  if (!isSupabaseConfigured() || !supabase) {
    if (!mirror) return null;
    const trip: FishingTrip = {
      id: mirror.id,
      startedAt: mirror.startedAt,
      expiresAt: mirror.expiresAt,
      endedAt: null,
    };
    if (isTripExpired(trip.expiresAt)) {
      saveMirror(null);
      return null;
    }
    return trip;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    saveMirror(null);
    return null;
  }

  const { data, error } = await supabase
    .from("fishing_trips")
    .select("id,started_at,expires_at,ended_at")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("fetchActiveTrip", error);
    if (!mirror) return null;
    const trip: FishingTrip = {
      id: mirror.id,
      startedAt: mirror.startedAt,
      expiresAt: mirror.expiresAt,
      endedAt: null,
    };
    if (isTripExpired(trip.expiresAt)) {
      saveMirror(null);
      return null;
    }
    return trip;
  }

  if (!data) {
    saveMirror(null);
    return null;
  }

  const trip = mapTrip(data);
  if (isTripExpired(trip.expiresAt)) {
    return endExpiredTrip(trip);
  }

  saveMirror({
    id: trip.id,
    startedAt: trip.startedAt,
    expiresAt: trip.expiresAt,
  });
  return trip;
}

export async function startFishingTrip(): Promise<{
  trip: FishingTrip | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return { trip: null, error: "Supabase saknas" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { trip: null, error: "Logga in för att starta fiskepass" };

  const existing = await fetchActiveTrip();
  if (existing) return { trip: existing, error: null };

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + FISHING_TRIP_DURATION_MS);

  const { data, error } = await supabase
    .from("fishing_trips")
    .insert({
      user_id: user.id,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select("id,started_at,expires_at,ended_at")
    .single();

  if (error || !data) {
    console.warn("startFishingTrip", error);
    return {
      trip: null,
      error: error?.message || "Kunde inte starta fiskepass",
    };
  }

  const trip = mapTrip(data);
  saveMirror({
    id: trip.id,
    startedAt: trip.startedAt,
    expiresAt: trip.expiresAt,
  });
  return { trip, error: null };
}

export async function endFishingTrip(
  tripId?: string | null,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    saveMirror(null);
    return { error: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    saveMirror(null);
    return { error: "Inte inloggad" };
  }

  const endedAt = new Date().toISOString();
  let q = supabase
    .from("fishing_trips")
    .update({ ended_at: endedAt })
    .eq("user_id", user.id)
    .is("ended_at", null);
  if (tripId) q = q.eq("id", tripId);

  const { error } = await q;
  if (error) {
    console.warn("endFishingTrip", error);
    return { error: error.message };
  }
  saveMirror(null);
  return { error: null };
}
