import { isMalmoDarkHours } from "../lib/solarMalmo";

const STORAGE_KEY = "kanalhugget.evening.v1";

export type EveningPref = "auto" | "on" | "off";

/** Auto kväll efter solnedgång / före soluppgång (Malmö). */
export function isEveningNow(date = new Date()): boolean {
  return isMalmoDarkHours(date);
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
