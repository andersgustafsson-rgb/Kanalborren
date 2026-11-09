import { isSupabaseConfigured, supabase } from "./supabase";
import type { RecentCatch } from "./recentCatches";

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapCatch(r: Record<string, unknown>): RecentCatch {
  const profile = r.profiles as { display_name?: string } | null;
  return {
    id: String(r.id),
    displayName: profile?.display_name || "Någon",
    species: String(r.species),
    lengthCm: asNum(r.length_cm),
    weightKg: asNum(r.weight_kg),
    zoneId: r.zone_id ? String(r.zone_id) : null,
    zoneName: r.zone_name ? String(r.zone_name) : null,
    caughtAt: String(r.caught_at),
  };
}

/** Public catches from the last N hours (zone-level, no exact pin). */
export async function fetchZoneActivity(hours = 12): Promise<RecentCatch[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("catch_reports")
    .select(
      "id,species,length_cm,weight_kg,zone_id,zone_name,caught_at,profiles(display_name)",
    )
    .eq("is_private", false)
    .gte("caught_at", since)
    .not("zone_name", "is", null)
    .order("caught_at", { ascending: false })
    .limit(24);

  if (error || !data) {
    console.warn("fetchZoneActivity", error);
    return [];
  }

  return data.map((r) => mapCatch(r as unknown as Record<string, unknown>));
}

export function formatZoneActivityLine(c: RecentCatch): string {
  const where = c.zoneName || "kanalen";
  const measure =
    c.lengthCm != null
      ? ` (${c.lengthCm} cm)`
      : c.weightKg != null
        ? ` (${c.weightKg} kg)`
        : "";
  return `${c.species}${measure} i ${where}`;
}

type ActivityListener = (rows: RecentCatch[]) => void;

const listeners = new Set<ActivityListener>();
let started = false;
let poll: number | null = null;
let unsub: (() => void) | null = null;
let cache: RecentCatch[] = [];

async function emitActivity() {
  cache = await fetchZoneActivity(12);
  for (const listener of listeners) listener(cache);
}

function ensureActivityBus() {
  if (started) return;
  started = true;

  if (!isSupabaseConfigured() || !supabase) return;

  const channel = supabase
    .channel("catch_reports_zone_activity")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "catch_reports" },
      () => {
        void emitActivity();
      },
    )
    .subscribe();

  poll = window.setInterval(() => void emitActivity(), 20000);
  unsub = () => {
    if (poll != null) window.clearInterval(poll);
    poll = null;
    void supabase!.removeChannel(channel);
  };
}

export function subscribeZoneActivity(
  onChange: ActivityListener,
): () => void {
  listeners.add(onChange);
  ensureActivityBus();
  if (cache.length) onChange(cache);
  else void emitActivity();

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && unsub) {
      unsub();
      unsub = null;
      started = false;
    }
  };
}
