import { SPECIES_IDS } from "./species";

const KEY = "kanalhugget.shareDraft.v1";

export type ShareDraft = {
  species: string;
  lengthCm: number | null;
  weightKg: number | null;
  placeName: string | null;
  /** If catch was private, default showPlace to false */
  isPrivate: boolean;
  caughtAt: string;
  savedAt: string;
};

export function saveShareDraft(draft: ShareDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function loadShareDraft(): ShareDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShareDraft;
    if (!parsed?.species || !SPECIES_IDS.includes(parsed.species)) return null;
    if (!parsed.caughtAt) return null;
    return {
      species: parsed.species,
      lengthCm:
        typeof parsed.lengthCm === "number" && Number.isFinite(parsed.lengthCm)
          ? parsed.lengthCm
          : null,
      weightKg:
        typeof parsed.weightKg === "number" && Number.isFinite(parsed.weightKg)
          ? parsed.weightKg
          : null,
      placeName: parsed.placeName ? String(parsed.placeName) : null,
      isPrivate: Boolean(parsed.isPrivate),
      caughtAt: String(parsed.caughtAt),
      savedAt: String(parsed.savedAt || parsed.caughtAt),
    };
  } catch {
    return null;
  }
}

export function clearShareDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
