export type Visibility = "ghost" | "zone" | "precise";

/** Remember last visibility for the next check-in. Default: exakt plats. */
const VISIBILITY_PREF_KEY = "kanalhugget.checkin.visibility.v2";

export function loadVisibilityPref(): Visibility {
  try {
    const raw = localStorage.getItem(VISIBILITY_PREF_KEY);
    if (raw === "ghost" || raw === "zone" || raw === "precise") return raw;
  } catch {
    /* ignore */
  }
  return "precise";
}

export function saveVisibilityPref(value: Visibility) {
  try {
    localStorage.setItem(VISIBILITY_PREF_KEY, value);
  } catch {
    /* ignore */
  }
}

export type CheckInSession = {
  visibility: Visibility;
  openForCompany: boolean;
  note: string;
  zoneId: string | null;
  zoneName: string | null;
  /** Public rounded coords (precise only). */
  publicLat: number | null;
  publicLng: number | null;
  /** Last known private GPS (device only). */
  privateLat: number;
  privateLng: number;
  accuracyM: number | null;
  startedAt: string;
  expiresAt: string;
  /** Row id in Supabase / local presence bus. */
  remoteId?: string | null;
};

export const CHECKIN_STORAGE_KEY = "kanalhugget.checkin.v1";
/** First check-in lasts longer — typical canal session. */
export const INITIAL_DURATION_MS = 4 * 60 * 60 * 1000;
/** @deprecated alias — use INITIAL_DURATION_MS */
export const DEFAULT_DURATION_MS = INITIAL_DURATION_MS;
/** Nudge after this much time checked in. */
export const TWO_HOUR_REMINDER_MS = 2 * 60 * 60 * 1000;
/** Warn this long before expiry. */
export const EXPIRY_WARN_MS = 15 * 60 * 1000;
/** Hard cap from startedAt (includes +30 min extends). */
export const MAX_SESSION_MS = 6 * 60 * 60 * 1000;
export const EXTEND_MS = 30 * 60 * 1000;

const NUDGE_PREFIX = "kanalhugget.checkin.nudge.";

export function wasCheckInNudged(key: string): boolean {
  try {
    return localStorage.getItem(NUDGE_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

export function markCheckInNudged(key: string): void {
  try {
    localStorage.setItem(NUDGE_PREFIX + key, "1");
  } catch {
    /* ignore */
  }
}

export function loadSession(): CheckInSession | null {
  try {
    const raw = localStorage.getItem(CHECKIN_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as CheckInSession;
    if (!s?.expiresAt || !s?.visibility) return null;
    if (Date.parse(s.expiresAt) <= Date.now()) {
      localStorage.removeItem(CHECKIN_STORAGE_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveSession(session: CheckInSession): void {
  localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(CHECKIN_STORAGE_KEY);
}

export function remainingMs(session: CheckInSession): number {
  return Math.max(0, Date.parse(session.expiresAt) - Date.now());
}

export function formatRemaining(ms: number): string {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}
