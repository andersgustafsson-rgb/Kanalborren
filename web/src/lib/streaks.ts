import type { MyCatch } from "./myCatches";

export type StreakInfo = {
  /** Consecutive calendar days with at least one catch, ending today or yesterday. */
  catchDays: number;
  /** True when today already has a catch. */
  caughtToday: boolean;
  label: string;
};

function dayKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayKey(dt);
}

export function computeCatchStreak(
  rows: MyCatch[],
  now = new Date(),
): StreakInfo {
  const days = new Set<string>();
  for (const r of rows) {
    const k = dayKey(r.caughtAt);
    if (k) days.add(k);
  }

  const today = todayKey(now);
  const yesterday = shiftKey(today, -1);
  const caughtToday = days.has(today);

  let cursor = caughtToday ? today : yesterday;
  if (!days.has(cursor)) {
    return { catchDays: 0, caughtToday, label: "Ingen streak än" };
  }

  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = shiftKey(cursor, -1);
  }

  const label =
    count === 1
      ? caughtToday
        ? "1 dag med fångst"
        : "Fångst igår — håll i gång"
      : `${count} dagar i rad med fångst`;

  return { catchDays: count, caughtToday, label };
}
