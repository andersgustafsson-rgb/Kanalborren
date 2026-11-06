export type Visibility = "ghost" | "zone" | "precise";

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
export const DEFAULT_DURATION_MS = 120 * 60 * 1000;

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
