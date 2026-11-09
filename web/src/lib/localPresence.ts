import type { PublishSessionInput, PublicFishingSession } from "./types";

const KEY = "kanalhugget.localPresence.v1";
const CHANNEL = "kanalhugget-presence";

type Store = {
  sessions: PublicFishingSession[];
};

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { sessions: [] };
    const parsed = JSON.parse(raw) as Store;
    const now = Date.now();
    return {
      sessions: (parsed.sessions || []).filter(
        (s) => Date.parse(s.expiresAt) > now,
      ),
    };
  } catch {
    return { sessions: [] };
  }
}

function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ type: "sync" });
    bc.close();
  } catch {
    /* ignore */
  }
}

/** Per-tab id so two browser tabs can see each other in local demo. */
function deviceId(): string {
  const k = "kanalhugget.deviceId";
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(k, id);
  }
  return id;
}

export function localListPublic(): PublicFishingSession[] {
  const me = deviceId();
  return read().sessions.filter((s) => {
    if (s.userId === me) return false;
    if (s.visibility === "ghost") {
      return s.openForCompany && Boolean(s.zoneId);
    }
    return true;
  });
}

export function localPublish(
  input: PublishSessionInput,
  displayName: string,
  existingId?: string | null,
): PublicFishingSession | null {
  if (
    input.visibility === "ghost" &&
    !(input.openForCompany && input.zoneId)
  ) {
    localEnd(existingId);
    return null;
  }
  const me = deviceId();
  const store = read();
  store.sessions = store.sessions.filter((s) => s.userId !== me);
  const ghostListOnly = input.visibility === "ghost";
  const row: PublicFishingSession = {
    id: existingId || crypto.randomUUID(),
    userId: me,
    displayName,
    visibility: input.visibility,
    zoneId: input.zoneId,
    zoneName: input.zoneName,
    lat: ghostListOnly ? null : input.lat,
    lng: ghostListOnly ? null : input.lng,
    openForCompany: input.openForCompany,
    note: input.note,
    avatarId: input.avatarId,
    expiresAt: input.expiresAt,
  };
  store.sessions.push(row);
  write(store);
  return row;
}

export function localEnd(sessionId?: string | null) {
  const me = deviceId();
  const store = read();
  store.sessions = store.sessions.filter((s) => {
    if (sessionId && s.id === sessionId) return false;
    if (s.userId === me) return false;
    return true;
  });
  write(store);
}

export function localSetOpenForCompany(
  sessionId: string | null | undefined,
  open: boolean,
) {
  const me = deviceId();
  const store = read();
  let changed = false;
  store.sessions = store.sessions.map((s) => {
    const mine = s.userId === me || (sessionId && s.id === sessionId);
    if (!mine) return s;
    changed = true;
    return { ...s, openForCompany: open };
  });
  if (changed) write(store);
}

export function subscribeLocalPresence(
  onChange: (rows: PublicFishingSession[]) => void,
): () => void {
  const emit = () => onChange(localListPublic());
  emit();

  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) emit();
  };
  window.addEventListener("storage", onStorage);

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = () => emit();
  } catch {
    /* ignore */
  }

  const poll = window.setInterval(emit, 2000);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.clearInterval(poll);
    bc?.close();
  };
}

export function localDisplayName(): string {
  const k = "kanalhugget.displayName.tab";
  const existing = sessionStorage.getItem(k);
  if (existing && existing.trim()) return existing.trim();
  const id = deviceId();
  const fresh = `Gäst-${id.slice(0, 4)}`;
  sessionStorage.setItem(k, fresh);
  return fresh;
}

export function setLocalDisplayName(name: string) {
  const v = name.trim() || localDisplayName();
  sessionStorage.setItem("kanalhugget.displayName.tab", v);
}

/** Spread stacked zone pins so two people in same zone are visible. */
export function jitterLatLng(
  lat: number,
  lng: number,
  seed: string,
): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const a = ((h % 1000) / 1000) * Math.PI * 2;
  const d = 0.00018 + ((Math.abs(h) % 7) / 7) * 0.00012;
  return {
    lat: lat + Math.cos(a) * d,
    lng: lng + Math.sin(a) * d,
  };
}
