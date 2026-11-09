const STORAGE_KEY = "kanalhugget.evening.v1";

export type EveningPref = "auto" | "on" | "off";

/** Rough Malmö dusk window — soft default when pref is auto. */
export function isEveningNow(date = new Date()): boolean {
  const hour = date.getHours();
  const month = date.getMonth(); // 0–11
  // Winter nights longer; summer later dusk.
  const duskHour = month >= 4 && month <= 8 ? 20 : 17;
  const dawnHour = month >= 4 && month <= 8 ? 5 : 7;
  return hour >= duskHour || hour < dawnHour;
}

export function loadEveningPref(): EveningPref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "on" || raw === "off" || raw === "auto") return raw;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function saveEveningPref(pref: EveningPref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function eveningActive(pref: EveningPref, date = new Date()): boolean {
  if (pref === "on") return true;
  if (pref === "off") return false;
  return isEveningNow(date);
}
