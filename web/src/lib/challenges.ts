import { isSupabaseConfigured, supabase } from "./supabase";

export type ChallengeMetric = "length_cm" | "weight_kg";
export type ChallengeStatus =
  | "pending"
  | "active"
  | "declined"
  | "completed"
  | "expired"
  | "cancelled";

export type Challenge = {
  id: string;
  fromUserId: string;
  toUserId: string;
  species: string;
  metric: ChallengeMetric;
  message: string;
  status: ChallengeStatus;
  startsAt: string | null;
  endsAt: string;
  winnerUserId: string | null;
  createdAt: string;
  fromName?: string;
  toName?: string;
  winnerName?: string;
};

function mapRow(
  row: Record<string, unknown>,
  names: Map<string, string>,
): Challenge {
  const fromUserId = String(row.from_user_id);
  const toUserId = String(row.to_user_id);
  const winnerUserId = row.winner_user_id
    ? String(row.winner_user_id)
    : null;
  return {
    id: String(row.id),
    fromUserId,
    toUserId,
    species: String(row.species || "Abborre"),
    metric: (row.metric as ChallengeMetric) || "length_cm",
    message: String(row.message || ""),
    status: row.status as ChallengeStatus,
    startsAt: row.starts_at ? String(row.starts_at) : null,
    endsAt: String(row.ends_at),
    winnerUserId,
    createdAt: String(row.created_at),
    fromName: names.get(fromUserId),
    toName: names.get(toUserId),
    winnerName: winnerUserId ? names.get(winnerUserId) : undefined,
  };
}

async function nameMap(ids: string[]): Promise<Map<string, string>> {
  if (!supabase || ids.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", [...new Set(ids)]);
  return new Map(
    (data || []).map((p) => [p.id as string, p.display_name as string]),
  );
}

/** How long finished challenges stay visible after ends_at. */
export const CHALLENGE_HISTORY_MS = 24 * 60 * 60 * 1000;

export function isChallengeVisible(c: Challenge, now = Date.now()): boolean {
  const ends = new Date(c.endsAt).getTime();
  if (c.status === "active" || c.status === "pending") {
    return ends > now; // past-due ones are swept then reclassified
  }
  // completed / declined / expired / cancelled — keep 24h after end
  return now - ends < CHALLENGE_HISTORY_MS;
}

export async function sweepMyChallenges(): Promise<void> {
  if (!supabase) return;
  await supabase.rpc("sweep_my_challenges");
}

export async function listMyChallenges(): Promise<Challenge[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  await sweepMyChallenges();

  const { data, error } = await supabase
    .from("challenges")
    .select(
      "id,from_user_id,to_user_id,species,metric,message,status,starts_at,ends_at,winner_user_id,created_at",
    )
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data) {
    console.warn("listMyChallenges", error);
    return [];
  }

  const ids = data.flatMap((r) =>
    [r.from_user_id, r.to_user_id, r.winner_user_id].filter(Boolean),
  ) as string[];
  const names = await nameMap(ids);
  return data
    .map((r) => mapRow(r as unknown as Record<string, unknown>, names))
    .filter((c) => isChallengeVisible(c));
}

export async function sendChallenge(input: {
  toUserId: string;
  species: string;
  metric: ChallengeMetric;
  hours: number;
  message?: string;
}): Promise<{ error: string | null; id?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: "Molnet är inte inkopplat" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Logga in först" };
  if (user.id === input.toUserId) {
    return { error: "Du kan inte utmana dig själv" };
  }

  const hours = Math.min(Math.max(input.hours, 2), 48);
  const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      from_user_id: user.id,
      to_user_id: input.toUserId,
      species: input.species.trim() || "Abborre",
      metric: input.metric,
      message: (input.message || "").trim() || null,
      ends_at: endsAt,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { error: null, id: data.id as string };
}

export async function respondChallenge(
  challengeId: string,
  accept: boolean,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Molnet är inte inkopplat" };
  if (accept) {
    const { error } = await supabase.rpc("accept_challenge", {
      challenge_id: challengeId,
    });
    return { error: error?.message ?? null };
  }
  const { error } = await supabase
    .from("challenges")
    .update({ status: "declined" })
    .eq("id", challengeId)
    .eq("status", "pending");
  return { error: error?.message ?? null };
}

export async function resolveChallenge(
  challengeId: string,
): Promise<{ error: string | null; winnerId?: string | null }> {
  if (!supabase) return { error: "Molnet är inte inkopplat" };
  const { data, error } = await supabase.rpc("resolve_challenge", {
    challenge_id: challengeId,
  });
  if (error) return { error: error.message };
  return { error: null, winnerId: (data as string | null) ?? null };
}

export async function listChallengeTargets(): Promise<
  { id: string; displayName: string }[]
> {
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name")
    .is("banned_at", null)
    .neq("id", user.id)
    .order("display_name")
    .limit(50);
  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id as string,
    displayName: (p.display_name as string) || "Fiskare",
  }));
}

export type ChallengeScores = {
  fromScore: number | null;
  toScore: number | null;
};

/** Best matching catch per participant (same rules as resolve_challenge). */
export async function loadChallengeScores(
  challenges: Challenge[],
): Promise<Map<string, ChallengeScores>> {
  const out = new Map<string, ChallengeScores>();
  if (!supabase || challenges.length === 0) return out;

  await Promise.all(
    challenges.map(async (c) => {
      const windowStart = c.startsAt || c.createdAt;
      const col = c.metric === "weight_kg" ? "weight_kg" : "length_cm";

      const best = async (userId: string): Promise<number | null> => {
        const { data, error } = await supabase!
          .from("catch_reports")
          .select(col)
          .eq("user_id", userId)
          .eq("species", c.species)
          .eq("is_private", false)
          .gte("caught_at", windowStart)
          .lte("caught_at", c.endsAt)
          .not(col, "is", null)
          .order(col, { ascending: false })
          .limit(1);
        if (error || !data?.[0]) return null;
        const raw = (data[0] as Record<string, unknown>)[col];
        return typeof raw === "number" ? raw : Number(raw);
      };

      const [fromScore, toScore] = await Promise.all([
        best(c.fromUserId),
        best(c.toUserId),
      ]);
      out.set(c.id, {
        fromScore: fromScore != null && Number.isFinite(fromScore) ? fromScore : null,
        toScore: toScore != null && Number.isFinite(toScore) ? toScore : null,
      });
    }),
  );

  return out;
}
