import { SPECIES_IDS } from "./species";

const SPECIES_KEY = "kanalhugget.quick.species.v1";
const PRIVATE_KEY = "kanalhugget.quick.private.v1";

export function loadLastSpecies(): string {
  try {
    const raw = localStorage.getItem(SPECIES_KEY);
    if (raw && SPECIES_IDS.includes(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "Abborre";
}

export function saveLastSpecies(species: string): void {
  try {
    localStorage.setItem(SPECIES_KEY, species);
  } catch {
    /* ignore */
  }
}

export function loadLastPrivate(): boolean {
  try {
    return localStorage.getItem(PRIVATE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLastPrivate(isPrivate: boolean): void {
  try {
    localStorage.setItem(PRIVATE_KEY, isPrivate ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export const QUICK_CATCH_OPEN_EVENT = "kanalhugget-quick-catch-open";

export function openQuickCatch(): void {
  window.dispatchEvent(new Event(QUICK_CATCH_OPEN_EVENT));
}
